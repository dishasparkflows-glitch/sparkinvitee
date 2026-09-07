import Campaign from '../models/Campaign.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sendMessage } from './whatsapp.controller.js';
import { getPresignedDownloadUrl, uploadBufferToR2, deleteMedia } from '../services/r2.service.js';

export const getAllCampaigns = async (req, res) => {
  try {
    // Populate customerId to get the Customer's name for the "CAMPAIGN & CUSTOMER NAME" column
    const campaigns = await Campaign.find().populate('customerId', 'name').sort({ createdAt: -1 });
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

export const cancelCampaign = async (req, res) => {
  try {
    const oldCampaign = await Campaign.findById(req.params.id);
    if (!oldCampaign) return res.status(404).json({ message: 'Campaign not found' });
    
    const wasInProcess = oldCampaign.status === 'In-Process';
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, { status: 'Cancelled' }, { returnDocument: 'after' });
    
    // If it was NOT in-process, processCampaign is not running to refund it, so we must refund here
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
    
    res.json(campaign);
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
        // Check for cancellation before processing next contact
        const currentStatus = await Campaign.findById(campaignId).select('status');
        if (currentStatus && currentStatus.status === 'Cancelled') {
          console.log(`Campaign ${campaignId} was cancelled. Aborting loop.`);
          break;
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
                         const copiedPages = await pdfDoc.copyPages(existingPdf, [0]);
                         page = copiedPages[0];
                         pdfDoc.addPage(page);
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

          const updateSet = { 'contacts.$.delivery.sent': new Date() };
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
          await Campaign.findOneAndUpdate(
            { _id: campaignId, 'contacts._id': contact._id },
            {
              $inc: { 'stats.failed': 1, 'stats.inQueue': -1 },
              $set: { 'contacts.$.delivery.failed': true }
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
