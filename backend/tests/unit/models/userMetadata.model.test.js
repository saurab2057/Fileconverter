// tests/unit/models/userMetadata.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import UserMetadata from '../../../models/UserMetadata.js';
import User from '../../../models/User.js';

describe('UserMetadata Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        const user = await User.create({
            name: 'Meta User',
            email: 'meta@example.com',
            password: 'Password123!',
        });

        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await UserMetadata.deleteMany({});
    });

    it('should create metadata with all supported fields', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,

            ipHash: 'hashed-ip-123',

            location: {
                country: 'NP',
                region: 'Bagmati',
                city: 'Kathmandu',
            },

            device: {
                type: 'desktop',
                browser: 'Chrome',
                os: 'Windows',
            },

            network: {
                isp: 'WorldLink Communications',
                organization: 'WorldLink Communications',
                asn: '17501',
                connectionType: 'residential',
                isProxy: false,
                isVpn: false,
                isTor: false,
                isHosting: false,
            },

            timezone: 'Asia/Kathmandu',

            userAgent: 'Mozilla/5.0',
        });

        expect(meta.user.toString()).to.equal(testUserId.toString());

        expect(meta.ipHash).to.equal('hashed-ip-123');

        expect(meta.location.country).to.equal('NP');
        expect(meta.location.region).to.equal('Bagmati');
        expect(meta.location.city).to.equal('Kathmandu');

        expect(meta.device.type).to.equal('desktop');
        expect(meta.device.browser).to.equal('Chrome');
        expect(meta.device.os).to.equal('Windows');

        expect(meta.network.isp).to.equal('WorldLink Communications');
        expect(meta.network.organization).to.equal('WorldLink Communications');
        expect(meta.network.asn).to.equal('17501');
        expect(meta.network.connectionType).to.equal('residential');
        expect(meta.network.isProxy).to.equal(false);
        expect(meta.network.isVpn).to.equal(false);
        expect(meta.network.isTor).to.equal(false);
        expect(meta.network.isHosting).to.equal(false);

        expect(meta.timezone).to.equal('Asia/Kathmandu');
        expect(meta.userAgent).to.equal('Mozilla/5.0');
    });

    it('should allow creating metadata without optional fields', async () => {
        const meta = new UserMetadata({
            user: testUserId,
        });

        const saved = await meta.save();

        expect(saved).to.exist;
        expect(saved.user.toString()).to.equal(testUserId.toString());
    });

    it('should store network security flags correctly', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,

            network: {
                isp: 'Example VPN',
                organization: 'Example VPN',
                asn: '12345',
                connectionType: 'datacenter',
                isProxy: true,
                isVpn: true,
                isTor: false,
                isHosting: true,
            },
        });

        expect(meta.network.isProxy).to.equal(true);
        expect(meta.network.isVpn).to.equal(true);
        expect(meta.network.isTor).to.equal(false);
        expect(meta.network.isHosting).to.equal(true);
    });

    it('should allow missing network security information', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,

            network: {
                isp: 'WorldLink Communications',
                organization: 'WorldLink Communications',
                asn: '17501',
            },
        });

        expect(meta.network.isp).to.equal('WorldLink Communications');
        expect(meta.network.organization).to.equal('WorldLink Communications');
        expect(meta.network.asn).to.equal('17501');

        expect(meta.network.connectionType).to.be.undefined;
        expect(meta.network.isProxy).to.be.undefined;
        expect(meta.network.isVpn).to.be.undefined;
        expect(meta.network.isTor).to.be.undefined;
        expect(meta.network.isHosting).to.be.undefined;
    });

    it('should default createdAt to current date', async () => {
        const before = new Date();

        const meta = await UserMetadata.create({
            user: testUserId,
        });

        const after = new Date();

        expect(meta.createdAt.getTime()).to.be.at.least(
            before.getTime()
        );

        expect(meta.createdAt.getTime()).to.be.at.most(
            after.getTime()
        );
    });

    it('should store hashed IP and not a raw IP field', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,
            ipHash: 'sha256-hashed-value',
        });

        expect(meta.ipHash).to.equal('sha256-hashed-value');
        expect(meta.ip).to.be.undefined;
    });

    it('should allow location and device information to be omitted', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,
            ipHash: 'hashed-ip',
        });

        // `location` is an inline nested object, so Mongoose
        // creates the object even when its individual fields are omitted.
        expect(meta.location).to.exist;
        expect(meta.location.country).to.be.undefined;
        expect(meta.location.region).to.be.undefined;
        expect(meta.location.city).to.be.undefined;

        // `device` is a separate embedded schema, so the entire
        // field remains undefined when it is not provided.
        expect(meta.device).to.be.undefined;
    });

    it('should enforce the user reference field type', async () => {
        const meta = await UserMetadata.create({
            user: testUserId,
        });

        expect(meta.user).to.be.instanceOf(mongoose.Types.ObjectId);
    });
});