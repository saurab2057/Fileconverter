// tests/integration/user.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import User from '../../models/User.js';
import FileHistory from '../../models/FileHistory.js';
import { setup, teardown } from '../setup.js';
import Session from '../../models/Session.js';


describe('User & History Routes - /api/user & /api/history', () => {
    let userToken;
    let testUser;

    beforeEach(async () => {
        await setup();

        const signupRes = await request(app)
            .post('/api/auth/signup')
            .send({
                name: 'Profile User',
                email: 'profile@example.com',
                password: 'Password123!',
                confirmPassword: 'Password123!',
            });

        console.log('📝 Signup Response:', signupRes.status, signupRes.body);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'profile@example.com', password: 'Password123!' });

        console.log('🔑 Login Response:', loginRes.status, loginRes.body);
        console.log('🔑 Token Received:', !!loginRes.body.accessToken);
        console.log('🔑 Token Length:', loginRes.body.accessToken?.length);

        userToken = loginRes.body.accessToken;
        testUser = loginRes.body.user;

        expect(loginRes.status).to.equal(200);
        expect(userToken).to.exist;
    });

    afterEach(async () => {
        await teardown();
    });

    describe('GET /api/user', () => {
        it('should get current user data with a valid token', async () => {
            console.log('📤 Sending token:', userToken?.slice(0, 20) + '...');

            const res = await request(app)
                .get('/api/user/profile')
                .set('Authorization', `Bearer ${userToken}`);

            console.log('📥 Response:', res.status, res.body);

            expect(res.statusCode).to.equal(200);
            expect(res.body.email).to.equal('profile@example.com');
        });
    });

    describe('PUT /api/user/profile', () => {
        it('should update the user name', async () => {
            const res = await request(app)
                .put('/api/user/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'Updated Name' });

            console.log('📥 Profile Update Response:', res.status, res.body);

            expect(res.statusCode).to.equal(200);
            expect(res.body.user.name).to.equal('Updated Name');
        });
    });

    describe('GET /api/history', () => {
        it('should return the user conversion history', async () => {
            const history1 = new FileHistory({
                userId: testUser.id,
                filename: 'file1.mp4',
                format: 'mp4',
                sizeInBytes: 12345,
            });
            await history1.save();
            await User.findByIdAndUpdate(testUser.id, {
                $push: { fileHistory: history1._id },
            });

            const res = await request(app)
                .get('/api/history')
                .set('Authorization', `Bearer ${userToken}`);

            console.log('📥 History Response:', res.status, res.body);

            expect(res.statusCode).to.equal(200);
            expect(res.body.history).to.be.an('array');           // ← FIXED
            expect(res.body.history).to.have.lengthOf(1);         // ← FIXED
        });
    });

    // ─────────────────────────────────────────────────────────
    // POST /api/user/change-password
    // ─────────────────────────────────────────────────────────
    describe('POST /api/user/change-password', () => {
        it('should change password and revoke all sessions', async () => {
            const res = await request(app)
                .post('/api/user/change-password')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'Password123!',
                    newPassword: 'NewPass456!',
                    confirmNewPassword: 'NewPass456!',
                });

            expect(res.statusCode).to.equal(200);
            expect(res.body.message).to.match(/password changed successfully/i);
            expect(res.body.logoutRequired).to.be.true;

            // Check sessions are deleted
            const sessions = await Session.find({ user: testUser.id });
            expect(sessions.length).to.equal(0);

            // Old password should not work
            const oldLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'profile@example.com', password: 'Password123!' });
            expect(oldLogin.statusCode).to.equal(401);

            // New password should work
            const newLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'profile@example.com', password: 'NewPass456!' });
            expect(newLogin.statusCode).to.equal(200);
        });

        it('should reject wrong current password', async () => {
            const res = await request(app)
                .post('/api/user/change-password')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'WrongPassword!',
                    newPassword: 'NewPass456!',
                    confirmNewPassword: 'NewPass456!',
                });
            expect(res.statusCode).to.equal(401);
            expect(res.body.message).to.match(/current password is incorrect/i);
        });

        it('should reject if new password is same as current', async () => {
            const res = await request(app)
                .post('/api/user/change-password')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'Password123!',
                    newPassword: 'Password123!',
                    confirmNewPassword: 'Password123!',
                });
            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/must be different/i);
        });

        it('should reject weak new password (validation)', async () => {
            const res = await request(app)
                .post('/api/user/change-password')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'Password123!',
                    newPassword: 'weak',
                    confirmNewPassword: 'weak',
                });
            expect(res.statusCode).to.equal(400);
            expect(res.body).to.have.property('errors');
        });

        it('should reject for Google users', async () => {
            // Create a Google user
            await User.create({
                name: 'Google User',
                email: 'googleuser@example.com',
                authProvider: 'google',
            });
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: 'googleuser@example.com', password: 'any' }); // won't work, but we need token?
            // Actually we need a token for a Google user; we can create one by mocking Google auth, but easier: just use a user with authProvider='google' and login with Google route.
            // For simplicity, we'll test the controller directly? Better to use the auth route: we can mock Google login.
            // Or we can create a user and set its authProvider to 'google' and then login using the Google route (which requires mock).
            // We'll skip this test for brevity; you can add it if needed.
            // Instead, we'll test by creating a Google user and trying to change password with an admin? No.
            // The controller checks user.authProvider === 'email' so we can just test that.
            // We'll directly modify the user's authProvider to 'google' and then attempt.
            await User.findByIdAndUpdate(testUser.id, { authProvider: 'google' });
            const res = await request(app)
                .post('/api/user/change-password')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    currentPassword: 'Password123!',
                    newPassword: 'NewPass456!',
                    confirmNewPassword: 'NewPass456!',
                });
            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/not available for google accounts/i);
        });
    });
});