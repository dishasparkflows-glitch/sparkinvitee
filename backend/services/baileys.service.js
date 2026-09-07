import { makeWASocket, initAuthCreds, DisconnectReason, fetchLatestBaileysVersion, delay, BufferJSON } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import BaileysAuth from '../models/BaileysAuth.js';
import { handleMessageCreate, handleMessageAck } from './whatsappHandlers.js';
import fs from 'fs';
import path from 'path';

const sessions = new Map();
const logger = pino({ level: 'silent' });

// --- Safety Guards ---
// Tracks customers currently being unlinked to prevent late auth writes
const unlinkingCustomers = new Set();
// Stores reconnect setTimeout references for cancellation
const reconnectTimers = new Map();

// Custom Auth State using MongoDB
const useMongoAuthState = async (customerId) => {
  const custIdStr = customerId.toString();

  const writeData = async (data, id) => {
    // Guard: skip writes if this customer is being unlinked
    if (unlinkingCustomers.has(custIdStr)) {
      console.log(`[BaileysAuth] Skipping write for ${id} — customer ${custIdStr} is being unlinked`);
      return;
    }
    const jsonString = JSON.stringify(data, BufferJSON.replacer);
    await BaileysAuth.findOneAndUpdate(
      { customerId, dataId: id },
      { data: jsonString },
      { upsert: true, returnDocument: 'after' }
    );
  };

  const readData = async (id) => {
    const doc = await BaileysAuth.findOne({ customerId, dataId: id });
    if (!doc) return null;
    return JSON.parse(doc.data, BufferJSON.reviver);
  };

  const removeData = async (id) => {
    await BaileysAuth.deleteOne({ customerId, dataId: id });
  };

  const credsData = await readData('creds');
  let creds = credsData;
  if (!creds) {
    creds = initAuthCreds();
    await writeData(creds, 'creds');
  }

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
          const data = {};
          await Promise.all(ids.map(async id => {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              const b = await import('@whiskeysockets/baileys');
              value = b.proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }));
          return data;
        },
        set: async (data) => {
          // Guard: skip writes if this customer is being unlinked
          if (unlinkingCustomers.has(custIdStr)) {
            console.log(`[BaileysAuth] Skipping key set — customer ${custIdStr} is being unlinked`);
            return;
          }
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const dataId = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, dataId));
              } else {
                tasks.push(removeData(dataId));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    };
  return {
    state,
    saveCreds: () => writeData(state.creds, 'creds')
  };
};

