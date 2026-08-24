// tests/integration/admin.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { setup, teardown } from '../setup.js';

describe('Admin Routes - /api/admin', () => {
    let adminToken;
    let adminUser;
    let regularUserToken;
    let regularUser;

    beforeEach(async () => {
        await setup();

        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'Password123!',
            role: 'admin',
            status: 'active',
            authProvider: 'email',
        });
        adminUser = admin;

        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@example.com', password: 'Password123!' });
        adminToken = adminLogin.body.accessToken;

        await request(app).post('/api/auth/signup').send({
            name: 'Regular User',
            email: 'regular@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
        });
        const userLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'regular@example.com', password: 'Password123!' });
        regularUserToken = userLogin.body.accessToken;
        regularUser = userLogin.body.user;
    });

    afterEach(async () => {
        await teardown();
    });

    // ─────────────────────────────────────────────────────────
    // ACCESS CONTROL
    // ─────────────────────────────────────────────────────────
    describe('Access Control', () => {
        it('should reject unauthenticated requests with 401', async () => {
            const res = await request(app).get('/api/admin/stats');
            expect(res.statusCode).to.equal(401);
        });

        it('should reject non-admin users with 403', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${regularUserToken}`);
            expect(res.statusCode).to.equal(403);
        });
    });

    // ─────────────────────────────────────────────────────────
    // GET /api/admin/stats
    // ─────────────────────────────────────────────────────────
    describe('GET /api/admin/stats', () => {
        it('should return dashboard stats for admin', async () => {
            const res = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('totalUsers');
            expect(res.body).to.have.property('successfulJobs');
            expect(res.body).to.have.property('serverLoad');
        });
    });

    // ─────────────────────────────────────────────────────────
    // GET /api/admin/users
    // ─────────────────────────────────────────────────────────
    describe('GET /api/admin/users', () => {
        it('should return paginated list of users', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('users');
            expect(res.body).to.have.property('pagination');
            expect(res.body.users).to.be.an('array');
        });

        it('should support search by email', async () => {
            const res = await request(app)
                .get('/api/admin/users?search=regular@example.com')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.users.length).to.be.above(0);
            expect(res.body.users[0].email).to.equal('regular@example.com');
        });

        it('should return empty results for non-matching search', async () => {
            const res = await request(app)
                .get('/api/admin/users?search=nonexistent@example.com')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.users.length).to.equal(0);
        });

        it('should not expose passwords in user list', async () => {
            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            res.body.users.forEach(user => {
                expect(user).to.not.have.property('password');
            });
        });
    });

    // ─────────────────────────────────────────────────────────
    // PUT /api/admin/users/:id
    // ─────────────────────────────────────────────────────────
    describe('PUT /api/admin/users/:id', () => {
        it('should ban a user and revoke their sessions', async () => {
            const res = await request(app)
                .put(`/api/admin/users/${regularUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'banned' });

            expect(res.statusCode).to.equal(200);
            expect(res.body.user.status).to.equal('banned');

            const sessions = await Session.find({ user: regularUser.id });
            expect(sessions.length).to.equal(0);
        });

        it('should promote a user to admin role', async () => {
            const res = await request(app)
                .put(`/api/admin/users/${regularUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'admin' });

            expect(res.statusCode).to.equal(200);
            expect(res.body.user.role).to.equal('admin');
        });

        it('should prevent admin from modifying their own account', async () => {
            const res = await request(app)
                .put(`/api/admin/users/${adminUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'banned' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/cannot modify your own/i);
        });

        it('should prevent demoting the last admin', async () => {
            await request(app)
                .put(`/api/admin/users/${regularUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'admin' });

            const demoteRes = await request(app)
                .put(`/api/admin/users/${regularUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'user' });

            expect(demoteRes.statusCode).to.equal(200);
        });

        it('should return 400 for invalid user ID format', async () => {
            const res = await request(app)
                .put('/api/admin/users/not-a-valid-id')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'banned' });

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/invalid user id/i);
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
            const res = await request(app)
                .put(`/api/admin/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'banned' });

            expect(res.statusCode).to.equal(404);
        });
    });

    // ─────────────────────────────────────────────────────────
    // DELETE /api/admin/users/:id
    // ─────────────────────────────────────────────────────────
    describe('DELETE /api/admin/users/:id', () => {
        it('should permanently delete a user', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${regularUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body.message).to.match(/permanently deleted/i);

            const deletedUser = await User.findById(regularUser.id);
            expect(deletedUser).to.be.null;
        });

        it('should prevent admin from deleting their own account', async () => {
            const res = await request(app)
                .delete(`/api/admin/users/${adminUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(400);
            expect(res.body.message).to.match(/cannot delete your own/i);
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '64f1a2b3c4d5e6f7a8b9c0d1';
            const res = await request(app)
                .delete(`/api/admin/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(404);
        });
    });

    // ─────────────────────────────────────────────────────────
    // DELETE /api/admin/audit-logs/:id
    // ─────────────────────────────────────────────────────────
    describe('DELETE /api/admin/audit-logs/:id', () => {
        it('should always return 403 — audit logs are immutable', async () => {
            const res = await request(app)
                .delete('/api/admin/audit-logs/someid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(403);
            expect(res.body.message).to.match(/immutable/i);
        });
    });

    // ─────────────────────────────────────────────────────────
    // GET /api/admin/jobs
    // ─────────────────────────────────────────────────────────
    describe('GET /api/admin/jobs', () => {
        it('should return paginated jobs list', async () => {
            const res = await request(app)
                .get('/api/admin/jobs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.have.property('jobs');
            expect(res.body).to.have.property('pagination');
        });
    });
});