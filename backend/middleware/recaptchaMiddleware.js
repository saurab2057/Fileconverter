import axios from 'axios';

export async function verifyRecaptcha(req, res, next) {

    if (process.env.NODE_ENV === 'test') return next();
      
    console.log('--- verifyRecaptcha MIDDLEWARE IS FIRING! ---');
    const token = req.body['recaptcha-token'];

    if (!token) {
        console.log("Recaptcha Token is not present.");
        return res.status(400).json({ message: 'reCAPTCHA token is missing.' });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    // ✅ Fixed: Removed trailing spaces in URL
    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    try {
        const response = await axios.post(verificationURL);
        const { success, score, 'error-codes': errorCodes } = response.data;

        console.log(`Google reCAPTCHA Score: ${score}`);

        if (success && score >= 0.7) {
            // Verification passed, proceed to the next function (the login logic)
            next();
        } else {
            console.log('reCAPTCHA verification failed:', { success, score, errorCodes });
            return res.status(401).json({ message: 'reCAPTCHA verification failed. You may be a bot.' });
        }
    } catch (error) {
        console.error('Server error during reCAPTCHA verification:', error.message);
        return res.status(500).json({ message: 'Server error during reCAPTCHA verification.' });
    }
}