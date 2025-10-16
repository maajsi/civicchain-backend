const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware to verify JWT token and attach user info to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = decoded;
    
    next();
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
  if (req.user.role !== 'government') {
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
