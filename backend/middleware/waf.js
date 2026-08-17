// middleware/waf.js
import AuditLog from '../models/AuditLog.js';
import { hashIP } from '../utils/authSecurity.js';

// ─────────────────────────────────────────────────────────────
// WAF — Web Application Firewall Middleware
//
// Runs GLOBALLY on all routes mounted AFTER it in app.js.
// (Health check is mounted before WAF — intentionally excluded.)
//
// Attack categories blocked:
//   1. Malicious User-Agents  — scanner/exploit tool signatures
//   2. HTTP Method Tampering  — X-HTTP-Method-Override abuse
//   3. Null Byte Injection    — %00 tricks to bypass parsers
//   4. Path Traversal         — ../../etc/passwd style escapes
//   5. NoSQL Injection        — MongoDB $ operators as object keys
//   6. Prototype Pollution     __proto__, constructor, prototype keys
//   7. XSS                    — <script>, javascript:, event handlers (enhanced)
//   8. Oversized Payloads     — raw body > 100KB (measured in bytes)
//
// Design decisions:
//   - Fails OPEN on internal WAF error (next() not next(err))
//     so a WAF crash never takes down your entire API.
//   - logBlockedRequest is synchronous — AuditLog.create() is
//     fire-and-forget (.catch) so it never blocks the response.
//   - NoSQL/Prototype checks work on parsed objects (req.body/query),
//     NOT stringified versions — eliminates false positives.
//
// Requires: Node.js >= 14.0.0 (regex lookbehind support)
// Env vars:
//   - NODE_ENV=test              : Disables WAF for testing
//   - WAF_BLOCK_GENERIC_AGENTS=true : Block curl/python-requests UAs
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
// 1. PATH TRAVERSAL PATTERNS
// ─────────────────────────────────────────────────────────────
const PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//,               // ../  — basic traversal
    /\.\.%2f/i,             // URL-encoded ../
    /\.\.%5c/i,             // URL-encoded ..\  (Windows)
    /\.\.%252f/i,           // double-encoded ../ (bypass naive decoders)
    /\/etc\/passwd/i,       // classic Linux target
    /\/etc\/shadow/i,       // Linux password hashes
    /\/proc\/self/i,        // Linux process info leak
    /\\windows\\system32/i, // Windows system directory
    /\.\.%c0%af/i,          // Unicode overlong encoding of /
    /\.\.%c1%9c/i,          // Unicode overlong encoding (Windows variant)
    /(\.{2,}\/)+/i,         // repeated dot traversal (....//....//)
];

