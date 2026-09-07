import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import Customer from './models/Customer.js';
import * as baileysService from './services/baileys.service.js';
dotenv.config();

// Prevent puppeteer and whatsapp-web.js internal errors from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Graceful shutdown for Baileys
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await baileysService.shutdownBaileysSessions();
  process.exit(0);
};
process.once('SIGUSR2', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadRoutes);

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkinvitee')
.then(async () => {
  console.log('MongoDB connected successfully');
  if (process.env.BAILEYS_ENABLED === 'true') {
    try {
      const activeCustomers = await Customer.find({ 'whatsapp.status': 'Connected', 'whatsapp.provider': 'baileys' });
      console.log(`[Baileys] Restoring ${activeCustomers.length} active sessions on boot...`);
      for (const c of activeCustomers) {
        baileysService.startBaileysSession(c._id).catch(err => console.error(`[Baileys] Boot error for ${c._id}:`, err));
      }
    } catch (err) {
      console.error('[Baileys] Error fetching active sessions on boot:', err);
    }
  }
})
.catch(err => console.error('MongoDB connection error:', err));

// Basic Route for testing
app.get('/', (req, res) => {
  res.json({ message: 'SparkInvitee API is running' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
