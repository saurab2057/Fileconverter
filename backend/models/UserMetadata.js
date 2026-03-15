import mongoose from 'mongoose';

const metadataSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true // ✅ Add index for lookups
  },
  ipHash: String, // ✅ Changed from 'ip' to 'ipHash' for GDPR
  location: {
    country: String,
    region: String,
    city: String,
  },
  device: {
    type: new mongoose.Schema({
      type: String,
      browser: String,
      os: String,
    }, { _id: false })
  },
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
});

// ✅ Add index for queries
metadataSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('UserMetadata', metadataSchema);