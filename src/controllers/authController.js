const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db');
const { initializeUserOnChain, fundWallet } = require('../utils/solana');
const { Keypair } = require('@solana/web3.js');

async function login(req, res) {
  try {
    const { email, name, profile_pic } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required'
      });
    }
    
    // Check if user exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      // Existing user - return user data
      const user = existingUser.rows[0];
      
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      
      return res.json({
        success: true,
        is_new: false,
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
    }
    
    // New user - create account
    const user_id = uuidv4();
    
    // Generate a new wallet keypair (custodial wallet)
    const walletKeypair = Keypair.generate();
    const wallet_address = walletKeypair.publicKey.toString();
    
    // Create a mock Privy user ID (in production, this would come from Privy)
    const privy_user_id = `privy_${uuidv4()}`;
    
    // Insert new user into database
    const newUserResult = await db.query(`
      INSERT INTO users (
        user_id, privy_user_id, wallet_address, email, name, profile_pic, role, rep
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [user_id, privy_user_id, wallet_address, email, name, profile_pic, 'citizen', config.reputation.initial]);
    
    const newUser = newUserResult.rows[0];
    
    // Fund the new wallet with SOL (async - don't block the response)
    fundWallet(wallet_address, config.wallet.fundingAmount)
      .then(signature => {
        console.log(`Successfully funded new user wallet ${wallet_address}. Tx: ${signature}`);
      })
      .catch(error => {
        console.error(`Failed to fund new user wallet ${wallet_address}:`, error.message);
      });
    
    // Initialize user on-chain (async)
    initializeUserOnChain(wallet_address, config.reputation.initial)
      .then(txHash => {
        console.log(`Initialized user on-chain. Tx: ${txHash}`);
      })
      .catch(error => {
        console.error('Failed to initialize user on-chain:', error.message);
      });
    
    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: newUser.user_id,
        email: newUser.email,
        role: newUser.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    return res.status(201).json({
      success: true,
      is_new: true,
      user: {
        user_id: newUser.user_id,
        email: newUser.email,
        name: newUser.name,
        profile_pic: newUser.profile_pic,
        wallet_address: newUser.wallet_address,
        role: newUser.role,
        rep: newUser.rep,
        issues_reported: newUser.issues_reported,
        issues_resolved: newUser.issues_resolved,
        total_upvotes: newUser.total_upvotes,
        verifications_done: newUser.verifications_done,
        badges: newUser.badges,
        created_at: newUser.created_at
      },
      jwt_token: token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

module.exports = {
  login
};
