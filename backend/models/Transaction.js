import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Purchase', 'Usage', 'Refund', 'Request'], required: true },
  date: { type: Date, default: Date.now },
  description: { type: String, required: true },
  
  creditsAdded: { type: Number, default: 0 },
  creditsDeducted: { type: Number, default: 0 },
  
  // Specific to Purchase/Request flow
  creditRate: { type: Number },
  totalPrice: { type: Number },
  status: { type: String, enum: ['Requested', 'Completed', 'Rejected'], default: 'Completed' },
  
  balanceAfter: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Transaction', transactionSchema);
