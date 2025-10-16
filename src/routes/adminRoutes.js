const express = require('express');
const router = express.Router();
const { getDashboard, getAdminIssues } = require('../controllers/adminController');
const { authMiddleware, requireGovernment } = require('../middleware/auth');

// GET /admin/dashboard - Get dashboard statistics
router.get('/dashboard', authMiddleware, requireGovernment, getDashboard);

// GET /admin/issues - Get all issues with advanced filters
router.get('/issues', authMiddleware, requireGovernment, getAdminIssues);

module.exports = router;
