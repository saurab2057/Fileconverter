import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  userAgent: { type: String },
  ipHash: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

// Compound unique index: one active session per user+device
SessionSchema.index({ user: 1, deviceId: 1 }, { unique: true });

// TTL index — auto-delete sessions after 7 days
// AFTER — expires 7 days from LAST ACTIVITY
SessionSchema.index({ lastActive: 1 }, { expireAfterSeconds: 604800 });

// Compound index for revocation queries
SessionSchema.index({ user: 1, createdAt: -1 });

const Session = mongoose.model('Session', SessionSchema);
export default Session;