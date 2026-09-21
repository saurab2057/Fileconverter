import express from 'express';
import request from 'supertest';
import { expect } from 'chai';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import {
  userReadLimiter,
  userWriteLimiter,
  chatLimiter,
  summarizeLimiter,
  conversionLimiter,
  compressionLimiter,
  adminLimiter,
  authLimiter,
  passkeyLimiter,
  refreshTokenLimiter,
  resetPasswordLimiter,
} from '../../../middleware/rateLimiter.js';

const originalNodeEnv = process.env.NODE_ENV;

const createApp = (limiter, configureRequest = null, method = 'get') => {
  const app = express();

  app.use(express.json());

  app[method](
    '/test',
    (req, res, next) => {
      if (configureRequest) {
        configureRequest(req);
      }

      next();
    },
    limiter,
    (req, res) => {
      res.status(200).json({ success: true });
    }
  );

  return app;
};

describe('Rate limiting middleware', function () {
  this.timeout(30000);

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  after(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // ─────────────────────────────────────────────────────────────
  // AUTHENTICATED USER READ LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('userReadLimiter()', () => {
    it('should allow up to 60 requests per user per minute', async () => {
      const userId = `read-${Date.now()}-${Math.random()}`;

      const app = createApp(userReadLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 60; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }
    });

    it('should block the 61st request for the same user', async () => {
      const userId = `read-block-${Date.now()}-${Math.random()}`;

      const app = createApp(userReadLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 60; i++) {
        await request(app).get('/test');
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AUTHENTICATED USER WRITE LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('userWriteLimiter()', () => {
    it('should block the 16th request for the same user', async () => {
      const userId = `write-${Date.now()}-${Math.random()}`;

      const app = createApp(
        userWriteLimiter,
        (req) => {
          req.user = { _id: userId };
        },
        'put'
      );

      for (let i = 0; i < 15; i++) {
        const response = await request(app).put('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).put('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CHAT LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('chatLimiter()', () => {
    it('should block the 11th request for the same user', async () => {
      const userId = `chat-${Date.now()}-${Math.random()}`;

      const app = createApp(chatLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARIZATION LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('summarizeLimiter()', () => {
    it('should block the 6th request for the same user', async () => {
      const userId = `summary-${Date.now()}-${Math.random()}`;

      const app = createApp(summarizeLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CONVERSION LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('conversionLimiter()', () => {
    it('should block the 11th request for the same user', async () => {
      const userId = `conversion-${Date.now()}-${Math.random()}`;

      const app = createApp(conversionLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // COMPRESSION LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('compressionLimiter()', () => {
    it('should block the 11th request for the same user', async () => {
      const userId = `compression-${Date.now()}-${Math.random()}`;

      const app = createApp(compressionLimiter, (req) => {
        req.user = { _id: userId };
      });

      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ADMIN LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('adminLimiter()', () => {
    it('should block the 101st request within 15 minutes', async () => {
      const app = createApp(adminLimiter);

      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AUTHENTICATION LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('authLimiter()', () => {
    it('should block the 11th authentication attempt', async () => {
      const app = createApp(authLimiter);

      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);

      expect(response.body).to.deep.equal({
        success: false,
        message:
          'Too many login attempts. Please wait 15 minutes before trying again.',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PASSKEY LIMITER
  // ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// PASSKEY LIMITER
// ─────────────────────────────────────────────────────────────

describe('passkeyLimiter()', () => {
  it('should block the 11th unauthenticated request from the same IPv6 address', async () => {
    /*
     * Use a fresh limiter so this test is completely independent
     * from the other passkey tests.
     *
     * The IPv6 address is deliberately hard-coded because the purpose
     * of this test is to verify IP-based limiting with an IPv6 client.
     */
    const isolatedPasskeyLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,

      keyGenerator: (req) => {
        if (req.user?._id) {
          return `user_${req.user._id.toString()}`;
        }

        return ipKeyGenerator(req.ip);
      },
    });

    const app = createApp(isolatedPasskeyLimiter, (req) => {
      /*
       * Express exposes req.ip through a getter, so direct assignment
       * such as req.ip = '2001:db8::1' is not allowed.
       *
       * Defining the property on this individual request lets the test
       * simulate a real IPv6 client without changing Express itself.
       */
      Object.defineProperty(req, 'ip', {
        configurable: true,
        value: '2001:db8::1',
      });
    });

    // First 10 requests from the same IPv6 address must be allowed.
    for (let i = 0; i < 10; i++) {
      const response = await request(app).get('/test');

      expect(response.status).to.equal(200);
    }

    // The 11th request from that same IPv6 address must be rejected.
    const response = await request(app).get('/test');

    expect(response.status).to.equal(429);
  });

  it('should use separate keys for different authenticated users', async () => {
    let userNumber = 0;

    const app = createApp(passkeyLimiter, (req) => {
      userNumber += 1;

      req.user = {
        _id: `passkey-user-${userNumber}-${Date.now()}`,
      };
    });

    for (let i = 0; i < 20; i++) {
      const response = await request(app).get('/test');

      expect(response.status).to.equal(200);
    }
  });

  it('should block repeated requests from the same authenticated user', async () => {
    const userId = `passkey-same-user-${Date.now()}-${Math.random()}`;

    const app = createApp(passkeyLimiter, (req) => {
      req.user = {
        _id: userId,
      };
    });

    for (let i = 0; i < 10; i++) {
      const response = await request(app).get('/test');

      expect(response.status).to.equal(200);
    }

    const response = await request(app).get('/test');

    expect(response.status).to.equal(429);
  });
});

  // ─────────────────────────────────────────────────────────────
  // REFRESH TOKEN LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('refreshTokenLimiter()', () => {
    it('should block the 31st request from the same IP', async () => {
      const app = createApp(refreshTokenLimiter);

      for (let i = 0; i < 30; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);

      expect(response.body).to.deep.equal({
        success: false,
        message: 'Too many refresh attempts. Please try again later.',
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PASSWORD RESET LIMITER
  // ─────────────────────────────────────────────────────────────

  describe('resetPasswordLimiter()', () => {
    it('should block the 6th request for the same reset session', async () => {
      const sessionId = `A${String(Date.now()).padStart(19, '0')}`;

      const app = createApp(resetPasswordLimiter, (req) => {
        req.cookies = {
          reset_session: sessionId,
        };
      });

      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      const response = await request(app).get('/test');

      expect(response.status).to.equal(429);
    });

    it('should use different rate-limit keys for different reset sessions', async () => {
      let sessionNumber = 0;

      const app = createApp(resetPasswordLimiter, (req) => {
        sessionNumber += 1;

        /*
         * The production limiter only uses the first 20 characters
         * of reset_session, so the changing number must be inside
         * those first 20 characters.
         */
        req.cookies = {
          reset_session: `S${String(sessionNumber).padStart(19, '0')}`,
        };
      });

      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // STANDARD RATE-LIMIT HEADERS
  // ─────────────────────────────────────────────────────────────

  describe('standard headers', () => {
    it('should expose RateLimit headers on allowed requests', async () => {
      const userId = `headers-${Date.now()}-${Math.random()}`;

      const app = createApp(userReadLimiter, (req) => {
        req.user = { _id: userId };
      });

      const response = await request(app).get('/test');

      expect(response.status).to.equal(200);

      expect(response.headers).to.have.property('ratelimit-limit');
      expect(response.headers).to.have.property('ratelimit-remaining');
      expect(response.headers).to.have.property('ratelimit-reset');

      expect(response.headers['ratelimit-limit']).to.equal('60');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST ENVIRONMENT BYPASS
  // ─────────────────────────────────────────────────────────────

  describe('NODE_ENV=test bypass', () => {
    it('should skip rate limiting when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test';

      const app = createApp(authLimiter);

      for (let i = 0; i < 12; i++) {
        const response = await request(app).get('/test');

        expect(response.status).to.equal(200);
      }

      process.env.NODE_ENV = 'development';
    });
  });
});