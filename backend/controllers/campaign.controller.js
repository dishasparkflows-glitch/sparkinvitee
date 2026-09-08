import Campaign from '../models/Campaign.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sendMessage } from './whatsapp.controller.js';
import { getPresignedDownloadUrl, uploadBufferToR2, deleteMedia } from '../services/r2.service.js';

export const getAllCampaigns = async (req, res) => {
  try {
    // Populate customerId to get the Customer's name + WhatsApp number for the list
    const campaigns = await Campaign.find().populate('customerId', 'name whatsapp').sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaigns', error: error.message });
  }
};

export const getCampaignsByCustomerId = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer campaigns', error: error.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate('customerId').lean();
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    if (campaign.fileUrl && !campaign.fileUrl.startsWith('http')) {
      try {
        campaign.fileUrl = await getPresignedDownloadUrl(campaign.fileUrl);
      } catch (err) {
        console.error('Failed to generate presigned URL:', err);
        campaign.fileUrl = '';
      }
    } else if (campaign.fileUrl) {
      campaign.fileUrl = campaign.fileUrl;
    }

    // Infer failureReason for contacts that failed or are invalid without a recorded reason
    if (campaign.contacts && campaign.contacts.length > 0) {
      const isCustomerWaConnected = campaign.customerId?.whatsapp?.status === 'Connected';
      campaign.contacts.forEach(c => {
        if (c.delivery && (c.delivery.failed || c.delivery.invalid) && !c.delivery.failureReason) {
          const cleanNum = (c.number || '').toString().replace(/\D/g, '');
          if (!cleanNum || cleanNum.length < 10) {
            c.delivery.failureReason = 'Invalid phone number';
          } else if (!isCustomerWaConnected) {
            c.delivery.failureReason = 'WhatsApp disconnected';
          } else {
            c.delivery.failureReason = 'WhatsApp uninstalled';
          }
        }
      });
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching campaign', error: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Delete associated file from Cloudflare R2 if it exists
    if (campaign.fileUrl) {
      try {
        await deleteMedia(campaign.fileUrl);
        console.log(`[R2] Deleted file for campaign ${req.params.id}: ${campaign.fileUrl}`);
      } catch (r2Err) {
        // Log but don't fail the deletion if R2 cleanup fails
        console.error(`[R2] Failed to delete file ${campaign.fileUrl}:`, r2Err.message);
      }
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting campaign', error: error.message });
  }
};

export const pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'In-Process') {
      return res.status(400).json({ message: 'Only in-process campaigns can be paused' });
    }
    const updated = await Campaign.findByIdAndUpdate(req.params.id, { status: 'Paused' }, { returnDocument: 'after' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error pausing campaign', error: error.message });
  }
};

export const resumeCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    if (campaign.status !== 'Paused') {
      return res.status(400).json({ message: 'Only paused campaigns can be resumed' });
    }
    const updated = await Campaign.findByIdAndUpdate(req.params.id, { status: 'In-Process' }, { returnDocument: 'after' });
    // Re-trigger background processor — it will skip already-sent contacts
    processCampaign(updated._id, updated).catch(err => console.error('Campaign resume error:', err));
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error resuming campaign', error: error.message });
  }
};

