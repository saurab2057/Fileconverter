import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getUserHistory, getDashboardStats } from '../controllers/historyController.js';

const router = express.Router();

// GET /api/history/stats  — dashboard aggregations (must be before /)
router.get('/stats', authenticateToken, getDashboardStats);

// GET /api/history?page=1&limit=5
router.get('/', authenticateToken, getUserHistory);

export default router;