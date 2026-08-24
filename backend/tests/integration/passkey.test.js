// tests/integration/passkey.test.js

import request from 'supertest';
import { expect } from 'chai';

import app from '../../app.js';
import Passkey from '../../models/Passkey.js';

import {
  __setWebAuthnTestVerifiers,
  __resetWebAuthnTestVerifiers,
} from '../../controllers/Authentication/passkeyController.js';

import { setup, teardown } from '../setup.js';


describe('Passkey Routes', () => {
  let userToken;
  let testUserEmail = 'passkeytest@example.com';
  let userId;

  // ─────────────────────────────────────────────────────────────
  // TEST USER SETUP
  // ─────────────────────────────────────────────────────────────

  beforeEach(async () => {
    await setup();

    await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Passkey Test User',
        email: testUserEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: 'Password123!',
      });

    expect(loginRes.statusCode).to.equal(200);

    userToken = loginRes.body.accessToken;
    userId = loginRes.body.user.id;
  });


  afterEach(async () => {
    // Always restore the real WebAuthn implementation.
    __resetWebAuthnTestVerifiers();

    await teardown();
  });


  // ─────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────

  const validRegistrationVerification = ({
    credentialId = 'mock-new-credential',
    publicKey = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]),
    counter = 0,
  } = {}) => ({
    verified: true,

    registrationInfo: {
      credential: {
        id: credentialId,
        publicKey,
        counter,
      },
    },
  });


  // ─────────────────────────────────────────────────────────────
  // REGISTRATION FLOW
  // ─────────────────────────────────────────────────────────────

  describe(
    'POST /api/passkeys/register/start (startRegistration)',
    () => {

      it(
        'should return registration options for logged-in user',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/register/start')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            );

          expect(res.statusCode).to.equal(200);

          expect(res.body)
            .to.have.property('challenge');

          expect(res.body)
            .to.have.property('rp');

          expect(res.body)
            .to.have.property('user');

          expect(res.body)
            .to.have.property('excludeCredentials');

          expect(res.body)
            .to.have.property('authenticatorSelection');
        }
      );


      it(
        'should return 401 without auth token',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/register/start');

          expect(res.statusCode).to.equal(401);
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // REGISTRATION FINISH
  // ─────────────────────────────────────────────────────────────

  describe(
    'POST /api/passkeys/register/finish (verifyRegistration)',
    () => {

      it(
        'should return 400 if no challenge cookie is present',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/register/finish')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .send({
              response: {
                id: 'dummy',
              },
            });

          expect(res.statusCode).to.equal(400);

          expect(res.body.message)
            .to.include('Registration session expired');
        }
      );


      // ─────────────────────────────────────────────────────────
      // DUPLICATE DEVICE TEST
      // ─────────────────────────────────────────────────────────

      it(
        'should reject registration with duplicate deviceName',
        async () => {

          const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0.0.0 Safari/537.36';


          // Existing passkey for this browser/OS.
          await Passkey.create({
            user: userId,

            credentialID:
              'existing-credential-id',

            credentialPublicKey:
              'existing-public-key',

            deviceName:
              'Chrome on Windows',

            label:
              'Chrome on Windows',

            deviceType:
              'desktop',
          });


          // Mock ONLY the cryptographic WebAuthn verification.
          //
          // The real route/controller will still:
          //
          // 1. read the challenge cookie
          // 2. authenticate the JWT
          // 3. call verifyRegistrationResponse()
          // 4. inspect registrationInfo
          // 5. parse User-Agent
          // 6. check duplicate deviceName
          // 7. return HTTP 400
          __setWebAuthnTestVerifiers({
            registration: async () => {
              return validRegistrationVerification({
                credentialId:
                  'brand-new-credential-id',
              });
            },
          });


          const agent = request.agent(app);


          // Start registration first so the challenge cookie
          // is created.
          const startRes = await agent
            .post('/api/passkeys/register/start')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .set(
              'User-Agent',
              userAgent
            );


          expect(startRes.statusCode)
            .to.equal(200);


          // Finish registration with a dummy response.
          // The cryptographic verification is mocked above.
          const finishRes = await agent
            .post('/api/passkeys/register/finish')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .set(
              'User-Agent',
              userAgent
            )
            .send({
              response: {
                id: 'mock-response-id',
              },
            });


          expect(finishRes.statusCode)
            .to.equal(400);


          expect(finishRes.body.message)
            .to.match(/already registered/i);


          // Make sure no second passkey was created.
          const passkeys = await Passkey.find({
            user: userId,
          });

          expect(passkeys)
            .to.have.length(1);
        }
      );


      // ─────────────────────────────────────────────────────────
      // MAX 5 PASSKEYS TEST
      // ─────────────────────────────────────────────────────────

      it(
        'should reject 6th passkey',
        async () => {

          const userAgent =
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0.0.0 Mobile Safari/537.36';


          // Create five existing passkeys.
          //
          // IMPORTANT:
          // Their deviceName values must be different because the
          // controller also prevents duplicate deviceName.
          for (let i = 0; i < 5; i++) {

            await Passkey.create({
              user: userId,

              credentialID:
                `existing-credential-${i}`,

              credentialPublicKey:
                `existing-public-key-${i}`,

              deviceName:
                `Existing Device ${i}`,

              label:
                `Existing Device ${i}`,

              deviceType:
                'desktop',
            });
          }


          const countBefore =
            await Passkey.countDocuments({
              user: userId,
            });

          expect(countBefore)
            .to.equal(5);


          // Mock WebAuthn verification so the request gets
          // through the cryptographic verification stage.
          __setWebAuthnTestVerifiers({
            registration: async () => {
              return validRegistrationVerification({
                credentialId:
                  'sixth-passkey-credential',
              });
            },
          });


          const agent = request.agent(app);


          // Start registration.
          const startRes = await agent
            .post('/api/passkeys/register/start')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .set(
              'User-Agent',
              userAgent
            );


          expect(startRes.statusCode)
            .to.equal(200);


          // Finish registration.
          const finishRes = await agent
            .post('/api/passkeys/register/finish')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            )
            .set(
              'User-Agent',
              userAgent
            )
            .send({
              response: {
                id: 'mock-sixth-passkey',
              },
            });


          expect(finishRes.statusCode)
            .to.equal(400);


          expect(finishRes.body.message)
            .to.match(/maximum of 5 passkeys/i);


          // Verify that the sixth passkey was NOT inserted.
          const countAfter =
            await Passkey.countDocuments({
              user: userId,
            });

          expect(countAfter)
            .to.equal(5);
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // AUTHENTICATION FLOW
  // ─────────────────────────────────────────────────────────────

  describe(
    'POST /api/passkeys/login/start (startAuthentication)',
    () => {

      it(
        'should return 404 when user has no passkeys',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/login/start')
            .send({
              email: testUserEmail,
            });

          expect(res.statusCode)
            .to.equal(404);

          expect(res.body.message)
            .to.match(/no passkey found/i);
        }
      );


      it(
        'should return authentication options for user with passkeys',
        async () => {

          await Passkey.create({
            user: userId,

            credentialID:
              'cred-auth',

            credentialPublicKey:
              'key-auth',

            deviceName:
              'Chrome',

            label:
              'Chrome',

            deviceType:
              'desktop',
          });


          const res = await request(app)
            .post('/api/passkeys/login/start')
            .send({
              email: testUserEmail,
            });


          expect(res.statusCode)
            .to.equal(200);


          expect(res.body)
            .to.have.property('challenge');


          expect(res.body)
            .to.have.property('allowCredentials');


          expect(res.body.allowCredentials)
            .to.have.length(1);
        }
      );


      it(
        'should return 404 for non-existent email (generic)',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/login/start')
            .send({
              email: 'nonexistent@example.com',
            });


          expect(res.statusCode)
            .to.equal(404);


          expect(res.body.message)
            .to.match(/no passkey found/i);
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // LOGIN FINISH
  // ─────────────────────────────────────────────────────────────

  describe(
    'POST /api/passkeys/login/finish (verifyAuthentication)',
    () => {

      it(
        'should return 400 if no challenge cookie is present',
        async () => {

          const res = await request(app)
            .post('/api/passkeys/login/finish')
            .send({
              response: {},
            });


          expect(res.statusCode)
            .to.equal(400);


          expect(res.body.message)
            .to.include('Authentication session expired');
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // PASSKEY MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  describe(
    'GET /api/passkeys (getPasskeys)',
    () => {

      it(
        'should return empty array when user has no passkeys',
        async () => {

          const res = await request(app)
            .get('/api/passkeys')
            .set(
              'Authorization',
              `Bearer ${userToken}`
            );


          expect(res.statusCode)
            .to.equal(200);


          expect(res.body)
            .to.have.property('passkeys');


          expect(res.body.passkeys)
            .to.be.an('array')
            .that.is.empty;
        }
      );


      it(
        'should return 401 without token',
        async () => {

          const res = await request(app)
            .get('/api/passkeys');


          expect(res.statusCode)
            .to.equal(401);
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────

  describe(
    'DELETE /api/passkeys/:passkeyId (deletePasskey)',
    () => {

      it(
        'should return 401 without token',
        async () => {

          const res = await request(app)
            .delete('/api/passkeys/123456789012');


          expect(res.statusCode)
            .to.equal(401);
        }
      );

    }
  );


  // ─────────────────────────────────────────────────────────────
  // LABEL UPDATE
  // ─────────────────────────────────────────────────────────────

  describe(
    'PATCH /api/passkeys/:passkeyId/label (updatePasskeyLabel)',
    () => {

      it(
        'should return 401 without token',
        async () => {

          const res = await request(app)
            .patch(
              '/api/passkeys/123456789012/label'
            )
            .send({
              label: 'My Renamed Passkey',
            });


          expect(res.statusCode)
            .to.equal(401);
        }
      );

    }
  );

});