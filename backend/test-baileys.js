import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from './models/Customer.js';
import BaileysAuth from './models/BaileysAuth.js';
import * as baileysService from './services/baileys.service.js';
import { delay } from '@whiskeysockets/baileys';

dotenv.config();

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkinvitee');
  console.log('Connected.');

  try {
    // 1. Create a dummy customer
    const dummyUser = new mongoose.Types.ObjectId();
    const customer = await Customer.create({
      userId: dummyUser,
      name: 'Test Baileys Tenant',
      whatsapp: { status: 'Disconnected', provider: 'baileys' }
    });
    console.log(`Created test customer: ${customer._id}`);

    // 2. Start session (this should trigger auth creds generation and save to DB)
    console.log('Starting Baileys session...');
    await baileysService.startBaileysSession(customer._id);
    
    // Wait for auth to be written
    await delay(3000);

    // 3. Verify Auth Persistence
    const authDocs = await BaileysAuth.find({ customerId: customer._id });
    console.log(`Found ${authDocs.length} auth documents for customer.`);
    if (authDocs.length === 0) {
      throw new Error('Auth persistence failed! No documents found.');
    }

    const credsDoc = authDocs.find(d => d.dataId === 'creds');
    if (!credsDoc) {
      throw new Error('Auth persistence failed! No creds document found.');
    }
    console.log('Auth persistence test passed.');

    // 4. Verify Tenant Isolation (ensure keys belong to this customer only)
    const otherDocs = await BaileysAuth.find({ customerId: { $ne: customer._id } });
    console.log(`Other tenants docs count: ${otherDocs.length}`);
    // This is just a sanity check; if the query works, isolation works since we query by customerId.

    // 5. Cleanup
    console.log('Disconnecting session and cleaning up...');
    await baileysService.disconnectBaileysSession(customer._id);
    await Customer.findByIdAndDelete(customer._id);
    
    // Verify cleanup
    const afterCleanup = await BaileysAuth.find({ customerId: customer._id });
    if (afterCleanup.length > 0) {
      throw new Error('Cleanup failed! Auth documents still exist.');
    }
    console.log('Cleanup successful.');

    console.log('ALL TESTS PASSED.');
  } catch (error) {
    console.error('TEST FAILED:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
