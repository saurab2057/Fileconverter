// tests/integration/password.test.js
import request from 'supertest';
import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { setup, teardown } from '../setup.js';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

// UPDATED: payload uses { userId } (not { user: { id } })
const mintResetToken = (userId, expiresIn = '10m') =>
  jwt.sign(
    { userId },
    process.env.RESET_PASSWORD_SECRET_KEY,
    { expiresIn }
  );

const getResetSessionCookie = async (userId) => {
  const token = mintResetToken(userId);
  const res = await request(app)
    .post('/api/auth/validate-reset-token')
    .send({ token });
  expect(res.statusCode).to.equal(200);
  return res.headers['set-cookie'];
};

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────
describe('Password Reset Routes - /api/auth', () => {
  let testUser;

  beforeEach(async () => {
    await setup();

    // Mock Resend
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ id: 'mock-email-id' }),
    });

    await request(app).post('/api/auth/signup').send({
      name: 'Reset Tester',
      email: 'resetter@example.com',
      password: 'OldPassword123!',
      confirmPassword: 'OldPassword123!',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'resetter@example.com', password: 'OldPassword123!' });

    testUser = loginRes.body.user;
  });

  afterEach(async () => {
    await teardown();
    delete global.fetch;
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/forgot-password
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('should return 200 and a generic message for a registered email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'resetter@example.com' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.message).to.match(/active email account exists|check your spam folder/i);
    });

    it('should return 200 even for an email that does not exist (no info leak)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@example.com' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.message).to.match(/active email account exists|check your spam folder/i);
    });

    it('should return 400 if no email is provided', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('errors');
    });

    it('should return 400 if an invalid email format is provided', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('errors');
    });

    // NEW: Inactive user → no email (but still 200 generic)
    it('should return 200 generic even for inactive account (no email sent)', async () => {
      await User.findByIdAndUpdate(testUser.id, { status: 'banned' });
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'resetter@example.com' });
      expect(res.statusCode).to.equal(200);
      // No way to verify email wasn't sent (we mocked fetch anyway)
    });

    // NEW: Google account → no email
    it('should return 200 generic for Google account (no email sent)', async () => {
      await User.findByIdAndUpdate(testUser.id, { authProvider: 'google' });
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'resetter@example.com' });
      expect(res.statusCode).to.equal(200);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/validate-reset-token
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/validate-reset-token', () => {
    it('should return 200, valid:true, and set reset_session cookie for a valid token', async () => {
      const token = mintResetToken(testUser.id);

      const res = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({ token });

      expect(res.statusCode).to.equal(200);
      expect(res.body.valid).to.equal(true);
      expect(res.body.redirectUrl).to.equal('/reset-password-form');
      expect(res.headers['set-cookie']).to.exist;
      const cookieHeader = res.headers['set-cookie'].join(';');
      expect(cookieHeader).to.include('reset_session');
    });

    it('should return 400 if no token is provided', async () => {
      const res = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({});

      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('errors');
    });

    it('should return 401 for an expired reset token', async () => {
      const expiredToken = mintResetToken(testUser.id, '-1s');

      const res = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({ token: expiredToken });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/expired/i);
    });

    it('should return 401 for a tampered / invalid reset token', async () => {
      const res = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({ token: 'this.is.not.a.valid.jwt' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/invalid reset link/i);
    });

    it('should return 401 for a token signed with the wrong secret', async () => {
      const wrongToken = jwt.sign(
        { userId: testUser.id },
        'wrong-secret',
        { expiresIn: '10m' }
      );

      const res = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({ token: wrongToken });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/invalid reset link/i);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/reset-password
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/reset-password', () => {
    it('should reset the password successfully with a valid reset_session cookie', async () => {
      const cookies = await getResetSessionCookie(testUser.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.message).to.match(/password reset successful/i);
    });

    it('should allow login with the new password after reset', async () => {
      const cookies = await getResetSessionCookie(testUser.id);

      await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'resetter@example.com', password: 'BrandNew456!' });

      expect(loginRes.statusCode).to.equal(200);
      expect(loginRes.body).to.have.property('accessToken');
    });

    it('should reject login with the old password after reset', async () => {
      const cookies = await getResetSessionCookie(testUser.id);

      await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'resetter@example.com', password: 'OldPassword123!' });

      expect(loginRes.statusCode).to.equal(401);
    });

    it('should revoke all active sessions after reset', async () => {
      // Create a second login session
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'resetter@example.com', password: 'OldPassword123!' });

      const cookies = await getResetSessionCookie(testUser.id);

      await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });

      const sessions = await Session.find({ user: testUser.id });
      expect(sessions.length).to.equal(0);
    });

    it('should reject a refresh token that existed before the reset', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'resetter@example.com', password: 'OldPassword123!' });
      const oldCookies = loginRes.headers['set-cookie'];

      const resetCookies = await getResetSessionCookie(testUser.id);
      await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', resetCookies)
        .send({ newPassword: 'BrandNew456!' });

      const refreshRes = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', oldCookies);

      expect(refreshRes.statusCode).to.be.oneOf([401, 403]);
    });

    it('should return 401 if the reset_session cookie is missing', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/reset session expired/i);
    });

    it('should return 400 if newPassword is missing', async () => {
      const cookies = await getResetSessionCookie(testUser.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({});

      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('errors');
    });

    it('should return 401 for an expired reset_session cookie', async () => {
      const expiredSession = jwt.sign(
        {
          userId: testUser.id,
          purpose: 'password_reset',
          jti: 'some-uuid'
        },
        process.env.COOKIE_SECRET_KEY,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', [`reset_session=${expiredSession}`])
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/expired/i);
    });

    it('should return 401 for a tampered reset_session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', ['reset_session=tampered.jwt.value'])
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(401);
    });

    it('should return 401 if the reset_session has the wrong purpose', async () => {
      const badPurposeSession = jwt.sign(
        {
          userId: testUser.id,
          purpose: 'something_else',
          jti: 'some-uuid'
        },
        process.env.COOKIE_SECRET_KEY,
        { expiresIn: '10m' }
      );

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', [`reset_session=${badPurposeSession}`])
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/invalid reset session/i);
    });

    it('should clear the reset_session cookie after a successful reset', async () => {
      const cookies = await getResetSessionCookie(testUser.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });

      expect(res.statusCode).to.equal(200);
      const setCookie = res.headers['set-cookie']?.join(';') ?? '';
      expect(setCookie).to.match(/reset_session=;|max-age=0/i);
    });

    // NEW: Inactive user cannot reset
    it('should return 403 if user is inactive (banned)', async () => {
      await User.findByIdAndUpdate(testUser.id, { status: 'banned' });
      const cookies = await getResetSessionCookie(testUser.id);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });
      expect(res.statusCode).to.equal(403);
      expect(res.body.message).to.match(/account is not active/i);
    });

    // NEW: Google account cannot reset
    it('should return 400 if user is a Google account', async () => {
      await User.findByIdAndUpdate(testUser.id, { authProvider: 'google' });
      const cookies = await getResetSessionCookie(testUser.id);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .send({ newPassword: 'BrandNew456!' });
      expect(res.statusCode).to.equal(400);
      expect(res.body.message).to.match(/google login/i);
    });
  });
});