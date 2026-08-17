import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { userReadLimiter, userWriteLimiter } from '../middleware/rateLimiter.js';
import cloudinaryParser from '../middleware/cloudinary.cjs';
import { getUserProfile, updateUserProfile, changePassword } from '../controllers/userController.js';
import { changePasswordValidation } from '../middleware/validation.js'; 
const router = express.Router();

// GET /api/user/profile
router.get('/profile', [authenticateToken, userReadLimiter], getUserProfile);

// PUT /api/user/profile
router.put('/profile', [authenticateToken, userWriteLimiter, cloudinaryParser], updateUserProfile);

// POST /api/user/change-password
router.post('/change-password', [authenticateToken, userWriteLimiter, changePasswordValidation], changePassword);

export default router;