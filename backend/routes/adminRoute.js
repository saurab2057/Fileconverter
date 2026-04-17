import express from 'express';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';
import { validateUserUpdate, validateConfigUpdate } from '../middleware/validation.js';
import {
    getDashboardStats,
    getJobs,
    getUsers,
    updateUser,
    getConfig,
    updateConfig,
    getAuditLogs,
    getActivityLogs,
    deleteAuditLog,
    deleteUser,
    getChainStatus,
    verifyChain,
} from '../controllers/adminController.js';

const router = express.Router();

router.use(adminLimiter);
router.use(authenticateToken, isAdmin);

// --- GET DASHBOARD STATS ---
router.get('/stats', getDashboardStats);

// --- GET JOBS WITH PAGINATION ---
router.get('/jobs', getJobs);

// --- GET USERS WITH PAGINATION + SEARCH ---
router.get('/users', getUsers);

// --- UPDATE USER (WITH VALIDATION + FRESH DATA RETURN) ---
router.put('/users/:id', validateUserUpdate, updateUser);

// --- GET SYSTEM CONFIGURATION ---
router.get('/config', getConfig);

// --- UPDATE SYSTEM CONFIGURATION (WITH VALIDATION) ---
router.put('/config', validateConfigUpdate, updateConfig);

// --- AUDIT LOG CHAIN INTEGRITY ---
// Must be declared BEFORE the generic /audit-logs/:id route to avoid shadowing
router.get('/audit-logs/chain-status', getChainStatus);
router.get('/audit-logs/verify-chain', verifyChain);

// --- GET AUDIT LOGS (PAGINATED + FILTERABLE) ---
router.get('/audit-logs', getAuditLogs);

// --- GET ACTIVITY LOGS (PAGINATED + FILTERABLE) ---
router.get('/activity-logs', getActivityLogs);

// --- DELETE USER PERMANENTLY ---
router.delete('/users/:id', deleteUser);

// --- DELETE AUDIT LOGS (DISABLED FOR COMPLIANCE) ---
router.delete('/audit-logs/:id', deleteAuditLog);

export default router;