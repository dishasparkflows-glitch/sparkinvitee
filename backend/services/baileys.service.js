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

// Custom Auth State using MongoDB
const useMongoAuthState = async (customerId) => {
  const writeData = async (data, id) => {
    // console.log(`[BaileysAuth] Writing data for ${id}`);
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
              value = import('@whiskeysockets/baileys').then(b => b.proto.Message.AppStateSyncKeyData.fromObject(value));
            }
            data[id] = value;
          }));
          return data;
        },
        set: async (data) => {
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
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    if (sessions.has(custIdStr)) {
      const existing = sessions.get(custIdStr);
      if (existing.status === 'CONNECTED' || existing.status === 'QR_READY') {
        return { message: 'Session is already active or waiting for QR', status: existing.status };
      }
      try { existing.sock.logout(); } catch(e) {}
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
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
        console.log(`[Baileys] Connection closed for ${customerId}. Reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          session.status = 'INITIALIZING';
          sessions.set(custIdStr, session);
          
          const retries = session.retries || 0;
          const waitTime = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff max 30s
          session.retries = retries + 1;
          
          setTimeout(() => startBaileysSession(customerId), waitTime);
        } else {
          // Logged out
          session.status = 'DISCONNECTED';
          session.qr = null;
          sessions.delete(custIdStr);
          await Customer.findByIdAndUpdate(customerId, { 'whatsapp.status': 'Disconnected' });
          await BaileysAuth.deleteMany({ customerId }); // Clear auth on logout
        }
      } else if (connection === 'open') {
        console.log(`[Baileys] Connected for customer ${customerId}`);
        session.status = 'CONNECTED';
        session.qr = null;
        session.retries = 0;
        sessions.set(custIdStr, session);

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

export const disconnectBaileysSession = async (customerId) => {
  const session = sessions.get(customerId.toString());
  if (session && session.sock) {
    try { session.sock.logout(); } catch(e) {}
    sessions.delete(customerId.toString());
  }
  await Customer.findByIdAndUpdate(customerId, { 'whatsapp.status': 'Disconnected' });
  await BaileysAuth.deleteMany({ customerId });
  return { message: 'Session disconnected successfully' };
};

export const sendBaileysMessage = async (customerId, number, text, base64Media, mimeType, filename, campaignId, contactId) => {
  const session = sessions.get(customerId.toString());
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

// Graceful shutdown helper
export const shutdownBaileysSessions = async () => {
  for (const [id, session] of sessions.entries()) {
    if (session.sock) {
      try { session.sock.end(undefined); } catch(e) {}
    }
  }
};
