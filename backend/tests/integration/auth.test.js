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
// POST /api/auth/google
// Uses mocked Google userinfo endpoint.
// The real Google API is NOT called during tests.
// ─────────────────────────────────────────────────────────
describe('POST /api/auth/google', () => {

  const mockGoogleUser = ({
    name = 'Google User',
    email = 'googleuser@gmail.com',
    picture = 'https://lh3.googleusercontent.com/photo.jpg',
    sub = 'google-test-user-123',
    email_verified = true,
  } = {}) => ({
    sub,
    name,
    email,
    picture,
    email_verified,
  });

  const mockGoogleSuccess = (user = mockGoogleUser()) => {
    sandbox.stub(global, 'fetch').resolves({
      ok: true,
      status: 200,
      json: async () => user,
    });
  };

  const mockGoogleFailure = (status = 401) => {
    sandbox.stub(global, 'fetch').resolves({
      ok: false,
      status,
      json: async () => ({
        error: 'invalid_token',
      }),
    });
  };


  it('should create a new Google user and return accessToken', async () => {

    mockGoogleSuccess(
      mockGoogleUser({
        name: 'Google User',
        email: 'googleuser@gmail.com',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      })
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'fake-google-access-token',
      });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('accessToken');
    expect(res.body.user.email).to.equal('googleuser@gmail.com');
    expect(res.body.user.authProvider).to.equal('google');

    const createdUser = await User.findOne({
      email: 'googleuser@gmail.com',
    });

    expect(createdUser).to.exist;
    expect(createdUser.authProvider).to.equal('google');
    expect(createdUser.profilePictureUrl)
      .to.equal('https://lh3.googleusercontent.com/photo.jpg');
  });


  it('should login existing Google user and update profile picture if changed', async () => {

    await User.create({
      name: 'Existing Google',
      email: 'existing@gmail.com',
      authProvider: 'google',
      profilePictureUrl: 'https://old-picture.jpg',
    });

    mockGoogleSuccess(
      mockGoogleUser({
        name: 'Existing Google',
        email: 'existing@gmail.com',
        picture: 'https://new-picture.jpg',
      })
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'fake-google-access-token',
      });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('accessToken');

    const updatedUser = await User.findOne({
      email: 'existing@gmail.com',
    });

    expect(updatedUser).to.exist;
    expect(updatedUser.profilePictureUrl)
      .to.equal('https://new-picture.jpg');
  });


  it('should block Google login if email is registered as local account', async () => {

    await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Local User',
        email: 'local@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    mockGoogleSuccess(
      mockGoogleUser({
        name: 'Local User',
        email: 'local@example.com',
        picture: 'https://picture.jpg',
      })
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'fake-google-access-token',
      });

    expect(res.statusCode).to.equal(400);
    expect(res.body.message)
      .to.match(/registered with a password/i);
  });


  it('should block suspended Google user from logging in', async () => {

    await User.create({
      name: 'Banned Google',
      email: 'banned@gmail.com',
      authProvider: 'google',
      status: 'banned',
    });

    mockGoogleSuccess(
      mockGoogleUser({
        name: 'Banned Google',
        email: 'banned@gmail.com',
        picture: 'https://picture.jpg',
      })
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'fake-google-access-token',
      });

    expect(res.statusCode).to.equal(403);
    expect(res.body.message).to.match(/banned/i);
  });


  it('should return 400 if no access_token is provided', async () => {

    const res = await request(app)
      .post('/api/auth/google')
      .send({});

    expect(res.statusCode).to.equal(400);
    expect(res.body.message).to.match(/missing/i);
  });


  it('should return 401 if Google token is invalid', async () => {

    mockGoogleFailure(401);

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'bad-google-token',
      });

    expect(res.statusCode).to.equal(401);
    expect(res.body.message)
      .to.match(/invalid|expired|authentication failed/i);
  });


  it('should return 401 if Google userinfo request fails', async () => {

    mockGoogleFailure(500);

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'google-server-error-token',
      });

    expect(res.statusCode).to.equal(401);
  });


  it('should return 401 if Google email is not verified', async () => {

    mockGoogleSuccess(
      mockGoogleUser({
        email: 'unverified@gmail.com',
        email_verified: false,
      })
    );

    const res = await request(app)
      .post('/api/auth/google')
      .send({
        access_token: 'unverified-google-token',
      });

    expect(res.statusCode).to.equal(401);
    expect(res.body.message)
      .to.match(/not verified/i);
  });

});
});