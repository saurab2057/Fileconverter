
import mongoose from 'mongoose';

const metadataSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    ipHash: String,

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

    network: {
        type: new mongoose.Schema({
            isp: String,
            organization: String,
            asn: String,
            connectionType: String,
            isProxy: Boolean,
            isVpn: Boolean,
            isTor: Boolean,
            isHosting: Boolean,
        }, { _id: false })
    },

    timezone: String,

    userAgent: String,

    createdAt: {
        type: Date,
        default: Date.now
    },
});

// Index for user metadata lookups and latest metadata retrieval.
metadataSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('UserMetadata', metadataSchema);
