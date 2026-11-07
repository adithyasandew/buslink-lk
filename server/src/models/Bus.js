import mongoose from 'mongoose';

const busSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registrationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    model: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 100 },
    status: { type: String, enum: ['pending', 'verified', 'active', 'inactive'], default: 'pending' },
  },
  { timestamps: true },
);

export default mongoose.models.Bus || mongoose.model('Bus', busSchema);