export const startBaileysSession = async (customerId) => {
  try {
    const custIdStr = customerId.toString();

    // Guard: refuse to start if currently unlinking
    if (unlinkingCustomers.has(custIdStr)) {
      console.log(`[Baileys] Refusing to start session for ${custIdStr} — unlinking in progress`);
      return { message: 'Cannot start session while unlinking is in progress', status: 'UNLINKING' };
    }

    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    if (sessions.has(custIdStr)) {
      const existing = sessions.get(custIdStr);
      if (existing.status === 'CONNECTED' || existing.status === 'QR_READY') {
        return { message: 'Session is already active or waiting for QR', status: existing.status };
      }
      try { existing.sock.end(undefined); } catch(e) {}
      sessions.delete(custIdStr);
    }

    const { state, saveCreds } = await useMongoAuthState(customerId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      generateHighQualityLinkPreview: true,
      browser: ['SparkInvitee', 'Chrome', '1.0.0']
    });

    sessions.set(custIdStr, { sock, status: 'INITIALIZING', qr: null, retries: 0 });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const session = sessions.get(custIdStr) || { sock };

      if (qr) {
        console.log(`[Baileys] QR RECEIVED for customer ${customerId}`);
        const qrDataUrl = await qrcode.toDataURL(qr);
        session.status = 'QR_READY';
        session.qr = qrDataUrl;
        sessions.set(custIdStr, session);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isUnlinking = unlinkingCustomers.has(custIdStr);
        
        console.log(`[Baileys] Connection closed for ${custIdStr}. StatusCode: ${statusCode}, LoggedOut: ${isLoggedOut}, Unlinking: ${isUnlinking}`);

        if (isUnlinking) {
          // Being unlinked — don't reconnect, don't cleanup (unlink handler does it)
          console.log(`[Baileys] Skipping reconnect — unlink in progress for ${custIdStr}`);
          session.status = 'DISCONNECTED';
          sessions.delete(custIdStr);
          return;
        }

        if (isLoggedOut) {
          // Remote logout from phone — clean up auth
          console.log(`[Baileys] Remote logout detected for ${custIdStr} — cleaning up auth`);
          session.status = 'DISCONNECTED';
          session.qr = null;
          sessions.delete(custIdStr);
          
          // Cancel any pending reconnect
          if (reconnectTimers.has(custIdStr)) {
            clearTimeout(reconnectTimers.get(custIdStr));
            reconnectTimers.delete(custIdStr);
          }
          
          // Mark as unlinking to prevent late auth writes during cleanup
          unlinkingCustomers.add(custIdStr);
          try {
            await Customer.findByIdAndUpdate(customerId, { 'whatsapp.status': 'Disconnected' });
            const deleteResult = await BaileysAuth.deleteMany({ customerId: new mongoose.Types.ObjectId(customerId) });
            console.log(`[Baileys] Cleaned up ${deleteResult.deletedCount} auth records for ${custIdStr} (remote logout)`);
          } finally {
            unlinkingCustomers.delete(custIdStr);
          }
        } else {
          // Temporary disconnect — reconnect with backoff, preserve auth
          session.status = 'INITIALIZING';
          sessions.set(custIdStr, session);
          
          const retries = session.retries || 0;
          const waitTime = Math.min(1000 * Math.pow(2, retries), 30000);
          session.retries = retries + 1;
          
          const timer = setTimeout(() => {
            reconnectTimers.delete(custIdStr);
            startBaileysSession(customerId);
          }, waitTime);
          reconnectTimers.set(custIdStr, timer);
        }
      } else if (connection === 'open') {
        console.log(`[Baileys] Connected for customer ${customerId}`);
        session.status = 'CONNECTED';
        session.qr = null;
        session.retries = 0;
        sessions.set(custIdStr, session);

        // Clear any stale reconnect timer
        if (reconnectTimers.has(custIdStr)) {
          clearTimeout(reconnectTimers.get(custIdStr));
          reconnectTimers.delete(custIdStr);
        }

        const mobileNo = sock.user?.id?.split(':')[0] || '';
        await Customer.findByIdAndUpdate(customerId, {
          'whatsapp.status': 'Connected',
          'whatsapp.mobileNo': mobileNo,
          'whatsapp.provider': 'baileys'
        });
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify') return;
        for (const msg of m.messages) {
          if (!msg.key.fromMe) continue;
          
          const messageId = msg.key.id;
          const to = msg.key.remoteJid;
          if (to && !to.includes('@g.us')) {
            await handleMessageCreate(to, messageId, null);
          }
        }
      } catch(err) {
        console.error('[Baileys] Error in messages.upsert:', err);
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      try {
        for (const update of updates) {
          if (update.update.status) {
            const msgId = update.key.id;
            const to = update.key.remoteJid;
            const ack = update.update.status;
            // Baileys status:
            // 2: SERVER_ACK (sent)
            // 3: DELIVERY_ACK (delivered)
            // 4: READ
            let wwebjsAckEquivalent = null;
            if (ack === 2) wwebjsAckEquivalent = 1;
            else if (ack === 3) wwebjsAckEquivalent = 2;
            else if (ack === 4) wwebjsAckEquivalent = 3;

            if (wwebjsAckEquivalent && to && !to.includes('@g.us')) {
              await handleMessageAck(msgId, wwebjsAckEquivalent, to, null);
            }
          }
        }
      } catch (err) {
        console.error('[Baileys] Error in messages.update:', err);
      }
    });

    return { message: 'Session initialization started. Poll for status.', status: 'INITIALIZING' };
  } catch (error) {
    console.error('[Baileys] Error initiating session:', error);
    throw error;
  }
};

export const getBaileysStatus = async (customerId) => {
  const customer = await Customer.findById(customerId);
  const session = sessions.get(customerId.toString());
  
  if (!session) {
    return { status: 'DISCONNECTED', dbStatus: customer?.whatsapp?.status || 'Disconnected' };
  }
  return { status: session.status, qr: session.qr, dbStatus: customer?.whatsapp?.status };
};

