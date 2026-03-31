// models/Passkey.js
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// PASSKEY MODEL
//
// RULES:
//   - Max 5 passkeys per user (enforced via pre-save hook).
//   - Each passkey is device + browser specific. The WebAuthn spec
//     naturally prevents duplicate registrations from the same
//     device via excludeCredentials sent in registration options.
//   - credentialID is base64url encoded and globally unique.
//   - Users CAN delete their own passkeys (e.g. lost device).
//   - Users CAN rename the label at any time.
//   - When a user account is deleted, all their passkeys are
//     cascade-deleted via the User model pre-deleteOne hook.
//
// LABEL BEHAVIOUR:
//   - Auto-generated at registration from User-Agent
//     (e.g. "Chrome on Windows", "Safari on iOS").
//   - Never null — always has a meaningful value.
//   - User can rename to anything up to 50 chars.
//   - Original deviceName is stored separately so it is
//     preserved even after the user renames the label.
// ─────────────────────────────────────────────────────────────
const PasskeySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Base64url-encoded credential ID issued by the authenticator
  credentialID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Base64url-encoded COSE public key — used to verify assertions
  credentialPublicKey: {
    type: String,
    required: true
  },

  // Signature counter — increments on every successful use.
  // If server receives a counter ≤ stored value, it means a
  // cloned authenticator is being used (replay attack).
  counter: {
    type: Number,
    default: 0
  },

  // Device category detected from User-Agent at registration.
  // Drives the icon shown in the Security tab UI.
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet', 'unknown'],
    default: 'unknown'
  },

  // Original auto-parsed name from User-Agent (immutable after save).
  // e.g. "Chrome on Windows", "Safari on iOS"
  // Stored separately so renaming label never loses this info.
  deviceName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    default: 'Unknown Device'
  },

  // User-editable friendly name shown in the Security tab.
  // Auto-set to deviceName at registration — never null.
  // User can rename to e.g. "My Work Laptop", "iPhone 15".
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    default: 'My Passkey'
  },

  // Updated on every successful passkey login — shown in Security tab
  // so user knows which passkeys are actively being used.
  lastUsed: {
    type: Date,
    default: null
  }
}, {
  timestamps: true  // createdAt, updatedAt
});

// ─────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────
PasskeySchema.index({ user: 1, createdAt: -1 });

// ─────────────────────────────────────────────────────────────
// PRE-SAVE HOOK: Enforce max 5 passkeys per user
// ─────────────────────────────────────────────────────────────
PasskeySchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Passkey').countDocuments({
      user: this.user
    });
    if (count >= 5) {
      const error = new Error(
        'You have reached the maximum of 5 passkeys. Please delete an existing one before adding a new one.'
      );
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

const Passkey = mongoose.model('Passkey', PasskeySchema);
export default Passkey;