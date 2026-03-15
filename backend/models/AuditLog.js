import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // ✅ Optional — null for system/cron actions
    index: true
  },
  source: {
    type: String,
    enum: ['admin', 'system'],
    default: 'admin',
    index: true // ✅ Filter by human vs automated
  },
  action: { 
    type: String, 
    required: true,
    // 🔒 ADMIN ACTIONS ONLY — user events go to ActivityLog
    enum: [
      'USER_UPDATED', 'USER_BANNED', 'USER_DELETED',
      'CONFIG_UPDATED', 'JOB_DELETED', 'ADMIN_LOGIN',
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
  ipHash: { // ✅ ADD: Hashed IP for GDPR compliance
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

// Prevent modification
auditLogSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified()) {
    return next(new Error('Audit logs are immutable. Cannot modify after creation.'));
  }
  next();
});

// Prevent deletion
auditLogSchema.pre('deleteOne', { document: true }, function(next) {
  return next(new Error('Audit logs cannot be deleted. Contact security team for legal holds.'));
});

// Prevent bulk deletion (e.g. via code)
auditLogSchema.pre('deleteMany', function(next) {
    return next(new Error('Audit logs cannot be bulk deleted via code.'));
});

// Indexes
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ ipAddress: 1, createdAt: -1 });
auditLogSchema.index({ ipHash: 1, createdAt: -1 }); // ✅ Add hash index

export default mongoose.model('AuditLog', auditLogSchema);