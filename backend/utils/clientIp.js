// backend/utils/clientIp.js

/**
 * Extract the originating client IP from the production proxy chain.
 *
 * Production architecture:
 *
 *     Browser
 *        ↓
 *     Vercel
 *        ↓
 *     Cloudflare
 *        ↓
 *     Render
 *        ↓
 *     Express
 *
 * IMPORTANT:
 * Do NOT use req.ip here.
 *
 * In the current deployment, Express sees Render's internal
 * 10.x.x.x address as req.ip because of the proxy chain.
 *
 * Vercel provides the client's public IP through
 * X-Forwarded-For / X-Vercel-Forwarded-For before the request
 * reaches the Render backend.
 *
 * CF-Connecting-IP is intentionally NOT preferred here because
 * our tests showed that it represents an intermediate address
 * after the request passes through Vercel.
 *
 * The fallback to CF-Connecting-IP is useful for requests that
 * reach Render directly rather than through the Vercel rewrite.
 *
 * NOTE:
 * The long-term architecture should ideally prevent clients
 * from bypassing Vercel and calling Render directly. Until that
 * is enforced, IP-based rate limiting should be treated as an
 * abuse-control layer rather than the sole security boundary.
 */

export function getClientIp(req) {
    // ─────────────────────────────────────────────────────────
    // 1. VERCEL CLIENT IP
    // ─────────────────────────────────────────────────────────
    //
    // Vercel documents these headers as containing the public
    // IP address of the requesting client.
    //
    // x-vercel-forwarded-for is preferred because it is the
    // Vercel-specific representation of the forwarded client IP.
    //
    // If unavailable, use the standard X-Forwarded-For header.
    //
    const vercelForwardedFor = req.headers['x-vercel-forwarded-for'];
    const forwardedFor = req.headers['x-forwarded-for'];

    const vercelIp = extractFirstIp(vercelForwardedFor);

    if (vercelIp) {
        return vercelIp;
    }

    const forwardedIp = extractFirstIp(forwardedFor);

    if (forwardedIp) {
        return forwardedIp;
    }


    // ─────────────────────────────────────────────────────────
    // 2. CLOUDFLARE FALLBACK
    // ─────────────────────────────────────────────────────────
    //
    // If the request did not come through Vercel, Cloudflare's
    // CF-Connecting-IP is the safer fallback on Render.
    //
    // Render documents that Cloudflare writes this header for
    // requests reaching Render.
    //
    const cfConnectingIp = normalizeIp(
        req.headers['cf-connecting-ip']
    );

    if (cfConnectingIp) {
        return cfConnectingIp;
    }


    // ─────────────────────────────────────────────────────────
    // 3. LAST-RESORT FALLBACK
    // ─────────────────────────────────────────────────────────
    //
    // This should normally only happen during local development
    // or when the request bypasses the expected proxy chain.
    //
    return normalizeIp(
        req.socket?.remoteAddress
    ) || 'unknown';
}


/**
 * Get the first address from a comma-separated proxy header.
 *
 * Example:
 *
 * "120.89.104.15, 13.232.121.221, 172.68.175.70, 10.198.131.30"
 *
 * becomes:
 *
 * "120.89.104.15"
 */
function extractFirstIp(headerValue) {
    if (!headerValue) {
        return null;
    }

    const firstValue = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue.split(',')[0];

    return normalizeIp(firstValue);
}


/**
 * Normalize an IP value before returning it.
 *
 * Express/Node can expose IPv4 addresses as IPv4-mapped IPv6:
 *
 *     ::ffff:192.168.1.10
 *
 * Convert that into:
 *
 *     192.168.1.10
 *
 * so the rest of the application has one consistent format.
 */
function normalizeIp(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const ip = value.trim();

    if (!ip) {
        return null;
    }

    // Convert IPv4-mapped IPv6 addresses to normal IPv4.
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }

    return ip;
}