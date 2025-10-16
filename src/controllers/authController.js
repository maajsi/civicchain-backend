const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const { fundWallet, createUserOnChain } = require('../services/solanaService');
const { createCustodialWallet, getPrivyWallet } = require('../services/privyService');
require('dotenv').config();

/**
 * POST /auth/login
 * Handle NextAuth JWT verification, create or retrieve user
 * Expects JWT in request body, validates it, creates/returns user
 * Uses Privy for custodial wallet management
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
      console.log('✅ JWT verified successfully:', { email: decoded.email, sub: decoded.sub });
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired JWT token',
        details: jwtError.message
      });
    }

    // Extract user data from JWT payload
    // NextAuth JWTs typically have: email, name, picture, sub (user ID), iat, exp
    const { email, name, picture, sub } = decoded;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required in JWT payload'
      });
    }

    // Check if user exists by email or provider_id
    let existingUserQuery = 'SELECT * FROM users WHERE email = $1';
    let existingUserResult = await client.query(existingUserQuery, [email]);

    // If not found by email and we have a provider_id (sub), try that
    if (existingUserResult.rows.length === 0 && sub) {
      existingUserQuery = 'SELECT * FROM users WHERE provider_id = $1';
      existingUserResult = await client.query(existingUserQuery, [sub]);
    }

    let user;
    let isNew = false;

    if (existingUserResult.rows.length > 0) {
      // Existing user - update provider_id if not set
      user = existingUserResult.rows[0];
      
      if (!user.provider_id && sub) {
        const updateQuery = 'UPDATE users SET provider_id = $1 WHERE user_id = $2 RETURNING *';
        const updateResult = await client.query(updateQuery, [sub, user.user_id]);
        user = updateResult.rows[0];
        console.log(`✅ Updated provider_id for existing user: ${email}`);
      }
      
      isNew = false;
      console.log(`✅ Existing user logged in: ${email}`);
    } else {
      const userId = uuidv4();
      let walletAddress;
      let privyUserId;

      try {
        const privyWallet = await createCustodialWallet(userId, email);
        walletAddress = privyWallet.walletAddress;
        privyUserId = privyWallet.privyUserId;
        console.log(`✅ Created Privy custodial wallet: ${walletAddress}`);
      } catch (privyError) {
        if (privyError.message?.includes('existing user')) {
          const match = privyError.message.match(/(did:privy:[^\s]+)/);
          if (!match) {
            throw privyError;
          }
          privyUserId = match[1];
          walletAddress = await getPrivyWallet(privyUserId);
          console.log(`ℹ️  Reusing existing Privy wallet: ${walletAddress}`);
        } else {
          console.error('❌ Failed to create Privy wallet:', privyError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create custodial wallet',
            details: privyError.message
          });
        }
      }

      const insertUserQuery = `
        INSERT INTO users (
          user_id, email, name, profile_pic, wallet_address,
          role, rep, privy_user_id, provider_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const providerId = sub || null;

      try {
        const insertResult = await client.query(insertUserQuery, [
          userId,
          email,
          name || 'User',
          picture || null,
          walletAddress,
          'citizen',
          100,
          privyUserId,
          providerId
        ]);
        user = insertResult.rows[0];
        isNew = true;
      } catch (insertError) {
        if (insertError.code === '23505') {
          const conflictResult = await client.query(
            'SELECT * FROM users WHERE privy_user_id = $1',
            [privyUserId]
          );
          if (!conflictResult.rows.length) {
            throw insertError;
          }
          user = conflictResult.rows[0];
          isNew = false;
          console.log(`ℹ️  Detected concurrent login, using existing user: ${email}`);
        } else {
          throw insertError;
        }
      }

      if (isNew) {
        try {
          const txSignature = await fundWallet(walletAddress, 0.05);
          console.log(`💰 Funded new wallet ${walletAddress} with 0.05 SOL. Tx: ${txSignature}`);
        } catch (fundError) {
          console.warn('⚠️  Failed to fund wallet:', fundError.message);
        }

        try {
          const blockchainTx = await createUserOnChain(walletAddress, 100, 'citizen');
          if (blockchainTx) {
            console.log(`🔗 User created on-chain. Tx: ${blockchainTx}`);
          }
        } catch (blockchainError) {
          console.warn('⚠️  Failed to create user on-chain:', blockchainError.message);
        }

        console.log(`✅ New user created: ${email}`);
      }
    }

    // Return response (no JWT generation here, NextAuth handles it)
    return res.status(200).json({
      success: true,
      is_new: isNew,
      user: {
        user_id: user.user_id,
        provider_id: user.provider_id,
        email: user.email,
        name: user.name,
        profile_pic: user.profile_pic,
        wallet_address: user.wallet_address,
        privy_user_id: user.privy_user_id,
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
      error: 'Authentication failed',
      details: error.message
    });
  } finally {
    client.release();
  }
}

module.exports = {
  login
};
