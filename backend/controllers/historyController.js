// controllers/historyController.js
import FileHistory from '../models/FileHistory.js';
import User from '../models/User.js';

// ─────────────────────────────────────────────────────────
// GET /api/history?page=1&limit=5
// Only returns files whose IDs are in the user's fileHistory array
// ─────────────────────────────────────────────────────────
export const getUserHistory = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 5);
    const skip  = (page - 1) * limit;
    const userId = req.user._id;

    // 1. Get the user's visible history list (references)
    const user = await User.findById(userId).select('fileHistory').lean();
    const visibleIds = user?.fileHistory || [];

    // 2. Only return documents whose _id is in that array
    const filter = {
      userId,
      _id: { $in: visibleIds }
    };

    const [total, history] = await Promise.all([
      FileHistory.countDocuments(filter),
      FileHistory.find(filter)
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({ history, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Fetch History Error:', err);
    res.status(500).json({ message: 'Server error fetching history.' });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/history/stats
// Aggregates only files referenced in the user's fileHistory array
// ─────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Load user's visible history references
    const user = await User.findById(userId).select('fileHistory').lean();
    const visibleIds = user?.fileHistory || [];

    // Build a base match stage that only looks at those documents
    const matchStage = {
      userId,
      _id: { $in: visibleIds }
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [totals, topFormatResult, weeklyRaw] = await Promise.all([
      // Total files + total storage saved
      FileHistory.aggregate([
        { $match: matchStage },
        { $group: { _id: null, totalFiles: { $sum: 1 }, storageSaved: { $sum: '$sizeInBytes' } } }
      ]),
      // Most used output format
      FileHistory.aggregate([
        { $match: matchStage },
        { $group: { _id: '$format', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]),
      // Daily counts for last 7 days
      FileHistory.aggregate([
        { $match: { ...matchStage, processedAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$processedAt' } }, count: { $sum: 1 } } }
      ])
    ]);

    // Fill in 0s for days with no activity
    const weeklyMap = {};
    weeklyRaw.forEach(r => { weeklyMap[r._id] = r.count; });

    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      weeklyActivity.push({
        day:   d.toLocaleDateString('en-US', { weekday: 'short' }),
        date:  dateStr,
        count: weeklyMap[dateStr] || 0,
      });
    }

    res.json({
      totalFiles:   totals[0]?.totalFiles   || 0,
      storageSaved: totals[0]?.storageSaved || 0,
      topFormat:    topFormatResult[0]?._id  || null,
      weeklyActivity,
    });

  } catch (err) {
    console.error('Dashboard Stats Error:', err);
    res.status(500).json({ message: 'Server error fetching dashboard stats.' });
  }
};