export const cancelCampaign = async (req, res) => {
  try {
    const oldCampaign = await Campaign.findById(req.params.id);
    if (!oldCampaign) return res.status(404).json({ message: 'Campaign not found' });
    
    const wasInProcess = oldCampaign.status === 'In-Process' || oldCampaign.status === 'Paused';
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { status: 'Cancelled' }, { returnDocument: 'after' });
    
    // If it was NOT in-process/paused, processCampaign is not running to refund it, so we must refund here
    if (!wasInProcess && oldCampaign.status !== 'Drafted') {
       const creditsToRefund = campaign.stats.creditsUsed - campaign.stats.sent;
       if (creditsToRefund > 0) {
         const user = await User.findOneAndUpdate(
            {},
            { $inc: { 'credits.available': creditsToRefund, 'credits.used': -creditsToRefund } },
            { returnDocument: 'after' }
         );
         if (user) {
           await Transaction.create({
             userId: user._id,
             type: 'Refund',
             description: `Refund for cancelled campaign: ${campaign.name}`,
             creditsAdded: creditsToRefund,
             creditsDeducted: 0,
             balanceAfter: user.credits.available
           });
         }
       }
    }
    
    res.json({ ...campaign.toObject(), note: 'Remaining messages have been cancelled. Already-sent messages were not recalled.' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling campaign', error: error.message });
  }
};

export const createCampaign = async (req, res) => {
  try {
    const campaignData = req.body;
    // In a real app, userId comes from auth middleware
    campaignData.userId = '60d5ecb8b392d700153ee123';
    
    // Set initial stats
    campaignData.stats = {
      totalRecipients: campaignData.contacts?.length || 0,
      creditsUsed: campaignData.contacts?.length || 0, // simple 1-to-1 mock
      inQueue: campaignData.contacts?.length || 0,
      sent: 0,
      delivered: 0,
      seen: 0,
      failed: 0,
      invalid: 0
    };

    // Populate senderNumber from Customer's WhatsApp number
    if (campaignData.customerId) {
      try {
        const customer = await Customer.findById(campaignData.customerId);
        if (customer && customer.whatsapp?.mobileNo) {
          campaignData.senderNumber = customer.whatsapp.mobileNo;
        }
      } catch (e) {
        console.error('Could not fetch customer for senderNumber:', e.message);
      }
    }

    const campaign = new Campaign(campaignData);
    await campaign.save();
    
    // Upfront Credit Deduction
    if (campaign.status !== 'Drafted' && campaign.stats.creditsUsed > 0) {
      const user = await User.findOneAndUpdate(
        {},
        { $inc: { 'credits.available': -campaign.stats.creditsUsed, 'credits.used': campaign.stats.creditsUsed } },
        { returnDocument: 'after' }
      );
      if (user) {
        await Transaction.create({
          userId: user._id,
          type: 'Usage',
          description: `Campaign Created: ${campaign.name}`,
          creditsAdded: 0,
          creditsDeducted: campaign.stats.creditsUsed,
          balanceAfter: user.credits.available
        });
      }
    }

    // If status is 'In-Process', trigger the background processor
    if (campaign.status === 'In-Process') {
      processCampaign(campaign._id, campaign).catch(err => console.error('Campaign process error:', err));
    }
    
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Error creating campaign', error: error.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const campaignData = req.body;
    
    // Update stats if contacts changed
    campaignData.stats = {
      totalRecipients: campaignData.contacts?.length || 0,
      creditsUsed: campaignData.contacts?.length || 0, 
      inQueue: campaignData.contacts?.length || 0,
      sent: 0,
      delivered: 0,
      seen: 0,
      failed: 0,
      invalid: 0
    };

    const campaign = await Campaign.findByIdAndUpdate(req.params.id, campaignData, { returnDocument: 'after' });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    
    // If status is 'In-Process', trigger the background processor
    if (campaign.status === 'In-Process') {
      processCampaign(campaign._id, campaign).catch(err => console.error('Campaign process error:', err));
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ message: 'Error updating campaign', error: error.message });
  }
};

