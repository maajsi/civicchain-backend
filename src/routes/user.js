const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

// GET /api/user/me
router.get('/me', authenticateToken, userController.getCurrentUser);

// GET /api/user/:user_id
router.get('/:user_id', authenticateToken, userController.getUserById);

module.exports = router;
