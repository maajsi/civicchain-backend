const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/admin/dashboard
router.get('/dashboard', authenticateToken, requireRole('government'), adminController.getDashboard);

// GET /api/admin/issues
router.get('/issues', authenticateToken, requireRole('government'), adminController.getAdminIssues);

module.exports = router;