export const processCampaign = async (campaignId, campaignData) => {
  try {
    for (const contact of campaignData.contacts) {
      if (contact.number) {
        // Skip contacts that were already sent (important for resume after pause)
        if (contact.delivery?.sent) {
          continue;
        }

        // Check for cancellation or pause before processing next contact
        const currentStatus = await Campaign.findById(campaignId).select('status');
        if (currentStatus && currentStatus.status === 'Cancelled') {
          console.log(`Campaign ${campaignId} was cancelled. Aborting loop.`);
          break;
        }
        if (currentStatus && currentStatus.status === 'Paused') {
          console.log(`Campaign ${campaignId} was paused. Stopping loop.`);
          return; // Exit without setting final status — campaign stays Paused
        }

        // Parse message template
        let msg = campaignData.messageTemplate || '';
        msg = msg.replace(/\[\[Name\]\]/g, contact.name || '');
        msg = msg.replace(/\[\[Number\]\]/g, contact.number || '');
        msg = msg.replace(/\[\[Var 1\]\]/g, contact.var1 || '');
        msg = msg.replace(/\[\[Var 2\]\]/g, contact.var2 || '');
        msg = msg.replace(/\[\[Var 3\]\]/g, contact.var3 || '');
        msg = msg.replace(/\[\[Var 4\]\]/g, contact.var4 || '');
        msg = msg.replace(/\[\[Var 5\]\]/g, contact.var5 || '');
        
        let base64Media = null;
        let mimeType = null;
        let filename = 'document.pdf';

        if (campaignData.fileUrl) {
          try {
             let fileBytes;
             let ext;
             let filePathForName = campaignData.fileUrl;
             
             let fetchUrl = campaignData.fileUrl;
             
             // If it's a Cloudflare R2 key (not an http URL), generate a download URL
             if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
                 fetchUrl = await getPresignedDownloadUrl(fetchUrl);
             }

             if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
                 const response = await fetch(fetchUrl);
                 if (!response.ok) {
                     const body = await response.text();
                     throw new Error(`Failed to fetch remote file: HTTP ${response.status} ${response.statusText} — ${body.substring(0, 200)}`);
                 }
                 fileBytes = Buffer.from(await response.arrayBuffer());
                 ext = path.extname(new URL(fetchUrl).pathname).toLowerCase();
                 filePathForName = new URL(fetchUrl).pathname;
                 console.log(`[R2] File fetched OK. Size: ${fileBytes.length} bytes, ext: ${ext}`);
             } else {
                 throw new Error(`Invalid file URL or key: ${fetchUrl}`);
             }
                
                // 1. Set the fallback to the raw file
                base64Media = fileBytes.toString('base64');
                if (ext === '.pdf') mimeType = 'application/pdf';
                else if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
                else if (ext === '.mp4') mimeType = 'video/mp4';
                else mimeType = 'application/octet-stream';
                filename = campaignData.customPdfName ? `${campaignData.customPdfName}${ext}` : path.basename(filePathForName);

                // 2. Only attempt PDF customization if explicitly requested
                if (campaignData.pdfCustomization && campaignData.pdfCustomization.length > 0) {
                   try {
                       const pdfDoc = await PDFDocument.create();
                       let page;
                       
                       if (ext === '.pdf') {
                          const existingPdf = await PDFDocument.load(fileBytes);
                          const pageIndices = existingPdf.getPageIndices();
                          const copiedPages = await pdfDoc.copyPages(existingPdf, pageIndices);
                          copiedPages.forEach(p => pdfDoc.addPage(p));
                          page = copiedPages[0];
                        } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
                          let image;
                          // Detect actual image type from magic bytes (don't trust extension)
                          const isPng = fileBytes[0] === 0x89 && fileBytes[1] === 0x50; // PNG: \x89P
                          const isJpg = fileBytes[0] === 0xFF && fileBytes[1] === 0xD8; // JPEG: \xFF\xD8
                          
                          if (isPng) {
                            image = await pdfDoc.embedPng(fileBytes);
                          } else if (isJpg) {
                            image = await pdfDoc.embedJpg(fileBytes);
                          } else {
                            // Unknown format — try jpg then png
                            try { image = await pdfDoc.embedJpg(fileBytes); } catch (e) { image = await pdfDoc.embedPng(fileBytes); }
                          }
                          page = pdfDoc.addPage([image.width, image.height]);
                          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                        }

                       if (page) {
                         const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                         const { width, height } = page.getSize();
                         
                         for (const custom of campaignData.pdfCustomization) {
                            let text = '';
                            if (custom.variable === 'Name') text = contact.name || '';
                            else if (custom.variable === 'Var 1') text = contact.var1 || '';
                            else if (custom.variable === 'Var 2') text = contact.var2 || '';
                            else if (custom.variable === 'Var 3') text = contact.var3 || '';
                            else if (custom.variable === 'Var 4') text = contact.var4 || '';
                            else if (custom.variable === 'Var 5') text = contact.var5 || '';

                            const x = (Number(custom.x) / 100) * width;
                            const yCenter = height - ((Number(custom.y) / 100) * height);
                            
                            let r = 0, g = 0, b = 0;
                            if (custom.color && custom.color.startsWith('#')) {
                               const hex = custom.color.replace('#', '');
                               r = parseInt(hex.substring(0,2), 16) / 255;
                               g = parseInt(hex.substring(2,4), 16) / 255;
                               b = parseInt(hex.substring(4,6), 16) / 255;
                            }

                            const fontSize = custom.fontSize ? Number(custom.fontSize) : 24;
                            const textWidth = font.widthOfTextAtSize(text, fontSize);
                            
                            const finalX = x - (textWidth / 2);
                            const finalY = yCenter - (fontSize / 3);

                            page.drawText(text, {
                               x: finalX,
                               y: finalY,
                               size: fontSize,
                               font: font,
                               color: rgb(r, g, b)
                            });
                         }
                         
                         // If customization succeeds, override the raw file with the new PDF
                         base64Media = await pdfDoc.saveAsBase64();
                         mimeType = 'application/pdf';
                         filename = campaignData.customPdfName ? `${campaignData.customPdfName}.pdf` : 'invitation.pdf';
                       }
                   } catch (pdfErr) {
                       console.error("Error generating customized PDF, falling back to raw file:", pdfErr);
                   }
                }
             } catch (e) {
                console.error("Error reading media file:", e);
             }
        }

        try {
          const sentMessageId = await sendMessage(campaignData.customerId, contact.number, msg, base64Media, mimeType, filename, campaignId, contact._id);
          
          console.log(`Sent to ${contact.number} with messageId ${sentMessageId}`);

          const updateSet = { 
            'contacts.$.delivery.sent': new Date(),
            'contacts.$.delivery.failed': false,
            'contacts.$.delivery.invalid': false,
            'contacts.$.delivery.failureReason': null,
            'contacts.$.delivery.retryStatus': 'Sent',
            'contacts.$.delivery.textSent': !!msg,
            'contacts.$.delivery.mediaSent': !!base64Media
          };
          if (sentMessageId) {
             updateSet['contacts.$.messageId'] = sentMessageId;
          }

          await Campaign.findOneAndUpdate(
            { _id: campaignId, 'contacts._id': contact._id },
            {
              $inc: { 'stats.sent': 1, 'stats.inQueue': -1 },
              $set: updateSet
            },
            { returnDocument: 'after' }
          );
          // Credits were deducted upfront, no need to deduct here
        } catch (err) {
          console.error(`Failed to send to ${contact.number}:`, err.message);

          let reason = 'Delivery failed';
          let retryStatus = 'Failed';
          let isInvalid = false;

          if (err.message?.includes('uninstalled') || err.message?.includes('not registered')) {
            reason = 'WhatsApp uninstalled';
          } else if (err.message?.includes('not connected') || err.message?.includes('disconnected')) {
            reason = 'WhatsApp disconnected';
          } else if (err.message?.includes('Invalid phone number')) {
            reason = 'Invalid phone number';
            isInvalid = true;
          } else if (err.message?.includes('Timeout')) {
            reason = 'Timeout - Status unknown';
            retryStatus = 'Status unknown';
          } else {
            reason = err.message || 'Delivery failed';
          }

          await Campaign.findOneAndUpdate(
            { _id: campaignId, 'contacts._id': contact._id },
            {
              $inc: { 'stats.failed': 1, 'stats.inQueue': -1, ...(isInvalid ? { 'stats.invalid': 1 } : {}) },
              $set: { 
                'contacts.$.delivery.failed': true,
                'contacts.$.delivery.invalid': isInvalid,
                'contacts.$.delivery.failureReason': reason,
                'contacts.$.delivery.retryStatus': retryStatus
              }
            }
          );
        }
        
        // Wait delay based on user setting (convert to ms)
        const delay = (campaignData.delayFrom || 3) * 1000; 
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    // Evaluate final status
    const finalCheck = await Campaign.findById(campaignId);
    let finalStatus = finalCheck.status;
    
    if (finalStatus !== 'Cancelled') {
      if (finalCheck.stats.sent === 0 && finalCheck.stats.failed > 0) {
        finalStatus = 'Failed';
      } else if (finalCheck.stats.failed > 0) {
        finalStatus = 'Partially Failed';
      } else {
        finalStatus = 'Completed';
      }
    }
    
    const updatedCampaign = await Campaign.findByIdAndUpdate(campaignId, { status: finalStatus }, { returnDocument: 'after' });
    
    // Refund any unused credits (failed or cancelled messages)
    const creditsToRefund = updatedCampaign.stats.creditsUsed - updatedCampaign.stats.sent;
    if (creditsToRefund > 0) {
      const user = await User.findOneAndUpdate(
         {},
         { $inc: { 'credits.available': creditsToRefund, 'credits.used': -creditsToRefund } },
         { returnDocument: 'after' }
      );
      if (user) {
        await Transaction.create({
          userId: user._id,
          type: 'Refund',
          description: `Refund for unsent/failed messages in: ${updatedCampaign.name}`,
          creditsAdded: creditsToRefund,
          creditsDeducted: 0,
          balanceAfter: user.credits.available
        });
      }
    }
  } catch (error) {
    console.error('Fatal campaign process error:', error);
    await Campaign.findByIdAndUpdate(campaignId, { status: 'Failed' });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { customerId } = req.body;
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = `customers/${customerId || 'system'}/campaigns/${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
    
    // Upload buffer to Cloudflare R2 from the backend (no CORS issues)
    const publicUrl = await uploadBufferToR2(req.file.buffer, key, req.file.mimetype);
    
    console.log(`[R2] File uploaded: ${key}`);
    res.json({ fileUrl: key, publicUrl, originalName: req.file.originalname });
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    res.status(500).json({ message: 'Error uploading file', error: error.message });
  }
};

export const retryFailedRecipients = async (req, res) => {
  const { id } = req.params;
  const { contactIds } = req.body || {};

  try {
    const campaign = await Campaign.findById(id).populate('customerId');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Rule: If WhatsApp is disconnected, ask the user to reconnect before retrying.
    const customer = campaign.customerId;
    if (!customer || customer.whatsapp?.status !== 'Connected') {
      return res.status(400).json({
        message: 'WhatsApp is disconnected. Please reconnect before retrying.',
        code: 'WHATSAPP_DISCONNECTED'
      });
    }

    // Determine target contact IDs (from body array or from params for single-retry)
    let targetIds = null;
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      targetIds = contactIds.map(String);
    } else if (req.params.contactId) {
      targetIds = [String(req.params.contactId)];
    }

    // Rule: Retry only failed recipients - if message already sent, delivered, or read, skip.
    const eligibleContacts = campaign.contacts.filter(c => {
      if (targetIds && !targetIds.includes(c._id.toString())) return false;
      // Skip if already sent, delivered, or seen
      if (c.delivery?.sent || c.delivery?.delivered || c.delivery?.seen) return false;
      // Must be failed or invalid or unknown
      return c.delivery?.failed || c.delivery?.invalid || c.delivery?.retryStatus === 'Status unknown' || c.delivery?.retryStatus === 'Failed' || !c.delivery?.sent;
    });

    if (eligibleContacts.length === 0) {
      return res.status(400).json({ message: 'No eligible failed recipients found to retry' });
    }

    // Rule: If the number is invalid, require correction first.
    if (targetIds && targetIds.length === 1) {
      const singleContact = eligibleContacts[0];
      const cleanNum = singleContact.number ? singleContact.number.toString().replace(/\D/g, '') : '';
      if (!cleanNum || cleanNum.length < 10) {
        return res.status(400).json({
          message: 'Phone number is invalid. Please correct the phone number before retrying.',
          code: 'INVALID_NUMBER',
          contactId: singleContact._id
        });
      }
    }

    const eligibleContactIds = eligibleContacts.map(c => c._id);

    // Rule: Mark as 'Queued'
    await Campaign.updateMany(
      { _id: id, 'contacts._id': { $in: eligibleContactIds } },
      {
        $set: {
          'contacts.$[elem].delivery.retryStatus': 'Queued'
        }
      },
      {
        arrayFilters: [{ 'elem._id': { $in: eligibleContactIds } }]
      }
    );

    // Launch retry process asynchronously
    executeRetryProcess(id, eligibleContacts, campaign).catch(err => {
      console.error('Error during executeRetryProcess:', err);
    });

    res.json({
      message: `Queued ${eligibleContacts.length} failed recipient(s) for retry`,
      queuedCount: eligibleContacts.length
    });
  } catch (error) {
    console.error('Error in retryFailedRecipients:', error);
    res.status(500).json({ message: 'Error retrying failed recipients', error: error.message });
  }
};

const executeRetryProcess = async (campaignId, contacts, campaignData) => {
  try {
    let base64Media = null;
    let mimeType = null;
    let filename = 'document.pdf';

    if (campaignData.fileUrl) {
      try {
        let fetchUrl = campaignData.fileUrl;
        if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
          fetchUrl = await getPresignedDownloadUrl(fetchUrl);
        }
        if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
          const response = await fetch(fetchUrl);
          if (response.ok) {
            const fileBytes = Buffer.from(await response.arrayBuffer());
            const ext = path.extname(new URL(fetchUrl).pathname).toLowerCase();
            base64Media = fileBytes.toString('base64');
            if (ext === '.pdf') mimeType = 'application/pdf';
            else if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            else if (ext === '.mp4') mimeType = 'video/mp4';
            else mimeType = 'application/octet-stream';
            filename = campaignData.customPdfName ? `${campaignData.customPdfName}${ext}` : path.basename(new URL(fetchUrl).pathname);
          }
        }
      } catch (err) {
        console.error('Error fetching file for retry:', err);
      }
    }

    for (const contact of contacts) {
      // Abort if campaign is paused or cancelled
      const freshCheck = await Campaign.findById(campaignId).select('status');
      if (!freshCheck || freshCheck.status === 'Cancelled' || freshCheck.status === 'Paused') {
        break;
      }

      // Check number validity: require correction first
      const cleanNum = contact.number ? contact.number.toString().replace(/\D/g, '') : '';
      if (!cleanNum || cleanNum.length < 10) {
        await Campaign.findOneAndUpdate(
          { _id: campaignId, 'contacts._id': contact._id },
          {
            $set: {
              'contacts.$.delivery.failed': true,
              'contacts.$.delivery.invalid': true,
              'contacts.$.delivery.failureReason': 'Invalid phone number',
              'contacts.$.delivery.retryStatus': 'Failed',
              'contacts.$.delivery.lastRetriedAt': new Date()
            }
          }
        );
        continue;
      }

      // Rule: During retry: Queued -> Sending -> Sent
      await Campaign.findOneAndUpdate(
        { _id: campaignId, 'contacts._id': contact._id },
        {
          $set: {
            'contacts.$.delivery.retryStatus': 'Sending'
          }
        }
      );

      let msg = campaignData.messageTemplate || '';
      msg = msg.replace(/\[\[Name\]\]/g, contact.name || '');
      msg = msg.replace(/\[\[Number\]\]/g, contact.number || '');
      msg = msg.replace(/\[\[Var 1\]\]/g, contact.var1 || '');
      msg = msg.replace(/\[\[Var 2\]\]/g, contact.var2 || '');
      msg = msg.replace(/\[\[Var 3\]\]/g, contact.var3 || '');
      msg = msg.replace(/\[\[Var 4\]\]/g, contact.var4 || '');
      msg = msg.replace(/\[\[Var 5\]\]/g, contact.var5 || '');

      // Rule: For an invitation containing separate text and attachment messages, retry only the failed part.
      let onlyPart = 'all';
      if (contact.delivery?.textSent && !contact.delivery?.mediaSent && base64Media) {
        onlyPart = 'media';
      } else if (contact.delivery?.mediaSent && !contact.delivery?.textSent && msg) {
        onlyPart = 'text';
      }

      try {
        const customerId = campaignData.customerId._id || campaignData.customerId;
        const sentMessageId = await sendMessage(
          customerId,
          contact.number,
          msg,
          base64Media,
          mimeType,
          filename,
          campaignId,
          contact._id,
          { onlyPart }
        );

        console.log(`[Retry] Sent successfully to ${contact.number}, id: ${sentMessageId}`);

        const updateSet = {
          'contacts.$.delivery.sent': new Date(),
          'contacts.$.delivery.failed': false,
          'contacts.$.delivery.invalid': false,
          'contacts.$.delivery.failureReason': null,
          'contacts.$.delivery.retryStatus': 'Sent',
          'contacts.$.delivery.textSent': true,
          'contacts.$.delivery.mediaSent': !!base64Media,
          'contacts.$.delivery.lastRetriedAt': new Date()
        };
        if (sentMessageId) {
          updateSet['contacts.$.messageId'] = sentMessageId;
        }

        await Campaign.findOneAndUpdate(
          { _id: campaignId, 'contacts._id': contact._id },
          {
            $inc: { 'stats.sent': 1, 'stats.failed': -1 },
            $set: updateSet
          }
        );
      } catch (err) {
        console.error(`[Retry] Failed sending to ${contact.number}:`, err.message);

        let reason = 'Delivery failed';
        let retryStatus = 'Failed';
        let isInvalid = false;

        if (err.message?.includes('uninstalled') || err.message?.includes('not registered')) {
          reason = 'WhatsApp uninstalled';
        } else if (err.message?.includes('not connected') || err.message?.includes('disconnected')) {
          reason = 'WhatsApp disconnected';
        } else if (err.message?.includes('Invalid phone number')) {
          reason = 'Invalid phone number';
          isInvalid = true;
        } else if (err.message?.includes('Timeout')) {
          // Rule: If a timeout means you don't know whether the message was sent, show 'Status unknown' and check before resending to avoid duplicates.
          reason = 'Timeout - Status unknown';
          retryStatus = 'Status unknown';
        } else {
          reason = err.message || 'Delivery failed';
        }

        await Campaign.findOneAndUpdate(
          { _id: campaignId, 'contacts._id': contact._id },
          {
            $set: {
              'contacts.$.delivery.failed': true,
              'contacts.$.delivery.invalid': isInvalid,
              'contacts.$.delivery.failureReason': reason,
              'contacts.$.delivery.retryStatus': retryStatus,
              'contacts.$.delivery.lastRetriedAt': new Date()
            }
          }
        );
      }

      // Respect delay between sends
      const delay = (campaignData.delayFrom || 2) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }

    // Recalculate campaign status after retry pass
    const finalCheck = await Campaign.findById(campaignId);
    if (finalCheck && finalCheck.status !== 'Cancelled') {
      const remainingFailed = finalCheck.contacts.filter(c => c.delivery?.failed).length;
      const totalSent = finalCheck.contacts.filter(c => c.delivery?.sent).length;
      let newStatus = finalCheck.status;

      if (remainingFailed === 0 && totalSent > 0) {
        newStatus = 'Completed';
      } else if (remainingFailed > 0 && totalSent > 0) {
        newStatus = 'Partially Failed';
      } else if (remainingFailed > 0 && totalSent === 0) {
        newStatus = 'Failed';
      }

      await Campaign.findByIdAndUpdate(campaignId, {
        status: newStatus,
        'stats.failed': remainingFailed,
        'stats.sent': totalSent
      });
    }
  } catch (fatalErr) {
    console.error('Fatal executeRetryProcess error:', fatalErr);
  }
};

export const updateRecipientNumber = async (req, res) => {
  const { id, contactId } = req.params;
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  const cleanNum = number.toString().replace(/\D/g, '');
  if (cleanNum.length < 10) {
    return res.status(400).json({ message: 'Phone number must have at least 10 digits' });
  }

  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, 'contacts._id': contactId },
      {
        $set: {
          'contacts.$.number': cleanNum,
          'contacts.$.delivery.invalid': false,
          'contacts.$.delivery.failureReason': null,
          'contacts.$.delivery.retryStatus': null
        }
      },
      { returnDocument: 'after' }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign or contact not found' });
    }

    const updatedContact = campaign.contacts.find(c => c._id.toString() === contactId);
    res.json({ message: 'Phone number updated successfully', contact: updatedContact });
  } catch (error) {
    console.error('Error updating recipient number:', error);
    res.status(500).json({ message: 'Error updating recipient number', error: error.message });
  }
};
