// middleware/collectUserMetadata.js
import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import net from 'net';
import { hashIP } from '../utils/authSecurity.js';
import UserMetadata from '../models/UserMetadata.js';

// Centralized client IP extraction is used here so geo-location and metadata
// use the same real client IP as the security/rate-limiting layer.
import { getClientIp } from '../utils/clientIp.js';


// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const GEO_TIMEOUT_MS = 4000;
const GEO_FAILURE_THRESHOLD = 3;
const GEO_COOLDOWN_MS = 2 * 60 * 1000;
const GEO_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// UAParser instance is reused across requests — instantiating per-request
// is unnecessary overhead since setUA() resets state before each parse.
const parser = new UAParser();


// ─────────────────────────────────────────────────────────────
// GEO CACHE — simple in-memory TTL cache
//
// Avoids hitting ipwho.is on every login/signup for the same IP.
// 10-minute TTL balances freshness vs. API rate limits.
// Not shared across cluster workers — each worker has its own cache.
// Acceptable trade-off: geo data changes rarely.
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
//
// Stops hammering ipwho.is if it goes down.
// After GEO_FAILURE_THRESHOLD consecutive failures, the circuit
// opens for GEO_COOLDOWN_MS before retrying.
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

            console.warn(
                `⚡ [GEO] Circuit OPEN for ${GEO_COOLDOWN_MS / 1000}s`
            );
        }
    },
};


// ─────────────────────────────────────────────────────────────
// IP HELPERS
// ─────────────────────────────────────────────────────────────

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

const EMPTY_GEO = {
    location: {
        country: '',
        region: '',
        city: '',
    },

    network: {
        isp: '',
        organization: '',
        asn: '',
        connectionType: '',
        isProxy: false,
        isVpn: false,
        isTor: false,
        isHosting: false,
    },

    timezone: '',
};

function normalizeGeoResponse(data) {
    return {
        location: {
            country: data.country || '',
            region: data.region || '',
            city: data.city || '',
        },

        network: {
            isp: data.connection?.isp || '',
            organization: data.connection?.org || '',
            asn: data.connection?.asn || '',
            connectionType: data.connection?.type || '',

            isProxy: data.security?.proxy ?? false,
            isVpn: data.security?.vpn ?? false,
            isTor: data.security?.tor ?? false,
            isHosting: data.security?.hosting ?? false,
        },

        timezone: data.timezone?.id || '',
    };
}

async function fetchGeoLocation(ip) {
    const cached = getCachedGeo(ip);

    if (cached) return cached;

    if (geoCircuit.isOpen()) {
        return EMPTY_GEO;
    }

    const url = `https://ipwho.is/${ip}`;

    try {
        const res = await axios.get(url, {
            timeout: GEO_TIMEOUT_MS,
            maxRedirects: 2,
        });

        if (!res.data?.success) {
            geoCircuit.recordFailure();
            return EMPTY_GEO;
        }

        const geo = normalizeGeoResponse(res.data);

        geoCircuit.recordSuccess();
        setCachedGeo(ip, geo);

        return geo;

    } catch {
        geoCircuit.recordFailure();

        // Single retry — only if the failure didn't trip the circuit open
        if (!geoCircuit.isOpen()) {
            try {
                const retry = await axios.get(url, {
                    timeout: 2000,
                });

                if (retry.data?.success) {
                    const geo = normalizeGeoResponse(retry.data);

                    geoCircuit.recordSuccess();
                    setCachedGeo(ip, geo);

                    return geo;
                }
            } catch {
                // Retry also failed — fall through to EMPTY_GEO
            }
        }

        return EMPTY_GEO;
    }
}


// ─────────────────────────────────────────────────────────────
// MAIN — called after login / signup to record device + location.
//
// Non-fatal by design: a metadata failure must never block auth.
// Skipped for private/loopback IPs (dev/test environments) and
// in the test environment to avoid DB writes in CI.
// ─────────────────────────────────────────────────────────────
export async function saveUserMetadata(req, userId) {
    if (process.env.NODE_ENV === 'test') return;

    try {
        const ip = getClientIp(req);

        if (!isValidPublicIP(ip)) {
            console.log('[GEO] Skipping non-public IP');
            return;
        }

        const userAgent = req.headers['user-agent'] || '';

        parser.setUA(userAgent);
        const ua = parser.getResult();

        const geo = await fetchGeoLocation(ip);

        // hashIP applies IP_HASH_SALT internally (see authSecurity.js).
        // Do NOT concatenate the salt here — that was the previous bug
        // that caused the same IP to hash differently across collections.
        const update = {
            ipHash: hashIP(ip),

            location: geo.location,

            network: geo.network,

            timezone: geo.timezone,

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
            `Metadata saved: ${doc._id} | ${geo.location.city || 'unknown'}`
        );

    } catch (err) {
        console.error(
            'Metadata save failed (non-fatal):',
            err.message
        );
    }
}
