import mongoose from 'mongoose';

const SignupVerificationSchema = new mongoose.Schema(
  {
    // Email address being verified before an actual User exists.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // SHA-256 hash of the raw email-verification token.
    // The raw token is never stored in MongoDB.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Active lifecycle deadline for this temporary signup record.
    //
    // BEFORE email verification:
    //   expiresAt = verification-token deadline (3 minutes)
    //
    // AFTER email verification:
    //   expiresAt = signup-session deadline (5 minutes)
    //
    // The TTL index below cleans up both stages.
    expiresAt: {
      type: Date,
      required: true,
    },

    // Set when the email-verification token is successfully consumed.
    //
    // Once this is non-null, the original verification token
    // can never be used again.
    verifiedAt: {
      type: Date,
      default: null,
    },

    // Set after the temporary signup session successfully creates
    // the actual User account.
    usedAt: {
      type: Date,
      default: null,
    },

    // SHA-256 hash of the temporary signup-session token.
    // The raw session token exists only in the httpOnly browser cookie.
    signupSessionHash: {
      type: String,
      default: null,
      index: true,
    },

    // Absolute expiration time of the temporary signup session.
    signupSessionExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically remove expired temporary signup records.
//
// IMPORTANT:
// This is only cleanup. Controllers MUST explicitly check
// expiresAt > current time. MongoDB TTL is not an authorization
// or security mechanism.
SignupVerificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const SignupVerification = mongoose.model(
  'SignupVerification',
  SignupVerificationSchema
);

export default SignupVerification;