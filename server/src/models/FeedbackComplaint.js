import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
    kind: { type: String, enum: ['rating', 'complaint'], required: true },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true },
    details: { type: String, trim: true },
    status: { type: String, enum: ['open', 'in_review', 'resolved', 'rejected'], default: 'open', index: true },
  },
  { timestamps: true },
);

export default mongoose.models.FeedbackComplaint || mongoose.model('FeedbackComplaint', schema);
