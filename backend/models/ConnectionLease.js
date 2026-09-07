import mongoose from 'mongoose';

const connectionLeaseSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, unique: true },
  workerId: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// Automatically delete expired leases, but we might want manual control, 
// so we'll just check `expiresAt` in our code instead of a TTL index which can be delayed.

export default mongoose.model('ConnectionLease', connectionLeaseSchema);
