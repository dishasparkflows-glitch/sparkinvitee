import mongoose from 'mongoose';

const baileysAuthSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  dataId: { type: String, required: true },
  data: { type: String, required: true } // Stored as JSON string
}, { timestamps: true });

baileysAuthSchema.index({ customerId: 1, dataId: 1 }, { unique: true });

export default mongoose.model('BaileysAuth', baileysAuthSchema);
