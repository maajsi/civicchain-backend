const express = require('express');
const router = express.Router();
const { getCurrentUser, getUserById } = require('../controllers/userController');
const { authMiddleware } = require('../middleware/auth');

// GET /user/me - Get current user profile
router.get('/me', authMiddleware, getCurrentUser);

// GET /user/:user_id - Get user profile by ID
router.get('/:user_id', authMiddleware, getUserById);

module.exports = router;