// ─────────────────────────────────────────────────────────────
// 2. XSS PATTERNS (ENHANCED)
//
// Added patterns for:
//   - Unquoted event handlers (onclick=alert(1))
//   - SVG event handlers (onload inside <svg>)
//   - MathML href javascript: (rare but still a vector)
//   - CSS expression() (legacy IE – optional, can be removed)
// ─────────────────────────────────────────────────────────────
const XSS_PATTERNS = [
    /<script[\s>]/i,                            // opening <script> tag
    /<\/script>/i,                              // closing </script>
    /javascript\s*:/i,                          // javascript: URI scheme
    /on\w+\s*=\s*["'`]/i,                       // quoted event handlers
    /on\w+\s*=[^>\s"']+/i,                      // 🔥 NEW: unquoted event handlers
    /<svg[^>]*on\w+\s*=/i,                      // 🔥 NEW: SVG event handlers
    /<math[^>]*href\s*=\s*["']?javascript:/i,   // 🔥 NEW: MathML XSS
    /expression\s*\(/i,                         // 🔥 NEW: CSS expression (legacy IE)
    /<iframe/i,                                 // iframe injection
    /<object/i,                                 // <object> tag
    /<embed/i,                                  // <embed> tag
    /data:text\/html/i,                         // data URI XSS vector
    /vbscript\s*:/i,                            // VBScript (legacy IE)
    /<img[^>]+src\s*=\s*["']?javascript/i,     // <img src=javascript:…>
];

// ─────────────────────────────────────────────────────────────
// 3. MALICIOUS USER-AGENTS (CONFIGURABLE)
//
// Generic scanners (python-requests, curl, wget) can be optionally
// blocked via environment variable WAF_BLOCK_GENERIC_AGENTS=true
// ─────────────────────────────────────────────────────────────
const BLOCK_GENERIC_AGENTS = process.env.WAF_BLOCK_GENERIC_AGENTS === 'true';

const MALICIOUS_USER_AGENTS = [
    /sqlmap/i,                      // SQL injection scanner
    /nikto/i,                       // web vulnerability scanner
    /masscan/i,                     // high-speed port/service scanner
    /nmap/i,                        // network mapper
    /dirbuster/i,                   // directory brute-forcer
    /gobuster/i,                    // directory/DNS brute-forcer
    /hydra/i,                       // password brute-forcer
    /metasploit/i,                  // exploit framework
    /zgrab/i,                       // banner grabber
    /nuclei/i,                      // template-based vulnerability scanner
    /acunetix/i,                    // commercial web scanner
    /nessus/i,                      // commercial vulnerability scanner
    /burpsuite/i,                   // penetration testing proxy
    ...(BLOCK_GENERIC_AGENTS ? [
        /python-requests\/[0-9]/i,  // raw Python scanner (optional)
        /curl\/[0-9]/i,             // raw curl (optional)
        /wget\//i,                  // wget (optional)
    ] : [])
];

// ─────────────────────────────────────────────────────────────
// 4. NULL BYTE PATTERNS
// ─────────────────────────────────────────────────────────────
const NULL_BYTE_PATTERNS = [
    /%00/,      // URL-encoded null byte
    /\x00/,     // raw null byte in string
    /\\u0000/i, // Unicode null escape
    /%2500/i,   // double-encoded null byte
];

// ─────────────────────────────────────────────────────────────
// 5. HTTP METHOD TAMPERING HEADERS
// ─────────────────────────────────────────────────────────────
const DANGEROUS_OVERRIDE_HEADERS = [
    'x-http-method-override',
    'x-method-override',
    'x-http-method',
];

// ─────────────────────────────────────────────────────────────
// PROTOTYPE POLLUTION DETECTOR
//
// Checks for dangerous keys that can pollute JavaScript's prototype chain:
//   - __proto__
//   - constructor  
//   - prototype
//
// Attack example: { "__proto__": { "isAdmin": true } }
// This is separate from NoSQL injection ($ operators).
// Both checks are required for full protection.
// ─────────────────────────────────────────────────────────────
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

const containsDangerousKey = (obj, depth = 0) => {
    // Hard stop — prevent DoS via deeply nested payloads
    if (depth > 10 || typeof obj !== 'object' || obj === null) return false;

    for (const key of Object.keys(obj)) {
        // Check for prototype pollution keys (case-sensitive per JS spec)
        if (DANGEROUS_KEYS.includes(key)) return true;

        // Recurse into nested objects/arrays
        if (typeof obj[key] === 'object' && containsDangerousKey(obj[key], depth + 1)) {
            return true;
        }
    }
    return false;
};

// ─────────────────────────────────────────────────────────────
// NOSQL INJECTION DETECTOR
//
// Inspects parsed object KEYS for MongoDB $ operators.
// String values like "P$ortal1!" are NOT flagged — only actual
// operator keys like { "$gt": "" } trigger detection.
// ─────────────────────────────────────────────────────────────
const containsMongoOperator = (obj, depth = 0) => {
    if (depth > 10 || typeof obj !== 'object' || obj === null) return false;

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$')) return true;
        if (typeof obj[key] === 'object' && containsMongoOperator(obj[key], depth + 1)) {
            return true;
        }
    }
    return false;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const matchesAny = (str, patterns) => patterns.some(p => p.test(str));

const flattenBody = (body) => {
    if (!body || typeof body !== 'object') return String(body || '');
    // ✅ AFTER — scans values only
    return Object.entries(body)
        .map(([k, v]) => {
            const val = typeof v === 'object' && v !== null
                ? JSON.stringify(v)
                : String(v ?? '');
            return val;  // Only the value, not "key=val"
        })
        .join(' ');
};

// ─────────────────────────────────────────────────────────────
// SENSITIVE DATA MASKING
// ─────────────────────────────────────────────────────────────
const maskSensitive = (str) => {
    if (typeof str !== 'string') return str;

    const sensitiveParams = [
        /(?<=[?&])(password|passwd|pwd)=[^&]+/gi,
        /(?<=[?&])(token|access_token|refresh_token|api_key|apikey|secret)=[^&]+/gi,
        /(?<=[?&])(jwt|bearer|auth)=[^&]+/gi,
        /(?<=[?&])(credit_card|cc|ssn|tax_id)=[^&]+/gi,
    ];

    let masked = str;
    for (const pattern of sensitiveParams) {
        masked = masked.replace(pattern, (match) => {
            const equalsPos = match.indexOf('=');
            if (equalsPos === -1) return match;
            return match.substring(0, equalsPos + 1) + '***REDACTED***';
        });
    }
    return masked;
};

// ─────────────────────────────────────────────────────────────
// AUDIT LOG HELPER
// ─────────────────────────────────────────────────────────────
const logBlockedRequest = (req, attackType, details) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const safeDetails = maskSensitive(details);

    console.warn(
        `🚨 [WAF BLOCKED] ${attackType} | ` +
        `IP: ${ip} | ` +
        `User: ${req.user?._id || 'unauthenticated'} | ` +
        `${req.method} ${req.originalUrl} | ` +
        `Details: ${safeDetails}`
    );

    // Emit metrics if available (optional observability hook)
    if (global.metrics && typeof global.metrics.increment === 'function') {
        global.metrics.increment('waf.block', { attackType, route: req.path });
    }

    AuditLog.create({
        userId: req.user?._id || null,
        source: 'system',
        action: 'WAF_BLOCKED',
        resource: `${req.method} ${req.originalUrl}`,
        details: {
            attackType,
            details: safeDetails,
            ip,
            userAgent,
        },
        ipAddress: ip,
        ipHash: hashIP(ip),
        userAgent,
    }).catch(err => {
        console.error('🚨 [WAF] AuditLog write failed:', err.message);
    });
};

// ─────────────────────────────────────────────────────────────
// MAIN WAF MIDDLEWARE
// ─────────────────────────────────────────────────────────────
export const waf = (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();

    try {
        // Safe URL decode with fallback
        let url;
        try {
            url = decodeURIComponent(req.originalUrl);
        } catch {
            url = req.originalUrl;
        }

        const userAgent = req.get('user-agent') || '';
        const queryStr = JSON.stringify(req.query || {});
        const bodyStr = flattenBody(req.body);

        // ─────────────────────────────────────────────
        // CHECK 1: Malicious User-Agent
        // ─────────────────────────────────────────────
        if (matchesAny(userAgent, MALICIOUS_USER_AGENTS)) {
            logBlockedRequest(req, 'MALICIOUS_USER_AGENT', `UA: ${userAgent.substring(0, 100)}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 2: HTTP Method Tampering
        // ─────────────────────────────────────────────
        const overrideHeader = DANGEROUS_OVERRIDE_HEADERS.find(h => req.headers[h]);
        if (overrideHeader) {
            logBlockedRequest(req, 'HTTP_METHOD_TAMPERING', `Header: ${overrideHeader}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 3: Null Byte Injection
        // ─────────────────────────────────────────────
        const fullRequest = `${url} ${bodyStr} ${queryStr}`;
        if (matchesAny(fullRequest, NULL_BYTE_PATTERNS)) {
            logBlockedRequest(req, 'NULL_BYTE_INJECTION', `URL: ${url.substring(0, 200)}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 4: Path Traversal
        // ─────────────────────────────────────────────
        const urlAndQuery = `${url} ${queryStr}`;
        if (matchesAny(urlAndQuery, PATH_TRAVERSAL_PATTERNS)) {
            logBlockedRequest(req, 'PATH_TRAVERSAL', `URL: ${url.substring(0, 200)}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 5: NoSQL Injection
        // ─────────────────────────────────────────────
        const bodyInjected = containsMongoOperator(req.body);
        const queryInjected = containsMongoOperator(req.query);
 
        if (bodyInjected || queryInjected) {
            const location = bodyInjected ? 'body' : 'query';
            logBlockedRequest(req, 'NOSQL_INJECTION', `Operator found in ${location}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }
 
        // ─────────────────────────────────────────────
        // CHECK 6: Prototype Pollution
        // ─────────────────────────────────────────────
        const bodyPolluted = containsDangerousKey(req.body);
        const queryPolluted = containsDangerousKey(req.query);
 
        if (bodyPolluted || queryPolluted) {
            const location = bodyPolluted ? 'body' : 'query';
            logBlockedRequest(req, 'PROTOTYPE_POLLUTION', `Dangerous key in ${location}`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 7: XSS Patterns (Enhanced)
        // ─────────────────────────────────────────────
        const bodyAndQuery = `${bodyStr} ${queryStr}`;
        if (matchesAny(bodyAndQuery, XSS_PATTERNS)) {
            logBlockedRequest(req, 'XSS_ATTEMPT', `Matched in body/query`);
            return res.status(403).json({ message: 'Forbidden.' });
        }

        // ─────────────────────────────────────────────
        // CHECK 8: Oversized Payload
        // ─────────────────────────────────────────────
        const PAYLOAD_LIMIT_BYTES = 200 * 1024; // 200KB
        const actualBytes = Buffer.byteLength(bodyStr, 'utf8');
        if (actualBytes > PAYLOAD_LIMIT_BYTES) {
            logBlockedRequest(req, 'OVERSIZED_PAYLOAD', `Size: ${actualBytes} bytes`);
            return res.status(413).json({ message: 'Payload too large.' });
        }

        // ─────────────────────────────────────────────
        // ALL CHECKS PASSED
        // ─────────────────────────────────────────────
        next();

    } catch (err) {
        // Fail open on unexpected WAF error
        console.error('🚨 [WAF] Unexpected internal error — failing open:', err.message);
        next();
    }
};