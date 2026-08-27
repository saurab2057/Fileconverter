// middleware/recaptchaMiddleware.js
import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// VERIFY RECAPTCHA
//
// Validates reCAPTCHA v3 tokens on auth routes (login, signup,
// forgot-password). Rejects requests with a score below 0.7, OR
// whose token action doesn't match the route it's being used on.
//
// WHY POST BODY INSTEAD OF QUERY STRING:
//   The original implementation put secretKey and token in the URL:
//     ?secret=...&response=...
//   Query string parameters appear in server access logs, nginx logs,
//   and any upstream proxy or CDN — leaking the secret key into
//   infrastructure you may not fully control.
//   Google's siteverify API accepts application/x-www-form-urlencoded
//   POST body, which keeps both values out of all log layers.
//
// WHY expectedAction:
//   reCAPTCHA v3 tokens are minted client-side with an action label
//   (see Login.jsx / Signup.jsx / Forgetpassword.jsx grecaptcha.execute()
//   calls). Google's siteverify response echoes that action back, and
//   Google's own docs recommend checking it matches the endpoint the
//   token is being used on — otherwise a token minted for one action
//   could be replayed against a different route, and scoring is
//   action-aware so skipping this check weakens the whole model.
//
// Usage: verifyRecaptcha('login'), verifyRecaptcha('signup'), etc.
// The string passed in MUST exactly match the `action` used in the
// matching frontend's grecaptcha.execute() call.
// ─────────────────────────────────────────────────────────────
export function verifyRecaptcha(expectedAction) {
    return async (req, res, next) => {
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

            const { success, score, action, 'error-codes': errorCodes } = response.data;

            if (success && score >= 0.7 && action === expectedAction) {
                return next();
            }

            console.warn('[reCAPTCHA] Verification failed:', { success, score, action, expectedAction, errorCodes });
            return res.status(401).json({ message: 'reCAPTCHA verification failed. Please try again.' });

        } catch (error) {
            console.error('[reCAPTCHA] Verification request failed:', error.message);
            return res.status(500).json({ message: 'Server error during reCAPTCHA verification.' });
        }
    };
}