import express from 'express';
import * as whatsappController from '../controllers/whatsapp.controller.js';

const router = express.Router();

router.post('/initiate/:customerId', whatsappController.initiateSession);
router.get('/status/:customerId', whatsappController.getSessionStatus);
router.post('/disconnect/:customerId', whatsappController.disconnectSession);

export default router;
