// tests/unit/utils/clientIp.test.js

import { expect } from 'chai';
import { getClientIp } from '../../../utils/clientIp.js';

describe('getClientIp Utility - Unit Tests', () => {

    // ─────────────────────────────────────────────────────────
    // 1. VERCEL IP
    // ─────────────────────────────────────────────────────────

    it('should prefer x-vercel-forwarded-for when available', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '120.89.104.15',
                'x-forwarded-for': '13.232.121.221',
                'cf-connecting-ip': '172.68.175.70',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should extract the first IP from x-vercel-forwarded-for', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for':
                    '120.89.104.15, 13.232.121.221, 172.68.175.70, 10.198.131.30',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    // ─────────────────────────────────────────────────────────
    // 2. X-FORWARDED-FOR FALLBACK
    // ─────────────────────────────────────────────────────────

    it('should fall back to x-forwarded-for when Vercel header is unavailable', () => {
        const req = {
            headers: {
                'x-forwarded-for': '120.89.104.15',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should extract the first IP from x-forwarded-for', () => {
        const req = {
            headers: {
                'x-forwarded-for':
                    '120.89.104.15, 13.232.121.221, 172.68.175.70',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should prefer x-vercel-forwarded-for over x-forwarded-for', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '1.2.3.4',
                'x-forwarded-for': '5.6.7.8',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('1.2.3.4');
    });

    // ─────────────────────────────────────────────────────────
    // 3. CLOUDFLARE FALLBACK
    // ─────────────────────────────────────────────────────────

    it('should fall back to cf-connecting-ip when Vercel headers are unavailable', () => {
        const req = {
            headers: {
                'cf-connecting-ip': '120.89.104.15',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should prefer x-forwarded-for over cf-connecting-ip', () => {
        const req = {
            headers: {
                'x-forwarded-for': '1.2.3.4',
                'cf-connecting-ip': '5.6.7.8',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('1.2.3.4');
    });

    // ─────────────────────────────────────────────────────────
    // 4. SOCKET FALLBACK
    // ─────────────────────────────────────────────────────────

    it('should fall back to socket remoteAddress when no proxy headers exist', () => {
        const req = {
            headers: {},
            socket: {
                remoteAddress: '192.168.1.100',
            },
        };

        expect(getClientIp(req)).to.equal('192.168.1.100');
    });

    it('should return unknown when no IP information is available', () => {
        const req = {
            headers: {},
            socket: {},
        };

        expect(getClientIp(req)).to.equal('unknown');
    });

    // ─────────────────────────────────────────────────────────
    // 5. IPV4-MAPPED IPV6
    // ─────────────────────────────────────────────────────────

    it('should normalize IPv4-mapped IPv6 addresses from Vercel header', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '::ffff:192.168.1.100',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('192.168.1.100');
    });

    it('should normalize IPv4-mapped IPv6 addresses from x-forwarded-for', () => {
        const req = {
            headers: {
                'x-forwarded-for': '::ffff:192.168.1.100',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('192.168.1.100');
    });

    it('should normalize IPv4-mapped IPv6 addresses from cf-connecting-ip', () => {
        const req = {
            headers: {
                'cf-connecting-ip': '::ffff:192.168.1.100',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('192.168.1.100');
    });

    it('should normalize IPv4-mapped IPv6 addresses from socket remoteAddress', () => {
        const req = {
            headers: {},
            socket: {
                remoteAddress: '::ffff:192.168.1.100',
            },
        };

        expect(getClientIp(req)).to.equal('192.168.1.100');
    });

    // ─────────────────────────────────────────────────────────
    // 6. WHITESPACE HANDLING
    // ─────────────────────────────────────────────────────────

    it('should trim whitespace around the forwarded IP', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '   120.89.104.15   ',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should trim whitespace before extracting the first forwarded IP', () => {
        const req = {
            headers: {
                'x-forwarded-for':
                    '   120.89.104.15   , 13.232.121.221',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    // ─────────────────────────────────────────────────────────
    // 7. EMPTY / INVALID HEADER VALUES
    // ─────────────────────────────────────────────────────────

    it('should ignore an empty x-vercel-forwarded-for header', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '',
                'x-forwarded-for': '120.89.104.15',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should ignore an empty x-forwarded-for header', () => {
        const req = {
            headers: {
                'x-forwarded-for': '',
                'cf-connecting-ip': '120.89.104.15',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    it('should ignore an empty cf-connecting-ip header', () => {
        const req = {
            headers: {
                'cf-connecting-ip': '',
            },
            socket: {
                remoteAddress: '120.89.104.15',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    // ─────────────────────────────────────────────────────────
    // 8. ARRAY HEADER VALUES
    // ─────────────────────────────────────────────────────────

    it('should use the first value when a proxy header is an array', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': [
                    '120.89.104.15',
                    '13.232.121.221',
                ],
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal('120.89.104.15');
    });

    // ─────────────────────────────────────────────────────────
    // 9. IPV6
    // ─────────────────────────────────────────────────────────

    it('should preserve a normal IPv6 address', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for':
                    '2001:db8:85a3::8a2e:370:7334',
            },
            socket: {
                remoteAddress: '10.198.131.30',
            },
        };

        expect(getClientIp(req)).to.equal(
            '2001:db8:85a3::8a2e:370:7334'
        );
    });

    // ─────────────────────────────────────────────────────────
    // 10. PROXY PRIORITY
    // ─────────────────────────────────────────────────────────

    it('should follow the expected proxy priority order', () => {
        const req = {
            headers: {
                'x-vercel-forwarded-for': '1.1.1.1',
                'x-forwarded-for': '2.2.2.2',
                'cf-connecting-ip': '3.3.3.3',
            },
            socket: {
                remoteAddress: '4.4.4.4',
            },
        };

        expect(getClientIp(req)).to.equal('1.1.1.1');
    });

    it('should use x-forwarded-for when Vercel header is missing', () => {
        const req = {
            headers: {
                'x-forwarded-for': '2.2.2.2',
                'cf-connecting-ip': '3.3.3.3',
            },
            socket: {
                remoteAddress: '4.4.4.4',
            },
        };

        expect(getClientIp(req)).to.equal('2.2.2.2');
    });

    it('should use cf-connecting-ip when both Vercel headers are missing', () => {
        const req = {
            headers: {
                'cf-connecting-ip': '3.3.3.3',
            },
            socket: {
                remoteAddress: '4.4.4.4',
            },
        };

        expect(getClientIp(req)).to.equal('3.3.3.3');
    });

    it('should use socket remoteAddress when all proxy headers are missing', () => {
        const req = {
            headers: {},
            socket: {
                remoteAddress: '4.4.4.4',
            },
        };

        expect(getClientIp(req)).to.equal('4.4.4.4');
    });
});