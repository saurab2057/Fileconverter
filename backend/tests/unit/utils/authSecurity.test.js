
// tests/unit/utils/authSecurity.test.js

import { expect } from 'chai';

import {
  hashIP,
  isTokenValidAfterChange,
  generateJti,
  generateDeviceId,
} from '../../../utils/authSecurity.js';

describe('authSecurity utilities', () => {

  // ─────────────────────────────────────────────────────────
  // hashIP()
  // ─────────────────────────────────────────────────────────

  describe('hashIP()', () => {
    it('should return "unknown" when no IP is provided', () => {
      expect(hashIP()).to.equal('unknown');
      expect(hashIP('')).to.equal('unknown');
      expect(hashIP(null)).to.equal('unknown');
    });

    it('should return a SHA-256 hexadecimal hash', () => {
      const result = hashIP('192.168.1.100');

      expect(result).to.be.a('string');
      expect(result).to.match(/^[a-f0-9]{64}$/);
    });

    it('should produce the same hash for the same IP', () => {
      const first = hashIP('192.168.1.100');
      const second = hashIP('192.168.1.100');

      expect(first).to.equal(second);
    });

    it('should produce different hashes for different IPs', () => {
      const first = hashIP('192.168.1.100');
      const second = hashIP('192.168.1.101');

      expect(first).to.not.equal(second);
    });

    it('should not expose the original IP address', () => {
      const ip = '192.168.1.100';
      const result = hashIP(ip);

      expect(result).to.not.contain(ip);
    });
  });


  // ─────────────────────────────────────────────────────────
  // isTokenValidAfterChange()
  // ─────────────────────────────────────────────────────────

  describe('isTokenValidAfterChange()', () => {
    it('should return true when passwordChangedAt is not provided', () => {
      expect(isTokenValidAfterChange(1000, null)).to.equal(true);
      expect(isTokenValidAfterChange(1000, undefined)).to.equal(true);
    });

    it('should return true when JWT timestamp is after password change', () => {
      const passwordChangedAt = new Date(2000 * 1000);

      expect(
        isTokenValidAfterChange(3000, passwordChangedAt)
      ).to.equal(true);
    });

    it('should return false when JWT timestamp is before password change', () => {
      const passwordChangedAt = new Date(3000 * 1000);

      expect(
        isTokenValidAfterChange(2000, passwordChangedAt)
      ).to.equal(false);
    });

    it('should return false when JWT timestamp equals password change timestamp', () => {
      const passwordChangedAt = new Date(3000 * 1000);

      expect(
        isTokenValidAfterChange(3000, passwordChangedAt)
      ).to.equal(false);
    });
  });


  // ─────────────────────────────────────────────────────────
  // generateJti()
  // ─────────────────────────────────────────────────────────

  describe('generateJti()', () => {
    it('should generate a UUID', () => {
      const jti = generateJti();

      expect(jti).to.be.a('string');
      expect(jti).to.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique JTIs', () => {
      const first = generateJti();
      const second = generateJti();

      expect(first).to.not.equal(second);
    });
  });


  // ─────────────────────────────────────────────────────────
  // generateDeviceId()
  // ─────────────────────────────────────────────────────────

  describe('generateDeviceId()', () => {

    it('should generate a SHA-256 device identifier', () => {
      const req = {
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: (header) => {
          if (header === 'user-agent') {
            return 'Mozilla/5.0';
          }

          return undefined;
        },
      };

      const deviceId = generateDeviceId(req);

      expect(deviceId).to.be.a('string');
      expect(deviceId).to.match(/^[a-f0-9]{64}$/);
    });


    it('should generate the same device ID for the same IP and user-agent', () => {
      const createRequest = () => ({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: (header) => {
          if (header === 'user-agent') {
            return 'Mozilla/5.0';
          }

          return undefined;
        },
      });

      const first = generateDeviceId(createRequest());
      const second = generateDeviceId(createRequest());

      expect(first).to.equal(second);
    });


    it('should generate different device IDs for different user-agents', () => {
      const first = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: (header) => {
          if (header === 'user-agent') {
            return 'Mozilla/5.0';
          }

          return undefined;
        },
      });

      const second = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: (header) => {
          if (header === 'user-agent') {
            return 'Chrome/153.0';
          }

          return undefined;
        },
      });

      expect(first).to.not.equal(second);
    });


    it('should generate different device IDs for different client IPs', () => {
      const first = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      });

      const second = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.101',
        },
        get: () => 'Mozilla/5.0',
      });

      expect(first).to.not.equal(second);
    });


    it('should use x-forwarded-for when x-vercel-forwarded-for is unavailable', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      };

      const result = generateDeviceId(req);

      expect(result).to.be.a('string');
      expect(result).to.match(/^[a-f0-9]{64}$/);
    });


    it('should use cf-connecting-ip when Vercel headers are unavailable', () => {
      const req = {
        headers: {
          'cf-connecting-ip': '192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      };

      const result = generateDeviceId(req);

      expect(result).to.be.a('string');
      expect(result).to.match(/^[a-f0-9]{64}$/);
    });


    it('should use socket remoteAddress when all proxy headers are unavailable', () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: '10.0.0.5',
        },
        get: () => 'Mozilla/5.0',
      };

      const result = generateDeviceId(req);

      expect(result).to.be.a('string');
      expect(result).to.match(/^[a-f0-9]{64}$/);
    });


    it('should use "unknown" when no IP information is available', () => {
      const req = {
        headers: {},
        socket: {},
        get: () => 'Mozilla/5.0',
      };

      const result = generateDeviceId(req);

      expect(result).to.be.a('string');
      expect(result).to.match(/^[a-f0-9]{64}$/);
    });


    it('should normalize IPv4-mapped IPv6 client addresses', () => {
      const ipv4MappedRequest = {
        headers: {
          'x-vercel-forwarded-for': '::ffff:192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      };

      const normalIpv4Request = {
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      };

      const mappedResult = generateDeviceId(ipv4MappedRequest);
      const normalResult = generateDeviceId(normalIpv4Request);

      expect(mappedResult).to.equal(normalResult);
    });


    it('should produce different device IDs when the user-agent is missing', () => {
      const withUserAgent = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: () => 'Mozilla/5.0',
      });

      const withoutUserAgent = generateDeviceId({
        headers: {
          'x-vercel-forwarded-for': '192.168.1.100',
        },
        get: () => undefined,
      });

      expect(withUserAgent).to.not.equal(withoutUserAgent);
    });
  });
});