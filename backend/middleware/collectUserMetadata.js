import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import net from 'net';
import { hashIP } from '../utils/authSecurity.js';
import UserMetadata from '../models/UserMetadata.js';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const GEO_TIMEOUT_MS        = 4000;
const GEO_FAILURE_THRESHOLD = 3;
const GEO_COOLDOWN_MS       = 2 * 60 * 1000;
const GEO_CACHE_TTL_MS      = 10 * 60 * 1000; // 10 minutes

const IP_HASH_SALT = process.env.IP_HASH_SALT || 'fallback_salt';

// ─────────────────────────────────────────────────────────────
// UA Parser (reuse instance)
// ─────────────────────────────────────────────────────────────
const parser = new UAParser();

// ─────────────────────────────────────────────────────────────
// GEO CACHE (simple in-memory TTL cache)
// ─────────────────────────────────────────────────────────────
const geoCache = new Map();

function getCachedGeo(ip) {
    const entry = geoCache.get(ip);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
        geoCache.delete(ip);
        return null;
    }

    return entry.data;
}

function setCachedGeo(ip, data) {
    geoCache.set(ip, {
        data,
        expiry: Date.now() + GEO_CACHE_TTL_MS,
    });
}

// ─────────────────────────────────────────────────────────────
// CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────
const geoCircuit = {
    failures: 0,
    openUntil: null,

    isOpen() {
        if (!this.openUntil) return false;

        if (Date.now() > this.openUntil) {
            this.failures = 0;
            this.openUntil = null;
            console.log('🔁 [GEO] Circuit closed (cooldown elapsed)');
            return false;
        }

        return true;
    },

    recordSuccess() {
        this.failures = 0;
        this.openUntil = null;
    },

    recordFailure() {
        this.failures++;

        if (this.failures >= GEO_FAILURE_THRESHOLD) {
            this.openUntil = Date.now() + GEO_COOLDOWN_MS;
            console.warn(`⚡ [GEO] Circuit OPEN for ${GEO_COOLDOWN_MS / 1000}s`);
        }
    },
};

// ─────────────────────────────────────────────────────────────
// IP HELPERS
// ─────────────────────────────────────────────────────────────
function extractClientIP(req) {
    const raw = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    return raw.split(',')[0].trim();
}

function isPrivateIP(ip) {
    return (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        ip.startsWith('172.') ||
        ip === '127.0.0.1' ||
        ip === '::1'
    );
}

function isValidPublicIP(ip) {
    return ip && net.isIP(ip) !== 0 && !isPrivateIP(ip);
}

// ─────────────────────────────────────────────────────────────
// GEO LOOKUP
// ─────────────────────────────────────────────────────────────
const EMPTY_LOCATION = { country: '', region: '', city: '' };

async function fetchGeoLocation(ip) {
    // Cache hit
    const cached = getCachedGeo(ip);
    if (cached) return cached;

    // Circuit breaker
    if (geoCircuit.isOpen()) {
        return EMPTY_LOCATION;
    }

    const url = `https://ipwho.is/${ip}`;

    try {
        const res = await axios.get(url, {
            timeout: GEO_TIMEOUT_MS,
            maxRedirects: 2,
        });

        if (!res.data?.success) {
            geoCircuit.recordFailure();
            return EMPTY_LOCATION;
        }

        const location = {
            country: res.data.country || '',
            region:  res.data.region  || '',
            city:    res.data.city    || '',
        };

        geoCircuit.recordSuccess();
        setCachedGeo(ip, location);

        return location;

    } catch (err) {
        geoCircuit.recordFailure();

        // Optional single retry (only if circuit still closed)
        if (!geoCircuit.isOpen()) {
            try {
                const retry = await axios.get(url, {
                    timeout: 2000,
                });

                if (retry.data?.success) {
                    const location = {
                        country: retry.data.country || '',
                        region:  retry.data.region  || '',
                        city:    retry.data.city    || '',
                    };

                    geoCircuit.recordSuccess();
                    setCachedGeo(ip, location);

                    return location;
                }
            } catch (_) {
                // ignore retry failure
            }
        }

        return EMPTY_LOCATION;
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────
export async function saveUserMetadata(req, userId) {

    if (process.env.NODE_ENV === 'test') return;

    try {
        const ip = extractClientIP(req);

        if (!isValidPublicIP(ip)) {
            console.log('🧪 Skipping non-public IP');
            return;
        }

        const userAgent = req.headers['user-agent'] || '';

        // UA parsing
        parser.setUA(userAgent);
        const ua = parser.getResult();

        // Geo lookup (non-blocking fallback)
        const location = await fetchGeoLocation(ip);

        const update = {
            ipHash: hashIP(ip + IP_HASH_SALT),
            location,
            device: {
                type: ua.device.type || 'desktop',
                browser: ua.browser.name || '',
                os: ua.os.name || '',
            },
            userAgent,
        };

        const doc = await UserMetadata.findOneAndUpdate(
            { user: userId },
            update,
            { upsert: true, new: true }
        );

        console.log(
            `✅ Metadata saved: ${doc._id} | ${location.city || 'unknown'}`
        );

    } catch (err) {
        console.error('❌ Metadata error (non-fatal):', err.message);
    }
}