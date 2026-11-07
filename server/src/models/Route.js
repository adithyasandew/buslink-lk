import mongoose from 'mongoose';

const routeSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startPoint: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    assignedBusIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bus' }],
  },
  { timestamps: true },
);

export default mongoose.models.Route || mongoose.model('Route', routeSchema);
