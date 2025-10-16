const pool = require('../config/database');

/**
 * GET /user/me
 * Get current authenticated user's profile
 */
async function getCurrentUser(req, res) {
  const client = await pool.connect();
  
  try {
    const userId = req.user.user_id;

    const query = 'SELECT * FROM users WHERE user_id = $1';
    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
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
      error: 'Failed to fetch user profile'
    });
  } finally {
    client.release();
  }
}

/**
 * GET /user/:user_id
 * Get public profile of any user
 */
async function getUserById(req, res) {
  const client = await pool.connect();
  
  try {
    const { user_id } = req.params;

    const query = 'SELECT * FROM users WHERE user_id = $1';
    const result = await client.query(query, [user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Return public profile (exclude sensitive info like email)
    return res.status(200).json({
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
      error: 'Failed to fetch user profile'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getCurrentUser,
  getUserById
};
