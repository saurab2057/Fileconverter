// --- ADMIN CONTROLLER ---
import os from 'os';
import User from '../models/User.js';
import FileHistory from '../models/FileHistory.js';
import Config from '../models/Config.js';
import AuditLog from '../models/AuditLog.js';
import ActivityLog from '../models/ActivityLog.js';
import Session from '../models/Session.js';
import mongoose from 'mongoose';
import { logAdminAction } from '../middleware/auditLogger.js';
import UserMetadata from '../models/UserMetadata.js';

// --- GET DASHBOARD STATS ---
export const getDashboardStats = async (req, res) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const totalUsers = await User.countDocuments();
        const successfulJobs = await FileHistory.countDocuments({
            processedAt: { $gte: twentyFourHoursAgo }
        });
        const failedJobs = 0;

        const cpus = os.cpus().length;
        const loadAvg = os.loadavg()[0];
        const serverLoad = Math.min(100, Math.round((loadAvg / cpus) * 100));

        res.json({
            totalUsers: { value: totalUsers },
            successfulJobs: { value: successfulJobs },
            failedJobs: { value: failedJobs },
            serverLoad: { value: `${serverLoad}%` }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats.' });
    }
};

// --- GET JOBS WITH PAGINATION ---
export const getJobs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const total = await FileHistory.countDocuments();

        const jobs = await FileHistory.find()
            .populate('userId', 'email name')
            .sort({ processedAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            jobs,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext: skip + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Jobs fetch error:', error);
        res.status(500).json({ message: 'Error fetching jobs.' });
    }
};

// --- GET USERS WITH PAGINATION + SEARCH ---
export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const search = (req.query.search || '').trim();
        const skip = (page - 1) * limit;

        // 🔒 Escape regex special characters to prevent ReDoS attacks
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const searchFilter = search
            ? {
                $or: [
                    { email: { $regex: escapedSearch, $options: 'i' } },
                    { name: { $regex: escapedSearch, $options: 'i' } }
                ]
            }
            : {};

        const total = await User.countDocuments(searchFilter);

        const users = await User.aggregate([
            { $match: searchFilter },
            {
                $lookup: {
                    from: 'usermetadatas',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'metadataEntries'
                }
            },
            {
                $addFields: {
                    latestMeta: {
                        $arrayElemAt: [
                            { $sortArray: { input: '$metadataEntries', sortBy: { createdAt: -1 } } },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    refreshToken: 0,
                    metadataEntries: 0,
                    __v: 0
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        res.json({
            users,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext: skip + limit < total,
                hasPrev: page > 1,
                search
            }
        });
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ message: 'Error fetching users.' });
    }
};

// --- UPDATE USER ---
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, role } = req.body;

        // 🔒 VALIDATE MONGODB ID FORMAT
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }

        // 🔒 SELF-ACTION PREVENTION — admin cannot modify their own account
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'Cannot modify your own account.' });
        }

        // 🔒 FETCH CURRENT USER
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // 🔒 LAST ADMIN PROTECTION — cannot demote last admin
        if (role === 'user' && user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot demote the last admin.' });
            }
        }

        // 🔒 CANNOT BAN LAST ACTIVE ADMIN
        if (status === 'banned' && user.role === 'admin') {
            const activeAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
            if (activeAdminCount <= 1) {
                return res.status(400).json({ message: 'Cannot ban the last active admin.' });
            }
        }

        // 🔒 TRACK CHANGES FOR AUDIT
        const changes = {};
        if (status && user.status !== status) {
            changes.previousStatus = user.status;
            changes.newStatus = status;
            user.status = status;
            // ✅ Stamp bannedAt when banning, clear it when unbanning
            user.bannedAt = status === 'banned' ? new Date() : null;
        }
        if (role && user.role !== role) {
            changes.previousRole = user.role;
            changes.newRole = role;
            user.role = role;
        }

        // 🔒 SAVE CHANGES
        await user.save();

        // ✅ INSTANT SESSION KILL — if banned, revoke all active sessions immediately
        if (status === 'banned') {
            await Session.deleteMany({ user: id });
            console.log(`🔒 All sessions revoked for banned user ${id}`);
        }

        // 🔒 AUDIT LOG
        await logAdminAction(
            req.user._id,
            'USER_UPDATED',
            `User:${id}`,
            changes,
            req.ip,
            req.get('user-agent')
        );

        // 🔒 RETURN FRESH USER DATA
        const updatedUser = await User.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(id) } },
            {
                $lookup: {
                    from: 'usermetadatas',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'metadataEntries'
                }
            },
            {
                $addFields: {
                    latestMeta: {
                        $arrayElemAt: [
                            { $sortArray: { input: '$metadataEntries', sortBy: { createdAt: -1 } } },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    refreshToken: 0,
                    metadataEntries: 0,
                    __v: 0
                }
            }
        ]);

        res.json({
            message: 'User updated successfully.',
            user: updatedUser[0],
            changes
        });
    } catch (error) {
        console.error('User update error:', error);
        res.status(500).json({ message: 'Error updating user.' });
    }
};

