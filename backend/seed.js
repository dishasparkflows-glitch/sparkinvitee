import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from './models/User.js';
import Customer from './models/Customer.js';
import Campaign from './models/Campaign.js';
import Transaction from './models/Transaction.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Ensure User exists
    let user = await User.findOne({ email: 'disharadadiya11@gmail.com' });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      user = await User.create({
        name: 'Disha Radadiya',
        email: 'disharadadiya11@gmail.com',
        password: hashedPassword,
        companyName: 'SparkInvitee',
        credits: { available: 14890, used: 130 }
      });
      console.log('Created primary user');
    } else {
      user.credits = { available: 14890, used: 130 };
      await user.save();
      console.log('Updated primary user credits');
    }

    // 2. Clear Customers, Campaigns, Transactions
    await Customer.deleteMany({});
    await Campaign.deleteMany({});
    await Transaction.deleteMany({});
    console.log('Cleared existing customers, campaigns, and transactions');

    // 3. Seed 5 Customers
    const customerDocs = [
      {
        userId: user._id,
        profile: {
          name: 'Royal Jewellers',
          email: 'info@royaljewellers.in',
          mobile: '9825011223',
          address: 'Varachha Main Road, Surat, Gujarat'
        },
        whatsapp: {
          status: 'Connected',
          mobileNo: '9825011223',
          deviceId: 'device_royal_01',
          provider: 'wwebjs'
        }
      },
      {
        userId: user._id,
        profile: {
          name: 'Apex Textiles',
          email: 'contact@apextextiles.com',
          mobile: '9879022334',
          address: 'Ring Road Market, Surat, Gujarat'
        },
        whatsapp: {
          status: 'Connected',
          mobileNo: '9879022334',
          deviceId: 'device_apex_02',
          provider: 'baileys'
        }
      },
      {
        userId: user._id,
        profile: {
          name: 'Spark Diamond Co',
          email: 'hello@sparkdiamond.com',
          mobile: '9909033445',
          address: 'Katargam GIDC, Surat, Gujarat'
        },
        whatsapp: {
          status: 'Disconnected',
          mobileNo: '9909033445',
          provider: 'wwebjs'
        }
      },
      {
        userId: user._id,
        profile: {
          name: 'Elegance Boutique',
          email: 'support@eleganceboutique.in',
          mobile: '9727044556',
          address: 'Ghod Dod Road, Surat, Gujarat'
        },
        whatsapp: {
          status: 'Connected',
          mobileNo: '9727044556',
          deviceId: 'device_elegance_04',
          provider: 'baileys'
        }
      },
      {
        userId: user._id,
        profile: {
          name: 'Zenith Technologies',
          email: 'admin@zenithtech.io',
          mobile: '9638055667',
          address: 'Adajan Star Bazaar, Surat, Gujarat'
        },
        whatsapp: {
          status: 'Disconnected',
          mobileNo: '9638055667',
          provider: 'wwebjs'
        }
      }
    ];

    const createdCustomers = await Customer.insertMany(customerDocs);
    console.log(`Created ${createdCustomers.length} customers`);

    // Helper to generate contacts
    const generateContacts = (count, withDelivery = false) => {
      const contacts = [];
      const now = new Date();
      for (let i = 0; i < count; i++) {
        const hasDelivery = withDelivery && Math.random() > 0.15;
        const sent = hasDelivery ? new Date(now.getTime() - 1000 * 60 * (120 - i)) : null;
        const delivered = (hasDelivery && Math.random() > 0.2) ? new Date(now.getTime() - 1000 * 60 * (60 - i)) : null;
        const seen = (delivered && Math.random() > 0.4) ? new Date(now.getTime() - 1000 * 60 * (20 - i)) : null;
        const failed = withDelivery && !hasDelivery ? (Math.random() > 0.5) : false;

        contacts.push({
          messageId: `msg_${Date.now()}_${i}`,
          name: `Guest Contact ${i + 1}`,
          number: `98250${(10000 + i).toString()}`,
          var1: `Table ${Math.floor(i / 10) + 1}`,
          var2: i % 2 === 0 ? 'VIP' : 'Regular',
          var3: 'Surat',
          var4: 'None',
          var5: 'None',
          delivery: {
            sent,
            delivered,
            seen,
            failed,
            invalid: false,
            textSent: Boolean(sent),
            mediaSent: Boolean(sent)
          }
        });
      }
      return contacts;
    };

    // 4. Seed 5 Campaigns
    const campaignDocs = [
      {
        userId: user._id,
        customerId: createdCustomers[0]._id,
        name: 'Diwali Festive Greetings 2026',
        type: 'Send With Document',
        status: 'Completed',
        senderNumber: createdCustomers[0].whatsapp.mobileNo,
        stats: {
          totalRecipients: 50,
          creditsUsed: 50,
          inQueue: 0,
          sent: 50,
          delivered: 45,
          seen: 32,
          failed: 5,
          invalid: 0
        },
        contacts: generateContacts(50, true)
      },
      {
        userId: user._id,
        customerId: createdCustomers[1]._id,
        name: 'Grand Wedding Invitation Blast',
        type: 'Send With Document',
        status: 'In-Process',
        senderNumber: createdCustomers[1].whatsapp.mobileNo,
        stats: {
          totalRecipients: 80,
          creditsUsed: 80,
          inQueue: 50,
          sent: 30,
          delivered: 25,
          seen: 18,
          failed: 0,
          invalid: 0
        },
        contacts: generateContacts(80, true)
      },
      {
        userId: user._id,
        customerId: createdCustomers[2]._id,
        name: 'New Diamond Collection Announcement',
        type: 'Only Message',
        status: 'Drafted',
        stats: {
          totalRecipients: 25,
          creditsUsed: 0,
          inQueue: 25,
          sent: 0,
          delivered: 0,
          seen: 0,
          failed: 0,
          invalid: 0
        },
        contacts: generateContacts(25, false)
      },
      {
        userId: user._id,
        customerId: createdCustomers[3]._id,
        name: 'Exclusive VIP Fashion Preview',
        type: 'Only Message',
        status: 'Scheduled',
        scheduleDateTime: new Date(Date.now() + 1000 * 60 * 60 * 48), // 2 days later
        stats: {
          totalRecipients: 40,
          creditsUsed: 40,
          inQueue: 40,
          sent: 0,
          delivered: 0,
          seen: 0,
          failed: 0,
          invalid: 0
        },
        contacts: generateContacts(40, false)
      },
      {
        userId: user._id,
        customerId: createdCustomers[4]._id,
        name: 'Corporate Software Demo Invites',
        type: 'Send With Document',
        status: 'Paused',
        senderNumber: createdCustomers[4].profile.mobile,
        stats: {
          totalRecipients: 60,
          creditsUsed: 60,
          inQueue: 40,
          sent: 20,
          delivered: 18,
          seen: 12,
          failed: 0,
          invalid: 0
        },
        contacts: generateContacts(60, true)
      }
    ];

    const createdCampaigns = await Campaign.insertMany(campaignDocs);
    console.log(`Created ${createdCampaigns.length} campaigns`);

    // 5. Seed 5 Transactions
    const transactionDocs = [
      {
        userId: user._id,
        type: 'Purchase',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
        description: 'Credits Purchased: 5000 (Payment via UPI)',
        credits: {
          added: 5000,
          deducted: 0,
          rate: 1
        },
        totalPrice: 5000,
        status: 'Completed',
        balanceAfter: 15000
      },
      {
        userId: user._id,
        type: 'Usage',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
        description: 'Campaign Created: Diwali Festive Greetings 2026',
        credits: {
          added: 0,
          deducted: 50,
          rate: 1
        },
        status: 'Completed',
        balanceAfter: 14950
      },
      {
        userId: user._id,
        type: 'Usage',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        description: 'Campaign Created: Grand Wedding Invitation Blast',
        credits: {
          added: 0,
          deducted: 80,
          rate: 1
        },
        status: 'Completed',
        balanceAfter: 14870
      },
      {
        userId: user._id,
        type: 'Refund',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        description: 'Refund for failed contacts in Diwali Festive Greetings 2026',
        credits: {
          added: 20,
          deducted: 0,
          rate: 1
        },
        status: 'Completed',
        balanceAfter: 14890
      },
      {
        userId: user._id,
        type: 'Request',
        date: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        description: 'Additional 2000 credits for upcoming festival campaign',
        credits: {
          added: 2000,
          deducted: 0,
          rate: 1
        },
        totalPrice: 2000,
        status: 'Requested',
        balanceAfter: 14890
      }
    ];

    const createdTransactions = await Transaction.insertMany(transactionDocs);
    console.log(`Created ${createdTransactions.length} transactions`);

    await mongoose.connection.close();
    console.log('✅ Seeding complete! Database connection closed.');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
