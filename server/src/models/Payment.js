import mongoose from 'mongoose';

// Module 4 owns payment logic; this shared model follows DATABASE_DESIGN.md. Never store card data.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, required: true, trim: true },
    transactionId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
    mock: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
