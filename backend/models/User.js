import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true, // ✅ Prevents duplicate emails via case variance
    trim: true,
    index: true // ✅ Explicit index for lookups
  },
  password: {
    type: String,
    required: [
      function () { return this.authProvider === 'email'; },
      'Password is required for email and password signups.'
    ],
    minlength: 8,
    select: false // ✅ NEVER return password by default
  },
  authProvider: {
    type: String,
    required: true,
    default: 'email',
    enum: ['email', 'google']
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active',
    index: true // ✅ Index for status checks
  },
  bannedAt: {
    type: Date,
    default: null // ✅ Stamped when admin bans — used by auto-delete cron
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true // ✅ Index for admin checks
  },
  profilePictureUrl: {
    type: String,
  },
  profilePicturePublicId: {
    type: String,
    default: null,
    select: false
  },

  // --- 🔒 SECURITY FIELDS ---
  passwordChangedAt: {
    type: Date,
    select: false // Hide from queries
  },

  // --- REMOVED: refreshToken (now in Session collection) ---

  // File history references
  fileHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileHistory'
  }],
}, {
  timestamps: true // Adds createdAt, updatedAt automatically
});

// --- 🔒 INDEXES FOR SCALE ---
// Compound index for frequent auth queries (Login + Status Check)
UserSchema.index({ email: 1, status: 1 });
// Index for admin dashboards (Find all admins, or banned users)
UserSchema.index({ role: 1, status: 1 });

// --- 🔒 HOOKS ---
// Hash password
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // ✅ Don't set passwordChangedAt on initial creation — only on actual changes
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // -1000ms guards against clock skew
    }
    
    next();
  } catch (err) {
    next(err);
  }
});

const User = mongoose.model('User', UserSchema);
export default User;