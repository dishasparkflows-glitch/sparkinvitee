import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/stats', dashboardController.getOverviewStats);

export default router;
