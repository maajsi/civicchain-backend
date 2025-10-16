const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { Keypair } = require('@solana/web3.js');
const { fundWallet } = require('../config/solana');
require('dotenv').config();

/**
 * POST /auth/login
 * Handle Google OAuth login, create or retrieve user, return JWT
 */
async function login(req, res) {
  const client = await pool.connect();
  
  try {
    const { email, name, profile_pic } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required'
      });
    }

    // Check if user exists
    const existingUserQuery = 'SELECT * FROM users WHERE email = $1';
    const existingUserResult = await client.query(existingUserQuery, [email]);

    let user;
    let isNew = false;

    if (existingUserResult.rows.length > 0) {
      // Existing user
      user = existingUserResult.rows[0];
      isNew = false;
    } else {
      // New user - create wallet and user account
      const newWallet = Keypair.generate();
      const walletAddress = newWallet.publicKey.toString();
      
      // Create user in database
      const insertUserQuery = `
        INSERT INTO users (
          user_id, email, name, profile_pic, wallet_address, 
          role, rep, privy_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const userId = uuidv4();
      const privyUserId = `privy_${userId}`; // Placeholder for Privy integration
      
      const insertResult = await client.query(insertUserQuery, [
        userId,
        email,
        name,
        profile_pic || null,
        walletAddress,
        'citizen',
        100,
        privyUserId
      ]);
      
      user = insertResult.rows[0];
      isNew = true;

      // Fund wallet with devnet SOL
      try {
        const txSignature = await fundWallet(walletAddress, 0.05);
        console.log(`💰 Funded new wallet ${walletAddress} with 0.05 SOL. Tx: ${txSignature}`);
      } catch (fundError) {
        console.warn('⚠️  Failed to fund wallet:', fundError.message);
        // Continue anyway - wallet funding is not critical for development
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        wallet_address: user.wallet_address
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Return response
    return res.status(200).json({
      success: true,
      is_new: isNew,
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
      },
      jwt_token: token
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  login
};
