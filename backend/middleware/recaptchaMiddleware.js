// middleware/recaptchaMiddleware.js
import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// VERIFY RECAPTCHA
//
// Validates reCAPTCHA v3 tokens on auth routes (login, signup,
// forgot-password). Rejects requests with a score below 0.7.
//
// WHY POST BODY INSTEAD OF QUERY STRING:
//   The original implementation put secretKey and token in the URL:
//     ?secret=...&response=...
//   Query string parameters appear in server access logs, nginx logs,
//   and any upstream proxy or CDN — leaking the secret key into
//   infrastructure you may not fully control.
//   Google's siteverify API accepts application/x-www-form-urlencoded
//   POST body, which keeps both values out of all log layers.
// ─────────────────────────────────────────────────────────────
export async function verifyRecaptcha(req, res, next) {
    if (process.env.NODE_ENV === 'test') return next();

    const token = req.body['recaptcha-token'];

    if (!token) {
        return res.status(400).json({ message: 'reCAPTCHA token is missing.' });
    }

    try {
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            new URLSearchParams({
                secret:   process.env.RECAPTCHA_SECRET_KEY,
                response: token,
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { success, score, 'error-codes': errorCodes } = response.data;

        if (success && score >= 0.7) {
            return next();
        }

        console.warn('[reCAPTCHA] Verification failed:', { success, score, errorCodes });
        return res.status(401).json({ message: 'reCAPTCHA verification failed. Please try again.' });

    } catch (error) {
        console.error('[reCAPTCHA] Verification request failed:', error.message);
        return res.status(500).json({ message: 'Server error during reCAPTCHA verification.' });
    }
}