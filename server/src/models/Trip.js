import mongoose from 'mongoose';

export const TRIP_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'];

const tripSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    staffIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    date: { type: Date, required: true },
    departureTime: { type: String, required: true },
    status: { type: String, enum: TRIP_STATUSES, default: 'scheduled' },
  },
  { timestamps: true },
);
tripSchema.index({ routeId: 1, date: 1 });
tripSchema.index({ busId: 1, date: 1 });

export default mongoose.models.Trip || mongoose.model('Trip', tripSchema);
