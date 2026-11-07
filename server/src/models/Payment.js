import mongoose from 'mongoose';

// Module 4. Mock/sandbox payments only (decision D-004). Never store card data.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, required: true, trim: true },
    transactionId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
    // true while pending or successful; the partial unique index below allows only one such payment per booking.
    open: { type: Boolean, default: true },
    refundedAt: { type: Date },
    mock: { type: Boolean, default: true },
  },
  { timestamps: true },
);
paymentSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { open: true }, name: 'one_open_payment_per_booking' });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
