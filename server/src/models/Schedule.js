import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    departureTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    arrivalTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    operatingDays: [{ type: Number, min: 0, max: 6 }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
scheduleSchema.index({ routeId: 1, departureTime: 1 });

export default mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
