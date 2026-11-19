import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Purchase', 'Usage', 'Refund', 'Request'], required: true },
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  
  credits: {
    added: { type: Number, default: 0 },
    deducted: { type: Number, default: 0 },
    rate: { type: Number, default: 1 }
  },
  
  // Specific to Purchase/Request flow
  totalPrice: { type: Number },
  status: { type: String, enum: ['Requested', 'Completed', 'Rejected'], default: 'Completed' },
  
  balanceAfter: { type: Number, required: true }
}, { timestamps: true, versionKey: false });

export default mongoose.model('Transaction', transactionSchema);
