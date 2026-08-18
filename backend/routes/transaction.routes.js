import express from 'express';
import * as transactionController from '../controllers/transaction.controller.js';

const router = express.Router();

router.get('/history', transactionController.getHistory);
router.post('/request-credit', transactionController.requestCredit);
router.post('/mock-approve/:id', transactionController.mockApproveCredit);

export default router;
