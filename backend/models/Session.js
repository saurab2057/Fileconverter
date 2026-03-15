import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true // ✅ Crucial for finding sessions by user
  },
  jti: { 
    type: String, 
    required: true, 
    unique: true, // ✅ Prevents duplicate token IDs
    index: true   // ✅ Crucial for refresh token lookup
  },
  userAgent: { type: String },
  ipHash: { type: String }, // ✅ GDPR: Hashed IP instead of raw IP
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

// ✅ Proper TTL index — auto-deletes sessions after 7 days
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// ✅ Compound index for revocation queries
SessionSchema.index({ user: 1, createdAt: -1 });

const Session = mongoose.model('Session', SessionSchema);
export default Session;