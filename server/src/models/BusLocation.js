import mongoose from 'mongoose';

const HISTORY_SECONDS = 60 * 60 * 24; // short history, per decision D-006

const locationSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, min: 0 },
  recordedAt: { type: Date, required: true, default: Date.now },
});
locationSchema.index({ tripId: 1, recordedAt: -1 });
locationSchema.index({ recordedAt: 1 }, { expireAfterSeconds: HISTORY_SECONDS });

export default mongoose.models.BusLocation || mongoose.model('BusLocation', locationSchema);
