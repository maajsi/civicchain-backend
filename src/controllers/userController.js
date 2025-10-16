const db = require('../db');

async function getCurrentUser(req, res) {
  try {
    const userId = req.user.user_id;
    
    const result = await db.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    return res.json({
      success: true,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.name,
        profile_pic: user.profile_pic,
        wallet_address: user.wallet_address,
        role: user.role,
        rep: user.rep,
        issues_reported: user.issues_reported,
        issues_resolved: user.issues_resolved,
        total_upvotes: user.total_upvotes,
        verifications_done: user.verifications_done,
        badges: user.badges,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
}

async function getUserById(req, res) {
  try {
    const { user_id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM users WHERE user_id = $1',
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = result.rows[0];
    
    // Return public profile (excluding sensitive info)
    return res.json({
      success: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        profile_pic: user.profile_pic,
        wallet_address: user.wallet_address,
        role: user.role,
        rep: user.rep,
        issues_reported: user.issues_reported,
        issues_resolved: user.issues_resolved,
        total_upvotes: user.total_upvotes,
        verifications_done: user.verifications_done,
        badges: user.badges,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
}

module.exports = {
  getCurrentUser,
  getUserById
};
