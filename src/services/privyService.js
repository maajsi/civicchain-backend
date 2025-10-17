require('dotenv').config();

// Initialize Privy client with proper error handling using dynamic import (ESM compatibility)
let privyClient = null;

async function getPrivyClient() {
  if (!privyClient) {
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      throw new Error('Privy credentials not configured. Check PRIVY_APP_ID and PRIVY_APP_SECRET.');
    }
    
    try {
      const module = await import('@privy-io/node');
      privyClient = new module.PrivyClient({
        appId: process.env.PRIVY_APP_ID,
        appSecret: process.env.PRIVY_APP_SECRET,
      });
      console.log('✅ Privy client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Privy client:', error.message);
      throw error;
    }
  }
  return privyClient;
}

/**
 * Create a custodial wallet for a user using Privy
 * @param {string} userId - User ID from database
 * @param {string} email - User's email
 * @returns {Promise<{walletAddress: string, privyUserId: string, walletId: string}>}
 */
async function createCustodialWallet(userId, email) {
  const client = await getPrivyClient();

  try {
    // Create user with email and Solana embedded wallet in one call
    const privyUser = await client.users().create({
      linked_accounts: [
        {
          type: 'email',
          address: email
        }
      ],
      wallets: [
        {
          chain_type: 'solana'
        }
      ]
    });

    console.log(`✅ Created Privy user for ${email}: ${privyUser.id}`);
    console.log('DEBUG: Privy user response:', JSON.stringify(privyUser, null, 2));

    // Find the Solana embedded wallet in linked accounts
    const solanaWallet = privyUser.linked_accounts?.find(
      account => account.type === 'solana_embedded_wallet'
    );

    if (!solanaWallet) {
      // Wallet might be in a separate field or need to be fetched
      console.warn('⚠️  Wallet not in linked_accounts, fetching user again...');
      const refreshedUser = await client.users().get(privyUser.id);
      const refreshedWallet = refreshedUser.linked_accounts?.find(
        account => account.type === 'solana_embedded_wallet'
      );
      
      if (refreshedWallet) {
        console.log(`✅ Found Solana wallet after refresh: ${refreshedWallet.address}`);
        return {
          walletAddress: refreshedWallet.address,
          privyUserId: privyUser.id,
          walletId: refreshedWallet.wallet_id
        };
      }
      
      throw new Error('No Solana wallet created for user');
    }

    console.log(`✅ Created Solana wallet for ${email}: ${solanaWallet.address}`);

    return {
      walletAddress: solanaWallet.address,
      privyUserId: privyUser.id,
      walletId: solanaWallet.wallet_id
    };
  } catch (error) {
    console.error('❌ Error creating Privy custodial wallet:', error);
    throw new Error(`Privy wallet creation failed: ${error.message}`);
  }
}

/**
 * Get a user's wallet from Privy
 * @param {string} privyUserId - Privy user ID
 * @returns {Promise<{address: string, walletId: string}>} Wallet info
 */
async function getPrivyWallet(privyUserId) {
  const client = await getPrivyClient();

  try {
    const privyUser = await client.users().get(privyUserId);
    
    // Find Solana embedded wallet in linked accounts
    const wallet = privyUser.linked_accounts?.find(
      account => account.type === 'solana_embedded_wallet'
    );

    if (!wallet) {
      throw new Error('No Solana wallet found for Privy user');
    }

    return {
      address: wallet.address,
      walletId: wallet.wallet_id
    };
  } catch (error) {
    console.error('❌ Error getting Privy wallet:', error);
    throw new Error(`Failed to get Privy wallet: ${error.message}`);
  }
}

/**
 * Verify Privy access token (for authenticated requests)
 * @param {string} accessToken - Privy access token from client
 * @returns {Promise<Object>} Verified user claims
 */
async function verifyPrivyToken(accessToken) {
  const client = await getPrivyClient();

  try {
    const claims = await client.auth().verifyAccessToken(accessToken);
    return claims;
  } catch (error) {
    console.error('❌ Error verifying Privy token:', error);
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

/**
 * Get user by email address
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} Privy user object or null
 */
async function getUserByEmail(email) {
  const client = await getPrivyClient();

  try {
    const user = await client.users().getByEmail(email);
    return user;
  } catch (error) {
    if (error.status === 404) {
      return null; // User not found
    }
    console.error('❌ Error getting user by email:', error);
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

module.exports = {
  getPrivyClient,
  createCustodialWallet,
  getPrivyWallet,
  verifyPrivyToken,
  getUserByEmail
};
