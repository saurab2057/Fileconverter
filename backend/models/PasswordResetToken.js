import mongoose from 'mongoose';

const PasswordResetTokenSchema = new mongoose.Schema(
    {
        // The account this reset request belongs to.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // SHA-256 hash of the random token sent by email.
        // The raw reset token is NEVER stored in MongoDB.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // Absolute deadline for the entire password-reset flow.
        // This is intentionally shared by the email token and reset session.
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },

        // Set when the email token is exchanged for a reset session.
        // null = token has never been used.
        usedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// MongoDB automatically removes expired reset-token records.
// expireAfterSeconds: 0 means "delete when expiresAt is reached".
PasswordResetTokenSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

export default mongoose.model(
    'PasswordResetToken',
    PasswordResetTokenSchema
);