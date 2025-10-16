const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { Keypair } = require('@solana/web3.js');
const { fundWallet, createUserOnChain } = require('../services/solanaService');
require('dotenv').config();

/**
 * POST /auth/login
 * Handle NextAuth JWT verification, create or retrieve user
 * Expects JWT in request body, validates it, creates/returns user
 */
async function login(req, res) {
  const client = await pool.connect();
  
  try {
    const { jwt_token } = req.body;

    if (!jwt_token) {
      return res.status(400).json({
        success: false,
        error: 'JWT token is required'
      });
    }

    // Verify and decode JWT from NextAuth
    let decoded;
    try {
      decoded = jwt.verify(jwt_token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired JWT token'
      });
    }

    const { email, name, picture } = decoded;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required in JWT'
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
        picture || null,
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

      // Create user on Solana blockchain
      try {
        const blockchainTx = await createUserOnChain(walletAddress, 100, 'citizen');
        console.log(`⛓️  Created user on-chain: ${blockchainTx}`);
      } catch (blockchainError) {
        console.warn('⚠️  Failed to create user on-chain:', blockchainError.message);
      }
    }

    // Return response (no JWT generation here, NextAuth handles it)
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
      }
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
