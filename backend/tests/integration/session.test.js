// tests/integration/session.test.js
import request from 'supertest';
import { expect } from 'chai';
import app from '../../app.js';
import Session from '../../models/Session.js';
import User from '../../models/User.js';
import { setup, teardown } from '../setup.js';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const registerAndLogin = async (
  email = 'session@example.com',
  password = 'Password123!',
  name = 'Session User',
  userAgent = 'Mozilla/5.0 (Test)'
) => {
  await request(app)
    .post('/api/auth/signup')
    .set('User-Agent', userAgent)
    .send({ name, email, password, confirmPassword: password });

  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password });

  return {
    accessToken: loginRes.body.accessToken,
    cookies: loginRes.headers['set-cookie'],
    user: loginRes.body.user,
    userAgent,
  };
};

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────
describe('Session Routes - /api/auth & /api/user/sessions', () => {
  let accessToken;
  let cookies;
  let user;

  beforeEach(async () => {
    await setup();
    ({ accessToken, cookies, user } = await registerAndLogin());
  });

  afterEach(async () => {
    await teardown();
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/refresh-token — edge cases
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/refresh-token — edge cases', () => {
    it('should rotate the refresh token: old cookie rejected after refresh', async () => {
      const originalCookies = [...cookies];

      const refreshRes = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', originalCookies);
      expect(refreshRes.statusCode).to.equal(200);

      const reuseRes = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', originalCookies);

      expect(reuseRes.statusCode).to.equal(403);
      expect(reuseRes.body.message).to.match(/token reuse detected/i);
    });

    it('should revoke ALL sessions when token reuse is detected', async () => {
      const secondLogin = await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );
      const secondCookies = secondLogin.cookies;

      // Consume the first refresh token
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);

      // Replay it — triggers reuse detection and nukes all sessions
      await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);

      const secondRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', secondCookies);

      expect(secondRefresh.statusCode).to.be.oneOf([401, 403]);
    });

    it('should return user info alongside the new accessToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      expect(res.body).to.have.property('user');
      expect(res.body.user.email).to.equal('session@example.com');
    });

    it('should return 403 and revoke sessions if user is banned between refreshes', async () => {
      await User.findByIdAndUpdate(user.id, { status: 'banned' });

      const refreshRes = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);

      expect(refreshRes.statusCode).to.equal(403);
      expect(refreshRes.body.message).to.match(/inactive|not found/i);
    });

    // ✅ FIXED: Uses the real password‑change endpoint and expects token‑reuse detection
    it('should reject refresh after password change', async () => {
      // Change password via the actual endpoint (deletes all sessions)
      const changeRes = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPass456!',
          confirmNewPassword: 'NewPass456!',
        });
      expect(changeRes.statusCode).to.equal(200);

      // Try to refresh with the old cookie – session is gone, so token reuse detection fires
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);
      expect(res.statusCode).to.equal(403);
      expect(res.body.message).to.match(/token reuse detected|all sessions revoked/i);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/logout-all
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/logout-all', () => {
    it('should return 204 and revoke all sessions for the user', async () => {
      const secondLogin = await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );

      const sessionsBefore = await Session.find({ user: user.id });
      expect(sessionsBefore.length).to.equal(2);

      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(204);

      const sessionsAfter = await Session.find({ user: user.id });
      expect(sessionsAfter.length).to.equal(0);
    });

    it('should clear the jwt_refresh cookie in the response', async () => {
      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(204);
      const setCookie = res.headers['set-cookie']?.join(';') ?? '';
      expect(setCookie).to.match(/jwt_refresh=;|max-age=0/i);
    });

    it('should make all existing refresh tokens invalid after logout-all', async () => {
      const secondLogin = await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );
      const secondCookies = secondLogin.cookies;

      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const firstRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);
      const secondRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', secondCookies);

      expect(firstRefresh.statusCode).to.be.oneOf([401, 403]);
      expect(secondRefresh.statusCode).to.be.oneOf([401, 403]);
    });

    it('should return 401 without an auth token', async () => {
      const res = await request(app).post('/api/auth/logout-all');
      expect(res.statusCode).to.equal(401);
    });

    it('should not affect sessions belonging to other users', async () => {
      const otherLogin = await registerAndLogin(
        'other@example.com',
        'Password123!',
        'Other User',
        'Mozilla/5.0 (Other)'
      );

      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const otherRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', otherLogin.cookies);

      expect(otherRefresh.statusCode).to.equal(200);
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /api/auth/sessions
  // ─────────────────────────────────────────────────────────
  describe('GET /api/auth/sessions', () => {
    it('should return an object with a sessions array', async () => {
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('sessions');
      expect(res.body.sessions).to.be.an('array');
    });

    it('should return one session after a single login', async () => {
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body.sessions.length).to.equal(1);
    });

    it('should return multiple sessions after multiple logins from different devices', async () => {
      await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );

      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body.sessions.length).to.equal(2);
    });

    it('should mark exactly one session as current (the one matching the refresh cookie)', async () => {
      await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );

      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      const currentSessions = res.body.sessions.filter(s => s.current === true);
      expect(currentSessions.length).to.equal(1);
    });

    it('should include required fields on each session object', async () => {
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      const session = res.body.sessions[0];
      expect(session).to.have.property('id');
      expect(session).to.have.property('device');
      expect(session).to.have.property('ipHash');
      expect(session).to.have.property('createdAt');
      expect(session).to.have.property('lastActive');
      expect(session).to.have.property('current');
    });

    it('should not expose the raw jti in session list', async () => {
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      res.body.sessions.forEach(session => {
        expect(session).to.not.have.property('jti');
      });
    });

    it('should only return sessions for the authenticated user', async () => {
      await registerAndLogin('other@example.com', 'Password123!', 'Other User');

      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body.sessions.length).to.equal(1);
    });

    it('should return 401 without an auth token', async () => {
      const res = await request(app).get('/api/auth/sessions');
      expect(res.statusCode).to.equal(401);
    });
  });

  // ─────────────────────────────────────────────────────────
  // DELETE /api/auth/sessions/:sessionId
  // ─────────────────────────────────────────────────────────
  describe('DELETE /api/auth/sessions/:sessionId', () => {
    it('should return 204 and remove the target session', async () => {
      const listRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const sessionId = listRes.body.sessions[0].id;

      const res = await request(app)
        .delete(`/api/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).to.equal(204);

      const remaining = await Session.findById(sessionId);
      expect(remaining).to.be.null;
    });

    it('should make the revoked session\'s refresh token invalid', async () => {
      const secondLogin = await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );
      const secondCookies = secondLogin.cookies;

      const listRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const secondSession = listRes.body.sessions.find(s => s.current === false);
      expect(secondSession).to.exist;

      await request(app)
        .delete(`/api/auth/sessions/${secondSession.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const refreshRes = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', secondCookies);

      expect(refreshRes.statusCode).to.be.oneOf([401, 403]);
    });

    it('should return 404 for a session ID that does not exist', async () => {
      const fakeSessionId = '64f1a2b3c4d5e6f7a8b9c0d1';

      const res = await request(app)
        .delete(`/api/auth/sessions/${fakeSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).to.equal(404);
      expect(res.body.message).to.match(/session not found/i);
    });

    it('should return 404 when trying to revoke another user\'s session', async () => {
      const otherLogin = await registerAndLogin('other@example.com', 'Password123!', 'Other User');
      const otherToken = otherLogin.accessToken;

      const otherListRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Cookie', otherLogin.cookies);

      const otherSessionId = otherListRes.body.sessions[0].id;

      const res = await request(app)
        .delete(`/api/auth/sessions/${otherSessionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).to.equal(404);
    });

    it('should not affect other active sessions when one is revoked', async () => {
      const secondLogin = await registerAndLogin(
        'session@example.com',
        'Password123!',
        'Session User',
        'Mozilla/5.0 (Second Device)'
      );
      const secondCookies = secondLogin.cookies;

      const listRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const currentSession = listRes.body.sessions.find(s => s.current === true);
      expect(currentSession).to.exist;

      await request(app)
        .delete(`/api/auth/sessions/${currentSession.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const secondRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', secondCookies);

      expect(secondRefresh.statusCode).to.equal(200);
    });

    it('should return 401 without an auth token', async () => {
      const listRes = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies);

      const sessionId = listRes.body.sessions[0].id;

      const res = await request(app)
        .delete(`/api/auth/sessions/${sessionId}`);

      expect(res.statusCode).to.equal(401);
    });
  });
});