import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { handleChat } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/', authenticateToken, chatLimiter, handleChat);

export default router;