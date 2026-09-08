import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String },
  mobile: { type: String },
  address: { type: String },
  whatsapp: {
    status: { type: String, enum: ['Connected', 'Disconnected'], default: 'Disconnected' },
    mobileNo: { type: String },
    sessionData: { type: Object },
    provider: { type: String, enum: ['wwebjs', 'baileys'], default: 'wwebjs' }
  }
}, { timestamps: true, versionKey: false });

export default mongoose.model('Customer', customerSchema);
