import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from './models/Customer.js';
import Campaign from './models/Campaign.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkinvitee';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing
    await Customer.deleteMany({});
    await Campaign.deleteMany({});
    console.log('Cleared existing data');

    // Create Customers
    const customer1 = await Customer.create({
      userId: '60d5ecb8b392d700153ee123',
      name: 'Acme Corp',
      email: 'contact@acmecorp.com',
      mobile: '9876543210',
      address: '123 Business Rd',
      whatsapp: {
        status: 'Connected',
        mobileNo: '9876543210',
        deviceId: 'device_123'
      }
    });

    const customer2 = await Customer.create({
      userId: '60d5ecb8b392d700153ee123',
      name: 'TechFlow Inc',
      email: 'hello@techflow.io',
      mobile: '5551234567',
      address: '456 Startup Blvd',
      whatsapp: {
        status: 'Disconnected',
        mobileNo: '5551234567'
      }
    });

    const customer3 = await Customer.create({
      userId: '60d5ecb8b392d700153ee123',
      name: 'Global Reach LLC',
      email: 'sales@globalreach.com',
      mobile: '1112223333',
      address: '789 Enterprise Way',
      whatsapp: {
        status: 'Connected',
        mobileNo: '1112223333',
        deviceId: 'device_789'
      }
    });

    console.log('Created customers');

    // Helper to generate contacts
    const generateContacts = (count, withDelivery = false) => {
      const contacts = [];
      for (let i = 0; i < count; i++) {
        const hasDelivery = withDelivery && Math.random() > 0.2;
        const now = new Date();
        const sent = hasDelivery ? new Date(now.getTime() - 1000 * 60 * 60) : null;
        const delivered = (hasDelivery && Math.random() > 0.3) ? new Date(now.getTime() - 1000 * 60 * 30) : null;
        const seen = (delivered && Math.random() > 0.5) ? new Date(now.getTime() - 1000 * 60 * 5) : null;
        const failed = withDelivery && !hasDelivery ? true : false;
        
        contacts.push({
          name: `User ${i + 1}`,
          number: `999000${i.toString().padStart(4, '0')}`,
          var1: `VarA-${i}`,
          var2: `VarB-${i}`,
          delivery: {
            sent,
            delivered,
            seen,
            failed,
            invalid: false
          }
        });
      }
      return contacts;
    };

    // Create Campaigns
    await Campaign.create({
      customerId: customer1._id,
      userId: '60d5ecb8b392d700153ee123',
      name: 'Q3 Newsletter',
      type: 'Send With Document',
      status: 'Completed',
      stats: {
        totalRecipients: 50,
        creditsUsed: 50,
        inQueue: 0,
        sent: 50,
        delivered: 45,
        seen: 30,
        failed: 5,
        invalid: 0
      },
      contacts: generateContacts(50, true)
    });

    await Campaign.create({
      customerId: customer1._id,
      userId: '60d5ecb8b392d700153ee123',
      name: 'Holiday Promo',
      type: 'Only Message',
      status: 'Drafted',
      stats: {
        totalRecipients: 100,
        creditsUsed: 0,
        inQueue: 100,
        sent: 0,
        delivered: 0,
        seen: 0,
        failed: 0,
        invalid: 0
      },
      contacts: generateContacts(100, false)
    });

    await Campaign.create({
      customerId: customer2._id,
      userId: '60d5ecb8b392d700153ee123',
      name: 'Product Launch',
      type: 'Send With Document',
      status: 'In-Process',
      stats: {
        totalRecipients: 200,
        creditsUsed: 200,
        inQueue: 150,
        sent: 50,
        delivered: 40,
        seen: 10,
        failed: 0,
        invalid: 0
      },
      contacts: generateContacts(200, true)
    });

    await Campaign.create({
      customerId: customer3._id,
      userId: '60d5ecb8b392d700153ee123',
      name: 'Feedback Request',
      type: 'Only Message',
      status: 'Completed',
      stats: {
        totalRecipients: 25,
        creditsUsed: 25,
        inQueue: 0,
        sent: 25,
        delivered: 25,
        seen: 20,
        failed: 0,
        invalid: 0
      },
      contacts: generateContacts(25, true)
    });

    console.log('Created campaigns');
    
    mongoose.connection.close();
    console.log('Seeding complete! Database connection closed.');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
