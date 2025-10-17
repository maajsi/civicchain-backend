const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/database');

/**
 * Middleware to verify JWT token and attach user info to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const client = await pool.connect();
    try {
      const { user_id, email, sub } = decoded || {};
      let userRow = null;

      if (user_id) {
        const r = await client.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
        userRow = r.rows[0] || null;
      }
      if (!userRow && email) {
        const r = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        userRow = r.rows[0] || null;
      }
      if (!userRow && sub) {
        const r = await client.query('SELECT * FROM users WHERE provider_id = $1', [sub]);
        userRow = r.rows[0] || null;
      }

      if (!userRow) {
        return res.status(401).json({
          success: false,
          error: 'User not found for token'
        });
      }

      req.user = userRow;
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Middleware to check if user is government role
 */
const requireGovernment = (req, res, next) => {
  if (!req.user || req.user.role !== 'government') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Government role required.'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  requireGovernment
};