// --- GET SYSTEM CONFIGURATION ---
export const getConfig = async (req, res) => {
    try {
        const config = await Config.findOne({ key: 'main_config' });
        if (!config) return res.status(404).json({ message: 'Configuration not found.' });
        res.json(config);
    } catch (error) {
        console.error('Config fetch error:', error);
        res.status(500).json({ message: 'Error fetching configuration.' });
    }
};

// --- UPDATE SYSTEM CONFIGURATION ---
export const updateConfig = async (req, res) => {
    try {
        const { key, _id, createdAt, updatedAt, ...allowedUpdates } = req.body;
        const currentConfig = await Config.findOne({ key: 'main_config' });

        if (!currentConfig) {
            return res.status(404).json({ message: 'Configuration not found.' });
        }

        const changes = {};
        Object.keys(allowedUpdates).forEach(field => {
            if (currentConfig[field] !== allowedUpdates[field]) {
                changes[field] = { old: currentConfig[field], new: allowedUpdates[field] };
            }
        });

        const config = await Config.findOneAndUpdate(
            { key: 'main_config' },
            { $set: allowedUpdates },
            { new: true, upsert: true, runValidators: true }
        );

        await logAdminAction(
            req.user._id,
            'CONFIG_UPDATED',
            'Config:main',
            changes,
            req.ip,
            req.get('user-agent')
        );

        res.json({
            message: 'Configuration updated successfully.',
            config,
            changes
        });
    } catch (error) {
        console.error('Config update error:', error);
        res.status(500).json({ message: 'Error updating configuration.' });
    }
};

// --- GET AUDIT LOGS ---
export const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;

        const actionFilter = req.query.action;
        const userIdFilter = req.query.userId;
        const ipFilter = req.query.ipAddress;

        const query = {};
        if (actionFilter) query.action = actionFilter;
        if (userIdFilter && mongoose.Types.ObjectId.isValid(userIdFilter)) {
            query.userId = userIdFilter;
        }
        if (ipFilter) query.ipAddress = { $regex: ipFilter, $options: 'i' };

        const total = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query)
            .populate('userId', 'email name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            logs,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext: skip + limit < total,
                hasPrev: page > 1
            },
            filters: { action: actionFilter, userId: userIdFilter, ipAddress: ipFilter }
        });
    } catch (error) {
        console.error('Audit logs fetch error:', error);
        res.status(500).json({ message: 'Error fetching audit logs.' });
    }
};

// --- GET ACTIVITY LOGS ---
export const getActivityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;

        const actionFilter = req.query.action;
        const userIdFilter = req.query.userId;

        const query = {};
        if (actionFilter) query.action = actionFilter;
        if (userIdFilter && mongoose.Types.ObjectId.isValid(userIdFilter)) {
            query.userId = userIdFilter;
        }

        const total = await ActivityLog.countDocuments(query);
        const logs = await ActivityLog.find(query)
            .populate('userId', 'email name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            logs,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext: skip + limit < total,
                hasPrev: page > 1
            },
            filters: { action: actionFilter, userId: userIdFilter }
        });
    } catch (error) {
        console.error('Activity logs fetch error:', error);
        res.status(500).json({ message: 'Error fetching activity logs.' });
    }
};

// --- DELETE USER (PERMANENT) ---
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }

        // 🔒 Cannot delete yourself
        if (req.user._id.toString() === id) {
            return res.status(400).json({ message: 'Cannot delete your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // 🔒 Cannot delete last admin
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin.' });
            }
        }

        // 🔒 Delete sessions, file history, metadata and then user
        // 🔒 Delete all user data (GDPR Art.17 — right to erasure)
        await Session.deleteMany({ user: id });
        await FileHistory.deleteMany({ userId: id });
        await UserMetadata.deleteMany({ user: id });
        await User.findByIdAndDelete(id);         //triggers passkey cascade in User.js hook


        // 🔒 Audit log
        await logAdminAction(
            req.user._id,
            'USER_DELETED',
            `User:${id}`,
            { deletedUser: user.email, name: user.name },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: `User "${user.name}" has been permanently deleted.` });

    } catch (error) {
        console.error('User delete error:', error);
        res.status(500).json({ message: 'Error deleting user.' });
    }
};

// --- DELETE AUDIT LOGS (DISABLED FOR COMPLIANCE) ---
export const deleteAuditLog = (req, res) => {
    res.status(403).json({
        message: 'Audit logs are immutable and cannot be deleted. Contact security team for legal holds.'
    });
};