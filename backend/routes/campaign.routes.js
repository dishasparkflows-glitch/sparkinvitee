import express from 'express';
import multer from 'multer';
import * as campaignController from '../controllers/campaign.controller.js';

const router = express.Router();

// Multer config — use memory storage so we can stream buffer to Cloudflare R2
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit — allow any file

router.get('/', campaignController.getAllCampaigns);
router.get('/customer/:customerId', campaignController.getCampaignsByCustomerId);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.put('/:id/pause', campaignController.pauseCampaign);
router.put('/:id/resume', campaignController.resumeCampaign);
router.put('/:id/cancel', campaignController.cancelCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Retry routes
router.post('/:id/retry', campaignController.retryFailedRecipients);
router.post('/:id/retry/:contactId', campaignController.retryFailedRecipients);
router.put('/:id/contacts/:contactId/number', campaignController.updateRecipientNumber);

// Upload routes
router.post('/upload-file', upload.single('file'), campaignController.uploadFile);

export default router;
