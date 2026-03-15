import FileHistory from '../models/FileHistory.js';

// ─────────────────────────────────────────────────────────
// GET /api/history?page=1&limit=5
// ─────────────────────────────────────────────────────────
export const getUserHistory = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 5);
    const skip  = (page - 1) * limit;
    const userId = req.user._id;

    const [total, history] = await Promise.all([
      FileHistory.countDocuments({ userId }),
      FileHistory
        .find({ userId })
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
// Runs 3 aggregations in parallel — real data, no dummies
// ─────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [totals, topFormatResult, weeklyRaw] = await Promise.all([

      // Total files + total storage saved
      FileHistory.aggregate([
        { $match: { userId } },
        { $group: { _id: null, totalFiles: { $sum: 1 }, storageSaved: { $sum: '$sizeInBytes' } } }
      ]),

      // Most used output format
      FileHistory.aggregate([
        { $match: { userId } },
        { $group: { _id: '$format', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]),

      // Daily counts for last 7 days
      FileHistory.aggregate([
        { $match: { userId, processedAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$processedAt' } }, count: { $sum: 1 } } }
      ]),
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