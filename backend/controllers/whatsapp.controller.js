import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import Customer from '../models/Customer.js';
import Campaign from '../models/Campaign.js';
import fs from 'fs';
import path from 'path';

// In-memory store for active clients
const sessions = new Map();
const pendingMessages = [];

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

      await Customer.findByIdAndUpdate(customerId, {
        'whatsapp.status': 'Connected'
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
       try {
         if (msg.fromMe) {
           const messageId = msg.id?._serialized || msg.id?.id || String(msg.id);
           fs.appendFileSync('ack_log.txt', `MESSAGE_CREATE: id=${messageId}, to=${msg.to}, type=${msg.type}\n`);
           
           if (pendingMessages.length > 0) {
              const val = pendingMessages.shift(); // take the oldest pending message
              fs.appendFileSync('ack_log.txt', `MESSAGE_CREATE: Linking messageId ${messageId} to contact ${val.number} (campaign ${val.campaignId})\n`);
              
              const res = await Campaign.updateOne(
                { _id: val.campaignId, 'contacts._id': val.contactId },
                { $set: { 'contacts.$.messageId': messageId } }
              );
              
              if (res.modifiedCount > 0) {
                fs.appendFileSync('ack_log.txt', `MESSAGE_CREATE: SUCCESS - saved messageId ${messageId} for ${val.number}\n`);
              }
           }
         }
       } catch (err) {
         console.error('Error in message_create:', err);
       }
    });

    client.on('message_ack', async (msg, ack) => {
      try {
        const messageId = msg.id?._serialized || msg.id?.id || (typeof msg.id === 'string' ? msg.id : String(msg.id));
        fs.appendFileSync('ack_log.txt', `ACK EVENT: ack=${ack}, id=${messageId}, to=${msg.to}, from=${msg.from}\n`);
        
        let updateField = null;
        let incField = null;
        let extraUpdateField = null;
        
        if (ack === 1) {
          updateField = 'contacts.$.delivery.sent';
        } else if (ack === 2) {
          updateField = 'contacts.$.delivery.delivered';
          incField = 'stats.delivered';
        } else if (ack === 3) {
          updateField = 'contacts.$.delivery.seen';
          incField = 'stats.seen';
          extraUpdateField = 'contacts.$.delivery.delivered';
        }
        
        if (updateField) {
           let campaign = await Campaign.findOne({ 'contacts.messageId': messageId });
           let contact = campaign ? campaign.contacts.find(c => c.messageId === messageId) : null;
           
           if (!campaign || !contact) {
              if (msg.to) {
                const cleanNumber = msg.to.split('@')[0].split(':')[0];
                const possibleNumbers = [cleanNumber, cleanNumber.replace(/^91/, '')];
                
                campaign = await Campaign.findOne({ 
                  'contacts': {
                    $elemMatch: {
                      number: { $in: possibleNumbers },
                      $or: [{ messageId: null }, { messageId: { $exists: false } }, { messageId: messageId }]
                    }
                  }
                }).sort({ createdAt: -1 });
                
                if (campaign) {
                  contact = campaign.contacts.find(c => possibleNumbers.includes(c.number) && (!c.messageId || c.messageId === messageId));
                }
              }
           }
           
           if (campaign && contact) {
              if (!contact.messageId) {
                await Campaign.updateOne(
                  { _id: campaign._id, 'contacts._id': contact._id },
                  { $set: { 'contacts.$.messageId': messageId } }
                );
              }

              const updateDoc = {
                $set: { [updateField]: new Date() }
              };
              
              if (extraUpdateField && !contact.delivery?.delivered) {
                 updateDoc.$set[extraUpdateField] = new Date();
                 if (incField) {
                     updateDoc.$inc = { 
                         [incField]: 1,
                         'stats.delivered': 1
                     };
                 }
              } else if (incField) {
                 if ((ack === 2 && !contact.delivery?.delivered) || (ack === 3 && !contact.delivery?.seen)) {
                     updateDoc.$inc = { [incField]: 1 };
                 }
              }

              if ((ack === 1 && !contact.delivery?.sent) || 
                  (ack === 2 && !contact.delivery?.delivered) || 
                  (ack === 3 && !contact.delivery?.seen)) {
                  fs.appendFileSync('ack_log.txt', `EXECUTING updateOne for messageId ${messageId}, ack=${ack}\n`);
                  try {
                      const updateRes = await Campaign.updateOne({ _id: campaign._id, 'contacts._id': contact._id }, updateDoc);
                      fs.appendFileSync('ack_log.txt', `updateOne RESULT: ${JSON.stringify(updateRes)}\n`);
                  } catch(e) {
                      fs.appendFileSync('ack_log.txt', `updateOne ERROR: ${e.message}\n`);
                  }
              } else {
                  fs.appendFileSync('ack_log.txt', `SKIPPED updateOne for messageId ${messageId}, ack=${ack}, contact.delivery=${JSON.stringify(contact.delivery)}\n`);
              }
           }
        }
      } catch (err) {
        console.error('Error handling message_ack:', err);
      }
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
    
    if (sentMsg && sentMsg.id) {
       return sentMsg.id._serialized || sentMsg.id.id || String(sentMsg.id);
    }
    return null;
  } catch (err) {
    console.error('Error in sendMessage:', err);
    throw err;
  }
};
