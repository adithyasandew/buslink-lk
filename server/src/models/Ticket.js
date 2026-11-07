import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    ticketRef: { type: String, required: true, unique: true },
    qrToken: { type: String, required: true, unique: true }, // opaque; no personal data
    fare: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['valid', 'used', 'cancelled'], default: 'valid' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
