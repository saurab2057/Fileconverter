import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';

import Passkey from '../../models/Passkey.js';
import User from '../../models/User.js';

describe('Passkey Model - Unit Tests', () => {
    let mongoServer;
    let testUserId;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();

        await mongoose.connect(mongoServer.getUri());

        // IMPORTANT:
        // Make sure all Passkey indexes exist before tests run.
        // This is especially important for unique credentialID.
        await Passkey.syncIndexes();

        // Create a test user for passkey references
        const user = await User.create({
            name: 'Passkey Test User',
            email: 'passkeytest@example.com',
            password: 'Password123!',
        });

        testUserId = user._id;
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await Passkey.deleteMany({});
    });

    const validPasskeyData = (userId) => ({
        user: userId,
        credentialID: 'base64url-credential-id-' + Date.now(),
        credentialPublicKey: 'base64url-public-key-' + Date.now(),
        deviceType: 'desktop',
        deviceName: 'Chrome on Windows',
        label: 'My Work Laptop',
    });


    // ─────────────────────────────────────────────────────────
    // SCHEMA DEFAULTS
    // ─────────────────────────────────────────────────────────

    describe('Schema Defaults', () => {

        it('should set default counter to 0', async () => {
            const passkey = await Passkey.create(
                validPasskeyData(testUserId)
            );

            expect(passkey.counter).to.equal(0);
        });


        it('should set default deviceType to "unknown"', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.deviceType;

            const passkey = await Passkey.create(data);

            expect(passkey.deviceType).to.equal('unknown');
        });


        it('should set default deviceName to "Unknown Device"', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.deviceName;

            const passkey = await Passkey.create(data);

            expect(passkey.deviceName).to.equal('Unknown Device');
        });


        it('should set default label to "My Passkey"', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.label;

            const passkey = await Passkey.create(data);

            expect(passkey.label).to.equal('My Passkey');
        });


        it('should set default lastUsed to null', async () => {
            const passkey = await Passkey.create(
                validPasskeyData(testUserId)
            );

            expect(passkey.lastUsed).to.be.null;
        });


        it('should auto-set createdAt and updatedAt timestamps', async () => {
            const passkey = await Passkey.create(
                validPasskeyData(testUserId)
            );

            expect(passkey.createdAt).to.exist;
            expect(passkey.updatedAt).to.exist;
        });

    });


    // ─────────────────────────────────────────────────────────
    // REQUIRED FIELD VALIDATION
    // ─────────────────────────────────────────────────────────

    describe('Required Field Validation', () => {

        it('should reject passkey without user', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.user;

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });


        it('should reject passkey without credentialID', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.credentialID;

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });


        it('should reject passkey without credentialPublicKey', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            delete data.credentialPublicKey;

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });


        it('should reject passkey without deviceName (after default handling)', async () => {
            const data = {
                ...validPasskeyData(testUserId)
            };

            data.deviceName = null;

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

    });


    // ─────────────────────────────────────────────────────────
    // FIELD VALIDATION
    // ─────────────────────────────────────────────────────────

    describe('Field Validation', () => {

        it('should reject deviceType not in enum', async () => {
            const data = {
                ...validPasskeyData(testUserId),
                deviceType: 'laptop'
            };

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });


        it('should accept all valid deviceType enum values', async () => {
            const validTypes = [
                'mobile',
                'desktop',
                'tablet',
                'unknown'
            ];

            for (const type of validTypes) {
                const data = {
                    ...validPasskeyData(testUserId),
                    deviceType: type
                };

                const passkey = await Passkey.create(data);

                expect(passkey.deviceType).to.equal(type);

                await Passkey.deleteMany({});
            }
        });


        it('should enforce maxlength 100 on deviceName', async () => {
            const longName = 'A'.repeat(101);

            const data = {
                ...validPasskeyData(testUserId),
                deviceName: longName
            };

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });


        it('should enforce maxlength 50 on label', async () => {
            const longLabel = 'A'.repeat(51);

            const data = {
                ...validPasskeyData(testUserId),
                label: longLabel
            };

            const passkey = new Passkey(data);

            try {
                await passkey.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

    });


    // ─────────────────────────────────────────────────────────
    // UNIQUE CONSTRAINTS
    // ─────────────────────────────────────────────────────────

    describe('Unique Constraints', () => {

        it('should have a unique index on credentialID', async () => {
            const indexes = await Passkey.collection.indexes();

            const credentialIndex = indexes.find(
                (index) =>
                    index.key &&
                    index.key.credentialID === 1 &&
                    index.unique === true
            );

            expect(credentialIndex).to.exist;
        });


        it('should reject duplicate credentialID', async () => {
            const credentialID = 'unique-cred-id-12345';

            // First passkey
            await Passkey.create({
                ...validPasskeyData(testUserId),
                credentialID
            });

            // Duplicate credentialID
            const duplicate = new Passkey({
                ...validPasskeyData(testUserId),
                credentialID
            });

            let error;

            try {
                await duplicate.save();
            } catch (err) {
                error = err;
            }

            // Make sure MongoDB actually rejected the duplicate
            expect(error).to.exist;

            // MongoDB duplicate-key error
            expect(error.code).to.equal(11000);
        });

    });


    // ─────────────────────────────────────────────────────────
    // PRE-SAVE HOOK: MAX 5 PASSKEYS PER USER
    // ─────────────────────────────────────────────────────────

    describe('Pre-save Hook - Max 5 Passkeys per User', () => {

        it('should allow up to 5 passkeys per user', async () => {
            for (let i = 1; i <= 5; i++) {
                const passkey = await Passkey.create({
                    ...validPasskeyData(testUserId),
                    credentialID: `cred-${i}`
                });

                expect(passkey).to.exist;
            }
        });


        it('should reject 6th passkey for the same user', async () => {
            // First create 5
            for (let i = 1; i <= 5; i++) {
                await Passkey.create({
                    ...validPasskeyData(testUserId),
                    credentialID: `cred-limit-${i}`
                });
            }

            // Try to create 6th
            const sixth = new Passkey({
                ...validPasskeyData(testUserId),
                credentialID: 'cred-6-should-fail'
            });

            try {
                await sixth.save();

                throw new Error('Expected save to throw');

            } catch (err) {
                expect(err.message)
                    .to.include('maximum of 5 passkeys');

                expect(err.statusCode)
                    .to.equal(400);
            }
        });


        it('should only enforce max limit on new documents (not updates)', async () => {
            // Create 5 passkeys
            const passkeys = [];

            for (let i = 1; i <= 5; i++) {
                const pk = await Passkey.create({
                    ...validPasskeyData(testUserId),
                    credentialID: `update-test-${i}`
                });

                passkeys.push(pk);
            }

            // Update one of them - should succeed
            const firstPasskey = await Passkey.findById(
                passkeys[0]._id
            );

            firstPasskey.label = 'Updated Label';

            const updated = await firstPasskey.save();

            expect(updated.label)
                .to.equal('Updated Label');
        });

    });


    // ─────────────────────────────────────────────────────────
    // RELATIONSHIPS & OTHER BEHAVIORS
    // ─────────────────────────────────────────────────────────

    describe('Relationships & Other Behaviors', () => {

        it('should correctly reference the User', async () => {
            const passkey = await Passkey.create(
                validPasskeyData(testUserId)
            );

            expect(passkey.user.toString())
                .to.equal(testUserId.toString());
        });


        it('should have compound index on user and createdAt', async () => {
            const indexes = Passkey.schema.indexes();

            const hasUserCreatedAtIndex = indexes.some(
                (index) =>
                    index[0].user === 1 &&
                    index[0].createdAt === -1
            );

            expect(hasUserCreatedAtIndex)
                .to.be.true;
        });

    });

});
