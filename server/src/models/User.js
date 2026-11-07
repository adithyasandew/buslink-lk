import mongoose from 'mongoose';

export const ROLES = ['passenger', 'owner', 'staff', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
    ownerVerified: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // set on staff: the owner who created them
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
