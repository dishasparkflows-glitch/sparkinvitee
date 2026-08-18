import express from 'express';
import multer from 'multer';
import * as campaignController from '../controllers/campaign.controller.js';

const router = express.Router();

// Multer config for file uploads (PDF, Images, CSV)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

router.get('/', campaignController.getAllCampaigns);
router.get('/customer/:customerId', campaignController.getCampaignsByCustomerId);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.put('/:id/cancel', campaignController.cancelCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Upload routes
router.post('/upload-csv', upload.single('file'), campaignController.uploadCsv);
router.post('/upload-file', upload.single('file'), campaignController.uploadFile);

export default router;
