import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import { hashIP } from '../utils/authSecurity.js'; // ✅ ADD THIS
import UserMetadata from '../models/UserMetadata.js';

export async function saveUserMetadata(req, userId) {

    // 🔒 Skip metadata collection during tests to avoid external API calls and irrelevant logs
    if (process.env.NODE_ENV === 'test') return;

    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

        // Skip local IPs to avoid errors during development
        if (ip === '::1' || ip === '127.0.0.1') {
            console.log('🧪 Localhost IP detected. Skipping metadata storage.');
            return;
        }

        const userAgent = req.headers['user-agent'] || '';
        console.log('📥 Updating metadata for user:', userId);
        console.log('🌐 IP:', ip);
        console.log('🧠 UA:', userAgent);

        const parser = new UAParser();
        parser.setUA(userAgent);
        const uaResult = parser.getResult();

        const geoRes = await axios.get(`https://ipwho.is/${ip}`);
        console.log('📍 Location:', geoRes.data);

        const filter = { user: userId };

        const update = {
            ipHash: hashIP(ip), // ✅ CHANGED: Store hashed IP instead of raw IP
            location: {
                country: geoRes.data.country || '',
                region: geoRes.data.region || '',
                city: geoRes.data.city || '',
            },
            device: {
                type: uaResult.device.type || 'desktop',
                browser: uaResult.browser.name || '',
                os: uaResult.os.name || '',
            },
            userAgent,
        };

        const options = {
            upsert: true,
            new: true,
        };

        const doc = await UserMetadata.findOneAndUpdate(filter, update, options);

        console.log('✅ User metadata upserted:', doc._id);

    } catch (err) {
        if (err.isAxiosError) {
            console.error('❌ Error fetching geolocation ', err.response?.data || err.message);
        } else {
            console.error('❌ Error saving user meta', err.message);
        }
    }
}