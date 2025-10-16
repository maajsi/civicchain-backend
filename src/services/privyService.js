const { PrivyClient } = require('@privy-io/server-auth');
require('dotenv').config();

// Initialize Privy client with proper error handling
let privyClient = null;
if (process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
  try {
    privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET
    );
    console.log('✅ Privy client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Privy client:', error.message);
  }
} else {
  console.warn('⚠️  Privy credentials not configured. Custodial wallet features disabled.');
}

/**
 * Create a custodial wallet for a user using Privy
 * @param {string} userId - User ID from database
 * @param {string} email - User's email
 * @returns {Promise<{walletAddress: string, privyUserId: string}>}
 */
async function createCustodialWallet(userId, email) {
  if (!privyClient) {
    throw new Error('Privy client not initialized. Check PRIVY_APP_ID and PRIVY_APP_SECRET.');
  }

  try {
    // Import user or create if doesn't exist
    // Privy will automatically create an embedded wallet
    const privyUser = await privyClient.importUser({
      linkedAccounts: [
        {
          type: 'email',
          address: email
        }
      ],
      createEthereumWallet: false, 
      createSolanaWallet: true 
    });

    // Get the Solana wallet from linked accounts
    const wallet = privyUser.linkedAccounts?.find(
      account => account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!wallet) {
      throw new Error('No Solana wallet created by Privy');
    }

    console.log(`✅ Created Privy custodial wallet for ${email}:`, wallet.address);

    return {
      walletAddress: wallet.address,
      privyUserId: privyUser.id
    };
  } catch (error) {
    console.error('❌ Error creating Privy custodial wallet:', error);
    throw new Error(`Privy wallet creation failed: ${error.message}`);
  }
}

/**
 * Get a user's wallet from Privy
 * @param {string} privyUserId - Privy user ID
 * @returns {Promise<string>} Wallet address
 */
async function getPrivyWallet(privyUserId) {
  if (!privyClient) {
    throw new Error('Privy client not initialized');
  }

  try {
    const privyUser = await privyClient.getUser(privyUserId);
    
    const wallet = privyUser.linkedAccounts?.find(
      account => account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!wallet) {
      throw new Error('No Solana wallet found for Privy user');
    }

    return wallet.address;
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
  if (!privyClient) {
    throw new Error('Privy client not initialized');
  }

  try {
    const claims = await privyClient.verifyAuthToken(accessToken);
    return claims;
  } catch (error) {
    console.error('❌ Error verifying Privy token:', error);
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

module.exports = {
  privyClient,
  createCustodialWallet,
  getPrivyWallet,
  verifyPrivyToken
};
