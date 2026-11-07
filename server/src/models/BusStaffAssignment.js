import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    staffUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true, index: true },
    staffType: { type: String, enum: ['driver', 'conductor'], required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.models.BusStaffAssignment || mongoose.model('BusStaffAssignment', schema);
