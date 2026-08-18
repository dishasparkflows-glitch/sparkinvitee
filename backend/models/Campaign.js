import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Send With Document', 'Only Message'], required: true },
  status: { type: String, enum: ['Drafted', 'Scheduled', 'In-Process', 'Completed', 'Partially Failed', 'Failed', 'Cancelled'], default: 'Drafted' },
  
  countryCode: { type: String, default: '91' },
  allowDuplicates: { type: Boolean, default: false },
  
  delayFrom: { type: Number, default: 2 },
  delayTo: { type: Number, default: 10 },
  scheduleDateTime: { type: Date },
  
  fileUrl: { type: String },
  customPdfName: { type: String },
  pdfCustomization: { type: Array }, 
  messageTemplate: { type: String },
  
  contacts: [{
    messageId: String,
    name: String,
    number: String,
    var1: String,
    var2: String,
    var3: String,
    var4: String,
    var5: String,
    delivery: {
      sent: Date,
      delivered: Date,
      seen: Date,
      failed: Boolean,
      invalid: Boolean
    }
  }],
  
  stats: {
    totalRecipients: { type: Number, default: 0 },
    creditsUsed: { type: Number, default: 0 },
    inQueue: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    seen: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model('Campaign', campaignSchema);
