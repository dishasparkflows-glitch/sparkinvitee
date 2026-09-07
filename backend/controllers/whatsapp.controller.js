import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';
import path from 'path';
import * as baileysService from '../services/baileys.service.js';
import { handleMessageCreate, handleMessageAck } from '../services/whatsappHandlers.js';

// In-memory store for active clients
const sessions = new Map();

// Clean up orphaned Chromium processes on restart/exit (Fixes "Browser already running" error)
const gracefulShutdown = async () => {
  for (const [id, session] of sessions.entries()) {
    if (session.client) {
      try { await session.client.destroy(); } catch (e) {}
    }
  }
};
process.once('SIGUSR2', async () => {
  await gracefulShutdown();
  process.kill(process.pid, 'SIGUSR2');
});
process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});

export const initiateSession = async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const provider = req.body.provider || customer.whatsapp?.provider || 'wwebjs';
    const isBaileysEnabled = process.env.BAILEYS_ENABLED === 'true';

    if (provider === 'baileys' && isBaileysEnabled) {
      if (customer.whatsapp?.provider !== 'baileys') {
        await Customer.findByIdAndUpdate(customerId, { 'whatsapp.provider': 'baileys' });
      }
      const response = await baileysService.startBaileysSession(customerId);
      return res.json(response);
    }

    if (customer.whatsapp?.provider !== 'wwebjs') {
      await Customer.findByIdAndUpdate(customerId, { 'whatsapp.provider': 'wwebjs' });
    }

    if (sessions.has(customerId)) {
      const existingClient = sessions.get(customerId);
      if (existingClient.status === 'CONNECTED' || existingClient.status === 'QR_READY') {
        return res.json({ message: 'Session is already active or waiting for QR', status: existingClient.status });
      }
      try {
        await existingClient.client.destroy();
      } catch (err) {
        console.error('Error destroying old client:', err);
      }
      sessions.delete(customerId);
    }

    const authPath = path.join(process.cwd(), '.wwebjs_auth', `session-${customerId}`);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: customerId }),
      puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        protocolTimeout: 60000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security'
        ],
      }
    });

    sessions.set(customerId, { client, status: 'INITIALIZING', qr: null });

    client.on('qr', async (qr) => {
      console.log(`QR RECEIVED for customer ${customerId}`);
      const qrDataUrl = await qrcode.toDataURL(qr);
      sessions.set(customerId, { client, status: 'QR_READY', qr: qrDataUrl });
    });

    client.on('ready', async () => {
      console.log(`Client is ready for customer ${customerId}`);
      sessions.set(customerId, { client, status: 'CONNECTED', qr: null });

      // Extract the connected WhatsApp phone number
      const mobileNo = client.info?.wid?.user || '';

      await Customer.findByIdAndUpdate(customerId, {
        'whatsapp.status': 'Connected',
        'whatsapp.mobileNo': mobileNo
      });
    });

    client.on('authenticated', () => {
      console.log(`Authenticated for customer ${customerId}`);
    });

    client.on('auth_failure', async msg => {
      console.error(`Auth failure for customer ${customerId}`, msg);
      sessions.delete(customerId);
      await Customer.findByIdAndUpdate(customerId, {
        'whatsapp.status': 'Disconnected'
      });
    });

    client.on('disconnected', async (reason) => {
      console.log(`Client disconnected for customer ${customerId}:`, reason);
      const s = sessions.get(customerId);
      if (s && s.pollInterval) clearInterval(s.pollInterval);
      sessions.delete(customerId);
      await Customer.findByIdAndUpdate(customerId, {
        'whatsapp.status': 'Disconnected'
      });
    });

  client.on('message_create', async (msg) => {
     if (msg.fromMe) {
       const messageId = msg.id?._serialized || msg.id?.id || String(msg.id);
       const getContactIdFunc = async (lid) => { return await client.getContactById(lid); };
       await handleMessageCreate(msg.to, messageId, getContactIdFunc);
     }
  });

    client.on('message_ack', async (msg, ack) => {
      const messageId = msg.id?._serialized || msg.id?.id || (typeof msg.id === 'string' ? msg.id : String(msg.id));
      const getContactIdFunc = async (lid) => { return await client.getContactById(lid); };
      await handleMessageAck(messageId, ack, msg.to, getContactIdFunc);
    });

    client.initialize().catch(err => {
      console.error(`Puppeteer initialization error for ${customerId}:`, err);
      sessions.delete(customerId);
    });
    res.json({ message: 'Session initialization started. Poll for status.', status: 'INITIALIZING' });
  } catch (error) {
    console.error('Error initiating WhatsApp session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getSessionStatus = async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    if (customer.whatsapp?.provider === 'baileys' && process.env.BAILEYS_ENABLED === 'true') {
      const status = await baileysService.getBaileysStatus(customerId);
      return res.json(status);
    }

    const session = sessions.get(customerId);

    if (!session) {
      return res.json({ status: 'DISCONNECTED', dbStatus: customer.whatsapp.status });
    }

    res.json({
      status: session.status,
      qr: session.qr,
      dbStatus: customer.whatsapp.status
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const disconnectSession = async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await Customer.findById(customerId);
    if (customer?.whatsapp?.provider === 'baileys') {
      const response = await baileysService.disconnectBaileysSession(customerId);
      return res.json(response);
    }

    const session = sessions.get(customerId);

    if (session && session.client) {
      if (session.pollInterval) clearInterval(session.pollInterval);
      try {
        await session.client.destroy();
      } catch (err) {
        console.error('Error destroying client:', err);
      }
      sessions.delete(customerId);
    }

    await Customer.findByIdAndUpdate(customerId, {
      'whatsapp.status': 'Disconnected'
    });

    res.json({ message: 'Session disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendMessage = async (customerId, number, text, base64Media, mimeType, filename, campaignId, contactId) => {
  const customer = await Customer.findById(customerId);
  if (customer?.whatsapp?.provider === 'baileys') {
    return await baileysService.sendBaileysMessage(customerId, number, text, base64Media, mimeType, filename, campaignId, contactId);
  }

  const session = sessions.get(customerId.toString());
  if (!session || session.status !== 'CONNECTED' || !session.client) {
    throw new Error('WhatsApp client not connected');
  }

  const cleanNumber = number.toString().replace(/\D/g, '');
  let chatId = `${cleanNumber}@c.us`;

  if (cleanNumber.length === 10) {
    chatId = `91${cleanNumber}@c.us`;
  }

  try {
    const registered = await session.client.getNumberId(chatId);
    if (!registered) {
      throw new Error(`Number ${cleanNumber} is not registered on WhatsApp`);
    }

    let media = null;
    if (base64Media && mimeType) {
      media = new MessageMedia(mimeType, base64Media, filename || 'document.pdf');
    }

    let sentMsg = null;
    if (media) {
      sentMsg = await session.client.sendMessage(registered._serialized, media, { caption: text || '' });
    } else {
      if (text) {
        sentMsg = await session.client.sendMessage(registered._serialized, text);
      }
    }
    
    if (sentMsg) {
    }

    if (sentMsg && sentMsg.id) {
      // Use bare .id.id (e.g. "3EB0...") — this is what message_ack events also expose
      const messageId = sentMsg.id.id || sentMsg.id._serialized || String(sentMsg.id);
      
      // ⚡ Save messageId to DB IMMEDIATELY — before returning — so it's ready when ACKs fire
      if (campaignId && contactId && messageId) {
        try {
          await Campaign.updateOne(
            { _id: campaignId, 'contacts._id': contactId },
            { $set: { 'contacts.$.messageId': messageId } }
          );
        } catch (e) {
        }
      }

      return messageId;
    }
    
    return null;
  } catch (err) {
    console.error('Error in sendMessage:', err);
    throw err;
  }
};
