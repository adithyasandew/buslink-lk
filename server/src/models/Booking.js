import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    pickupStopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true },
    dropoffStopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true },
    seats: {
      type: [{ type: Number, min: 1 }],
      validate: { validator: (v) => v.length > 0, message: 'At least one seat is required' },
    },
    fare: { type: Number, required: true, min: 0 }, // computed on the server only
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
);
bookingSchema.index({ passengerId: 1, createdAt: -1 });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
