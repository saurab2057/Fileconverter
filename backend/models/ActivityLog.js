import mongoose from 'mongoose';

// 🔒 USER ACTIVITY LOG — tracks user-initiated events (not admin actions)
// Kept separate from AuditLog which is compliance-grade admin-only
const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_LOGIN',
      'USER_CREATED',
      'PASSWORD_RESET_REQUESTED',
      'PASSWORD_RESET_COMPLETED',
      'SESSION_REVOKED',
    ],
    index: true
  },
  resource: {
    type: String,
    required: true,
  },
  details: {
    type: Object,
    default: {},
  },
  ipAddress: {
    type: String,
    required: true,
  },
  ipHash: {
    type: String,
    index: true
  },
  userAgent: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for common queries
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ ipHash: 1, createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);