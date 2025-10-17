const pool = require('../config/database');

/**
 * GET /user/me
 * Get current authenticated user's profile
 */
async function getCurrentUser(req, res) {
  const client = await pool.connect();
  
  try {
    // Use email from JWT to look up user (consistent with /auth/login)
    const email = req.user.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email not found in token'
      });
    }

    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await client.query(query, [email]);

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
        provider_id: user.provider_id,
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

    // Accept both UUID and provider_id string
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let query, value;
    if (uuidRegex.test(user_id)) {
      query = 'SELECT * FROM users WHERE user_id = $1';
      value = user_id;
    } else {
      query = 'SELECT * FROM users WHERE provider_id = $1';
      value = user_id;
    }

    const result = await client.query(query, [value]);

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
        provider_id: user.provider_id,
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
