import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema(
  {
    routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    name: { type: String, required: true, trim: true },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    order: { type: Number, required: true, min: 0 },
    fareFromStart: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);
stopSchema.index({ routeId: 1, order: 1 }, { unique: true });

export default mongoose.models.Stop || mongoose.model('Stop', stopSchema);