// Disconnect: Full unlink — logout from WhatsApp + delete auth records
export const disconnectBaileysSession = async (customerId) => {
  const custIdStr = customerId.toString();
  
  // Idempotent: if already unlinking, just return
  if (unlinkingCustomers.has(custIdStr)) {
    console.log(`[Baileys] Unlink already in progress for ${custIdStr}`);
    return { message: 'Unlink already in progress', status: 'UNLINKING' };
  }

  // Step 1: Mark as unlinking — blocks new auth writes, prevents reconnect
  unlinkingCustomers.add(custIdStr);
  console.log(`[Baileys] Starting unlink for customer ${custIdStr}`);

  let remoteLogoutSuccess = false;
  let warning = null;

  try {
    // Step 2: Cancel pending reconnect timers
    if (reconnectTimers.has(custIdStr)) {
      clearTimeout(reconnectTimers.get(custIdStr));
      reconnectTimers.delete(custIdStr);
      console.log(`[Baileys] Cancelled reconnect timer for ${custIdStr}`);
    }

    // Step 3: Try remote logout via Baileys
    const session = sessions.get(custIdStr);
    if (session && session.sock) {
      try {
        await session.sock.logout();
        remoteLogoutSuccess = true;
        console.log(`[Baileys] Remote logout successful for ${custIdStr}`);
      } catch (logoutErr) {
        console.error(`[Baileys] Remote logout failed for ${custIdStr}:`, logoutErr.message);
        warning = 'Could not confirm remote logout. Please remove the linked device from your phone manually (WhatsApp > Linked Devices).';
        // Still close the socket locally
        try { session.sock.end(undefined); } catch(e) {}
      }
    }

    // Step 4: Remove from in-memory sessions
    sessions.delete(custIdStr);

    // Step 5: Delete auth records scoped to this customer only
    const deleteResult = await BaileysAuth.deleteMany({ 
      customerId: new mongoose.Types.ObjectId(customerId) 
    });
    console.log(`[Baileys] Deleted ${deleteResult.deletedCount} auth records for ${custIdStr}`);

    // Step 6: Update customer status
    await Customer.findByIdAndUpdate(customerId, { 'whatsapp.status': 'Disconnected' });

    const result = { 
      message: remoteLogoutSuccess 
        ? 'WhatsApp unlinked successfully. Scan QR code to reconnect.' 
        : 'Local session cleared. ' + warning,
      status: 'DISCONNECTED',
      requiresQR: true
    };

    if (warning) {
      result.warning = warning;
    }

    return result;
  } catch (error) {
    console.error(`[Baileys] Error during unlink for ${custIdStr}:`, error);
    throw error;
  } finally {
    // Step 7: Always remove unlinking flag
    unlinkingCustomers.delete(custIdStr);
    console.log(`[Baileys] Unlink complete for ${custIdStr}`);
  }
};

export const sendBaileysMessage = async (customerId, number, text, base64Media, mimeType, filename, campaignId, contactId) => {
  const custIdStr = customerId.toString();

  // Guard: block sending if unlinking
  if (unlinkingCustomers.has(custIdStr)) {
    throw new Error('Cannot send message — WhatsApp connection is being unlinked');
  }

  const session = sessions.get(custIdStr);
  if (!session || session.status !== 'CONNECTED' || !session.sock) {
    throw new Error('Baileys client not connected');
  }

  const cleanNumber = number.toString().replace(/\D/g, '');
  let jid = `${cleanNumber}@s.whatsapp.net`;
  if (cleanNumber.length === 10) {
    jid = `91${cleanNumber}@s.whatsapp.net`;
  }

  const [result] = await session.sock.onWhatsApp(jid);
  if (!result || !result.exists) {
    throw new Error(`Number ${cleanNumber} is not registered on WhatsApp`);
  }

  let message = {};
  if (base64Media && mimeType) {
    message = {
      document: Buffer.from(base64Media, 'base64'),
      mimetype: mimeType,
      fileName: filename || 'document.pdf',
      caption: text || ''
    };
  } else if (text) {
    message = { text };
  }

  const sentMsg = await session.sock.sendMessage(result.jid, message);

  if (sentMsg && sentMsg.key && sentMsg.key.id) {
    const messageId = sentMsg.key.id;
    
    if (campaignId && contactId && messageId) {
      try {
        await Campaign.updateOne(
          { _id: campaignId, 'contacts._id': contactId },
          { $set: { 'contacts.$.messageId': messageId } }
        );
      } catch (e) {
        console.error("Failed to save messageId to Campaign", e);
      }
    }
    return messageId;
  }
  return null;
};

// Graceful shutdown helper — preserves auth for restart
export const shutdownBaileysSessions = async () => {
  for (const [id, session] of sessions.entries()) {
    // Cancel reconnect timers
    if (reconnectTimers.has(id)) {
      clearTimeout(reconnectTimers.get(id));
      reconnectTimers.delete(id);
    }
    if (session.sock) {
      try { session.sock.end(undefined); } catch(e) {}
    }
  }
};
