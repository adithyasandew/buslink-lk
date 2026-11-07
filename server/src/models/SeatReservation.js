import mongoose from 'mongoose';

// The unique (tripId, seatNumber) index is the atomic overbooking guard (decision D-006).
const schema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    seatNumber: { type: Number, required: true, min: 1 },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  },
  { timestamps: true },
);
schema.index({ tripId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.models.SeatReservation || mongoose.model('SeatReservation', schema);
