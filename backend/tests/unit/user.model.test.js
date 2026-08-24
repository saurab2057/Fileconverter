// tests/unit/user.model.test.js
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect } from 'chai';
import bcrypt from 'bcrypt';
import User from '../../models/User.js';

describe('User Model - Unit Tests', () => {
    let mongoServer;

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    afterEach(async () => {
        await User.deleteMany({});
    });

    // ─────────────────────────────────────────────────────────
    // SCHEMA DEFAULTS
    // ─────────────────────────────────────────────────────────
    describe('Schema Defaults', () => {
        it('should set default role to "user"', async () => {
            const user = await User.create({ name: 'Default Role', email: 'role@example.com', password: 'Password123!' });
            expect(user.role).to.equal('user');
        });

        it('should set default status to "active"', async () => {
            const user = await User.create({ name: 'Active User', email: 'active@example.com', password: 'Password123!' });
            expect(user.status).to.equal('active');
        });

        it('should set default authProvider to "email"', async () => {
            const user = await User.create({ name: 'Email User', email: 'email@example.com', password: 'Password123!' });
            expect(user.authProvider).to.equal('email');
        });

        it('should set bannedAt to null by default', async () => {
            const user = await User.create({ name: 'Not Banned', email: 'notbanned@example.com', password: 'Password123!' });
            expect(user.bannedAt).to.be.null;
        });

        it('should initialize fileHistory as empty array', async () => {
            const user = await User.create({ name: 'No History', email: 'nohistory@example.com', password: 'Password123!' });
            expect(user.fileHistory).to.deep.equal([]);
        });

        it('should auto-set createdAt and updatedAt timestamps', async () => {
            const user = await User.create({ name: 'Timestamps', email: 'timestamps@example.com', password: 'Password123!' });
            expect(user.createdAt).to.exist;
            expect(user.updatedAt).to.exist;
        });
    });

    // ─────────────────────────────────────────────────────────
    // REQUIRED FIELD VALIDATION
    // ─────────────────────────────────────────────────────────
    describe('Required Field Validation', () => {
        it('should reject user without a name', async () => {
            const user = new User({ email: 'noname@example.com', password: 'Password123!' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should reject user without an email', async () => {
            const user = new User({ name: 'No Email', password: 'Password123!' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should reject duplicate email', async () => {
            await User.create({ name: 'First', email: 'duplicate@example.com', password: 'Password123!' });
            const duplicate = new User({ name: 'Second', email: 'duplicate@example.com', password: 'Password123!' });
            try {
                await duplicate.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should store email in lowercase', async () => {
            const user = await User.create({ name: 'Case Test', email: 'UPPER@EXAMPLE.COM', password: 'Password123!' });
            expect(user.email).to.equal('upper@example.com');
        });
    });

    // ─────────────────────────────────────────────────────────
    // PASSWORD VALIDATION
    // ─────────────────────────────────────────────────────────
    describe('Password Validation', () => {
        it('should require password when authProvider is "email"', async () => {
            const user = new User({ name: 'No Password', email: 'nopassword@example.com', authProvider: 'email' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err.message).to.match(/password is required/i);
            }
        });

        it('should NOT require password when authProvider is "google"', async () => {
            const user = new User({ name: 'Google User', email: 'google@example.com', authProvider: 'google' });
            const saved = await user.save();
            expect(saved).to.exist;
        });
    });

    // ─────────────────────────────────────────────────────────
    // PASSWORD HASHING (pre-save hook)
    // ─────────────────────────────────────────────────────────
    describe('Password Hashing (pre-save hook)', () => {
        it('should hash the password before saving', async () => {
            const plainPassword = 'Password123!';
            const user = await User.create({ name: 'Hash Test', email: 'hash@example.com', password: plainPassword });
            expect(user.password).to.not.equal(plainPassword);
        });

        it('should produce a valid bcrypt hash', async () => {
            const plainPassword = 'Password123!';
            const user = new User({ name: 'Bcrypt Test', email: 'bcrypt@example.com', password: plainPassword });
            await user.save();

            const savedUser = await User.findById(user._id).select('+password');
            const isMatch = await bcrypt.compare(plainPassword, savedUser.password);
            expect(isMatch).to.equal(true);
        });

        // With this:
        it('should NOT set passwordChangedAt on initial signup, but SHOULD set it on password change', async () => {
            // Initial creation — passwordChangedAt must NOT be set
            const user = await User.create({ name: 'Password Changed', email: 'pwchanged@example.com', password: 'Password123!' });
            expect(user.passwordChangedAt).to.not.exist;

            // Explicit password change — passwordChangedAt MUST be set
            const savedUser = await User.findById(user._id).select('+password');
            savedUser.password = 'NewPassword456!';
            await savedUser.save();

            const updated = await User.findById(user._id).select('+passwordChangedAt');
            expect(updated.passwordChangedAt).to.exist;
        });

        it('should NOT re-hash password if it was not modified', async () => {
            const user = await User.create({ name: 'No Rehash', email: 'norehash@example.com', password: 'Password123!' });
            const savedUser = await User.findById(user._id).select('+password');
            const hashBeforeUpdate = savedUser.password;

            savedUser.name = 'Updated Name';
            await savedUser.save();

            const afterUpdate = await User.findById(user._id).select('+password');
            expect(afterUpdate.password).to.equal(hashBeforeUpdate);
        });

        it('should re-hash password when it is explicitly changed', async () => {
            const user = await User.create({ name: 'Rehash User', email: 'rehash@example.com', password: 'OldPassword123!' });
            const savedUser = await User.findById(user._id).select('+password');
            const oldHash = savedUser.password;

            savedUser.password = 'NewPassword456!';
            await savedUser.save();

            const updated = await User.findById(user._id).select('+password');
            expect(updated.password).to.not.equal(oldHash);

            const isMatch = await bcrypt.compare('NewPassword456!', updated.password);
            expect(isMatch).to.equal(true);
        });
    });

    // ─────────────────────────────────────────────────────────
    // FIELD VISIBILITY (select: false)
    // ─────────────────────────────────────────────────────────
    describe('Field Visibility', () => {
        it('should NOT return password in default query', async () => {
            await User.create({ name: 'Hidden Password', email: 'hidden@example.com', password: 'Password123!' });
            const user = await User.findOne({ email: 'hidden@example.com' });
            expect(user.password).to.be.undefined;
        });

        it('should return password when explicitly selected', async () => {
            await User.create({ name: 'Show Password', email: 'showpw@example.com', password: 'Password123!' });
            const user = await User.findOne({ email: 'showpw@example.com' }).select('+password');
            expect(user.password).to.exist;
        });

        it('should NOT return profilePicturePublicId in default query', async () => {
            await User.create({ name: 'Hidden PublicId', email: 'publicid@example.com', password: 'Password123!', profilePicturePublicId: 'cloudinary/abc123' });
            const user = await User.findOne({ email: 'publicid@example.com' });
            expect(user.profilePicturePublicId).to.be.undefined;
        });
    });

    // ─────────────────────────────────────────────────────────
    // ENUM VALIDATION
    // ─────────────────────────────────────────────────────────
    describe('Enum Validation', () => {
        it('should reject invalid role value', async () => {
            const user = new User({ name: 'Bad Role', email: 'badrole@example.com', password: 'Password123!', role: 'superadmin' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should reject invalid status value', async () => {
            const user = new User({ name: 'Bad Status', email: 'badstatus@example.com', password: 'Password123!', status: 'suspended' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should reject invalid authProvider value', async () => {
            const user = new User({ name: 'Bad Provider', email: 'badprovider@example.com', password: 'Password123!', authProvider: 'facebook' });
            try {
                await user.save();
                throw new Error('Expected save to throw');
            } catch (err) {
                expect(err).to.exist;
            }
        });

        it('should accept valid role values', async () => {
            const userRole = await User.create({ name: 'User Role', email: 'userrole@example.com', password: 'Password123!', role: 'user' });
            const adminRole = await User.create({ name: 'Admin Role', email: 'adminrole@example.com', password: 'Password123!', role: 'admin' });
            expect(userRole.role).to.equal('user');
            expect(adminRole.role).to.equal('admin');
        });
    });
});