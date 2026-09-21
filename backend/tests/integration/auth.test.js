// tests/integration/auth.test.js
import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import app from '../../app.js';
import User from '../../models/User.js';
import { setup, teardown } from '../setup.js';

describe('Auth Routes - /api/auth', () => {
  let sandbox;

  beforeEach(async () => {
    await setup();
    sandbox = sinon.createSandbox();
  });

  afterEach(async () => {
    sandbox.restore();
    await teardown();
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/signup
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    const validUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

    it('should register a new user and return 201', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      expect(res.statusCode).to.equal(201);
      expect(res.body.message).to.match(/registered successfully/i);
    });

    it('should reject duplicate local email with 400', async () => {
      await request(app).post('/api/auth/signup').send(validUser);

      const res = await request(app)
        .post('/api/auth/signup')
        .send(validUser);

      expect(res.statusCode).to.equal(400);
      expect(res.body.message).to.match(/already registered/i);
    });

    it('should reject signup if email belongs to a Google account', async () => {
      await User.create({
        name: 'Google User',
        email: 'google@example.com',
        authProvider: 'google',
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...validUser, email: 'google@example.com' });

      expect(res.statusCode).to.equal(400);
      expect(res.body.message).to.match(/registered with google/i);
    });

    it('should reject signup with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).to.equal(400);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/login
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
    });

    it('should login and return accessToken + set refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'Password123!' });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('accessToken');
      expect(res.body.user.email).to.equal('login@example.com');
      expect(res.headers['set-cookie']).to.exist;
    });

    it('should reject wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'WrongPass!' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/invalid credentials/i);
    });

    it('should reject non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' });

      expect(res.statusCode).to.equal(401);
    });

    it('should reject Google-only account trying to use password login', async () => {
      await User.create({
        name: 'Google Only',
        email: 'googleonly@example.com',
        authProvider: 'google',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'googleonly@example.com', password: 'anypassword' });

      expect(res.statusCode).to.equal(401);
      expect(res.body.message).to.match(/social login provider/i);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/logout
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('should logout and return 204', async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Logout User',
        email: 'logout@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logout@example.com', password: 'Password123!' });

      const cookies = loginRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(204);
    });

    it('should return 204 even without a cookie (graceful)', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.statusCode).to.equal(204);
    });
  });

  // ─────────────────────────────────────────────────────────
  // POST /api/auth/refresh-token
  // ─────────────────────────────────────────────────────────
  describe('POST /api/auth/refresh-token', () => {
    it('should return a new accessToken when refresh cookie is valid', async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Refresh User',
        email: 'refresh@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'refresh@example.com', password: 'Password123!' });

      const cookies = loginRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', cookies);

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('accessToken');
    });

    it('should return 401 when no refresh cookie is provided', async () => {
      const res = await request(app).post('/api/auth/refresh-token');
      expect(res.statusCode).to.equal(401);
    });

    it('should return 403 when refresh token is invalid/tampered', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', ['jwt_refresh=invalidtoken']);

      expect(res.statusCode).to.equal(403);
    });
  });

  // ─────────────────────────────────────────────────────────
  // GET /api/auth/google/init + GET /api/auth/google/callback
  //
  // Rewritten to match the actual OAuth2 Authorization Code flow
  // implemented in authController.js. The old tests here exercised
  // POST /api/auth/google with a raw access_token in the body — that
  // route does not exist; the real flow is:
  //   1. GET /google/init sets an oauth_state cookie and redirects
  //      to Google's consent screen.
  //   2. Google redirects back to GET /google/callback with
  //      ?code=...&state=...
  //   3. The callback verifies state against the oauth_state cookie,
  //      exchanges the code for a token (fetch #1), fetches userinfo
  //      with that token (fetch #2), then creates/logs in the user.
  // global.fetch is stubbed per-call (onCall(0)/onCall(1)) to mock
  // those two outbound requests. The real Google API is NOT called.
  // ─────────────────────────────────────────────────────────
  describe('GET /api/auth/google/init', () => {
    it('should set the oauth_state cookie and redirect to Google', async () => {
      const res = await request(app).get('/api/auth/google/init');

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.include('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.headers.location).to.include(`client_id=${process.env.GOOGLE_CLIENT_ID}`);
      expect(res.headers.location).to.match(/state=[0-9a-f]{64}/);

      const setCookie = res.headers['set-cookie'].join(';');
      expect(setCookie).to.match(/oauth_state=/);
    });
  });

  describe('GET /api/auth/google/callback', () => {
    const STATE = 'test-oauth-state-value';
    const withState = (req, state = STATE) => req.set('Cookie', `oauth_state=${state}`);

    const mockGoogleUserPayload = (overrides = {}) => ({
      name: 'Google User',
      email: 'googleuser@gmail.com',
      picture: 'https://lh3.googleusercontent.com/photo.jpg',
      email_verified: true,
      ...overrides,
    });

    // Stubs the two outbound fetch calls the callback makes, in order:
    // (0) POST token exchange, (1) GET userinfo.
    const mockGoogleExchange = ({
      tokenOk = true,
      userinfoOk = true,
      userPayload = mockGoogleUserPayload(),
    } = {}) => {
      const stub = sandbox.stub(global, 'fetch');
      stub.onCall(0).resolves({
        ok: tokenOk,
        status: tokenOk ? 200 : 400,
        text: async () => 'token exchange failed',
        json: async () => ({ access_token: 'fake-google-access-token' }),
      });
      stub.onCall(1).resolves({
        ok: userinfoOk,
        status: userinfoOk ? 200 : 401,
        json: async () => userPayload,
      });
      return stub;
    };

    it('should redirect to google_auth_failed when state does not match the oauth_state cookie', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ state: 'forged-state', code: 'irrelevant' })
        .set('Cookie', `oauth_state=${STATE}`);

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    });

    it('should redirect to google_auth_cancelled when Google reports an error', async () => {
      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, error: 'access_denied' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_auth_cancelled`);
    });

    it('should redirect to google_auth_failed when no code is returned', async () => {
      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    });

    it('should redirect to google_auth_failed when the token exchange with Google fails', async () => {
      mockGoogleExchange({ tokenOk: false });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    });

    it('should redirect to google_auth_failed when the userinfo request fails', async () => {
      mockGoogleExchange({ userinfoOk: false });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
    });

    it('should redirect to google_email_unverified when Google has not verified the email', async () => {
      mockGoogleExchange({ userPayload: mockGoogleUserPayload({ email_verified: false }) });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=google_email_unverified`);
    });

    it('should create a new Google user, set the refresh cookie, and redirect to the frontend', async () => {
      mockGoogleExchange({
        userPayload: mockGoogleUserPayload({ email: 'newgoogle@gmail.com', picture: 'https://pic.jpg' }),
      });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(process.env.FRONTEND_URL);
      expect(res.headers['set-cookie'].join(';')).to.match(/jwt_refresh=/);

      const createdUser = await User.findOne({ email: 'newgoogle@gmail.com' });
      expect(createdUser).to.exist;
      expect(createdUser.authProvider).to.equal('google');
      expect(createdUser.profilePictureUrl).to.equal('https://pic.jpg');
    });

    it('should log in an existing Google user and update their profile picture if changed', async () => {
      await User.create({
        name: 'Existing Google',
        email: 'existing@gmail.com',
        authProvider: 'google',
        profilePictureUrl: 'https://old-picture.jpg',
      });

      mockGoogleExchange({
        userPayload: mockGoogleUserPayload({
          name: 'Existing Google',
          email: 'existing@gmail.com',
          picture: 'https://new-picture.jpg',
        }),
      });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(process.env.FRONTEND_URL);

      const updatedUser = await User.findOne({ email: 'existing@gmail.com' });
      expect(updatedUser.profilePictureUrl).to.equal('https://new-picture.jpg');
    });

    it('should redirect to email_provider_conflict when the email is already registered with a password', async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Local User',
        email: 'local@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

      mockGoogleExchange({
        userPayload: mockGoogleUserPayload({ name: 'Local User', email: 'local@example.com' }),
      });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=email_provider_conflict`);
    });

    it('should redirect to account_banned for a banned Google user', async () => {
      await User.create({
        name: 'Banned Google',
        email: 'banned@gmail.com',
        authProvider: 'google',
        status: 'banned',
      });

      mockGoogleExchange({
        userPayload: mockGoogleUserPayload({ name: 'Banned Google', email: 'banned@gmail.com' }),
      });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/login?error=account_banned`);
    });

    it('should redirect an admin Google user to the admin panel', async () => {
      await User.create({
        name: 'Admin Google',
        email: 'admingoogle@gmail.com',
        authProvider: 'google',
        role: 'admin',
      });

      mockGoogleExchange({
        userPayload: mockGoogleUserPayload({ name: 'Admin Google', email: 'admingoogle@gmail.com' }),
      });

      const res = await withState(
        request(app).get('/api/auth/google/callback').query({ state: STATE, code: 'auth-code' })
      );

      expect(res.statusCode).to.equal(302);
      expect(res.headers.location).to.equal(`${process.env.FRONTEND_URL}/admin`);
    });
  });
});