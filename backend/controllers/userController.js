import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { v2 as cloudinary } from 'cloudinary';

// ─────────────────────────────────────────────────────────
// GET /api/user/profile
// ─────────────────────────────────────────────────────────
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json(user);
    } catch (err) {
        console.error('Fetch User Error:', err.message);
        res.status(500).json({ message: 'Server error fetching user data.' });
    }
};

// ─────────────────────────────────────────────────────────
// PUT /api/user/profile
// ─────────────────────────────────────────────────────────
export const updateUserProfile = async (req, res) => {
    console.log('Update Profile Request:', req.file ? 'PRESENT' : 'ABSENT');

    try {
        const user = await User.findById(req.user._id).select('+profilePicturePublicId');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { name } = req.body;
        let hasChanges = false;

        if (name && name !== user.name) {
            user.name = name.trim().replace(/[<>]/g, '');
            hasChanges = true;
        }

        if (req.file?.secure_url) {
            if (user.profilePicturePublicId) {
                try {
                    await cloudinary.uploader.destroy(user.profilePicturePublicId);
                    console.log(`🗑️ Deleted old profile picture: ${user.profilePicturePublicId}`);
                } catch (err) {
                    console.warn('⚠️ Could not delete old profile picture:', err.message);
                }
            }
            user.profilePictureUrl      = req.file.secure_url.trim();
            user.profilePicturePublicId = req.file.public_id || null;
            hasChanges = true;
        }

        if (hasChanges) await user.save();

        const updatedUser = await User.findById(req.user._id).select('-password');
        res.json({ message: 'Profile updated successfully.', user: updatedUser });

    } catch (err) {
        console.error('Update Profile Error:', err.message);
        if (err.message?.includes('Cloudinary not configured')) {
            return res.status(400).json({ message: 'Profile picture upload unavailable. Name updated successfully.' });
        }
        res.status(500).json({ message: 'Server error updating profile.' });
    }
};

// ─────────────────────────────────────────────────────────
// POST /api/user/change-password
// Verifies current password, sets new one, revokes all
// sessions so the user must log in again on all devices.
// Google users (no password) cannot use this endpoint.
// ─────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters.' });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different from current password.' });
        }

        // Fetch user with password field (select: false by default)
        const user = await User.findById(req.user._id).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Google users don't have a password
        if (user.authProvider !== 'email') {
            return res.status(400).json({ message: 'Password change is not available for Google accounts.' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Update password — the User model's pre-save hook hashes it
        user.password = newPassword;
        user.passwordChangedAt = new Date();
        await user.save();

        // Revoke ALL sessions — user must log in again on all devices
        await Session.deleteMany({ user: req.user._id });

        // Clear the refresh token cookie on this device
        res.clearCookie('jwt_refresh', {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path:     '/',
        });

        console.log(`✅ Password changed for user ${req.user._id} — all sessions revoked`);
        return res.json({
            message: 'Password changed successfully. Please log in again.',
            logoutRequired: true,
        });

    } catch (err) {
        console.error('Change Password Error:', err.message);
        res.status(500).json({ message: 'Server error changing password.' });
    }
};