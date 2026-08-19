import express from 'express';
import { getUploadUrl } from '../controllers/upload.controller.js';

const router = express.Router();

router.post('/url', getUploadUrl);

export default router;
