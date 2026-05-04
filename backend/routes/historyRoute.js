// routes/historyRoute.js
import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getUserHistory, getDashboardStats } from '../controllers/historyController.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/history/stats  — dashboard aggregations (must be before /)
router.get('/stats', authenticateToken, getDashboardStats);

// GET /api/history?page=1&limit=5
router.get('/', authenticateToken, getUserHistory);

// DELETE /api/history – clear all OR remove selected
router.delete('/', authenticateToken, async (req, res) => {
    const { ids } = req.body;

    if (ids && Array.isArray(ids) && ids.length > 0) {
        // Convert string IDs to ObjectId for proper matching in $pull
        const validIds = ids
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid history IDs provided.' });
        }

        await User.findByIdAndUpdate(req.user.id, {
            $pull: { fileHistory: { $in: validIds } }
        });
        return res.json({ message: `${validIds.length} item(s) removed.` });
    }

    // No IDs – clear everything
    await User.findByIdAndUpdate(req.user.id, { $set: { fileHistory: [] } });
    res.json({ message: 'History cleared' });
});

export default router;