const { PrivyClient } = require('@privy-io/server-auth');
const { Keypair, PublicKey } = require('@solana/web3.js');
require('dotenv').config();

// Initialize Privy client
const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/**
 * Create a custodial wallet for a user using Privy
 * @param {string} userId - User ID from database
 * @param {string} email - User's email
 * @returns {Promise<{walletAddress: string, privyUserId: string}>}
 */
async function createCustodialWallet(userId, email) {
  try {
    // Create a Privy user with embedded wallet
    const privyUser = await privyClient.createUser({
      createEmbeddedWallet: true,
      linkedAccounts: [
        {
          type: 'email',
          address: email
        }
      ]
    });

    // Get the wallet from the Privy user
    const wallet = privyUser.linkedAccounts.find(
      account => account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!wallet) {
      throw new Error('No Solana wallet found in Privy user');
    }

    console.log(`✅ Created Privy custodial wallet for user ${userId}:`, wallet.address);

    return {
      walletAddress: wallet.address,
      privyUserId: privyUser.id
    };
  } catch (error) {
    console.error('Error creating Privy custodial wallet:', error);
    throw error;
  }
}

/**
 * Get a user's wallet from Privy
 * @param {string} privyUserId - Privy user ID
 * @returns {Promise<string>} Wallet address
 */
async function getPrivyWallet(privyUserId) {
  try {
    const privyUser = await privyClient.getUser(privyUserId);
    
    const wallet = privyUser.linkedAccounts.find(
      account => account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!wallet) {
      throw new Error('No Solana wallet found for Privy user');
    }

    return wallet.address;
  } catch (error) {
    console.error('Error getting Privy wallet:', error);
    throw error;
  }
}

/**
 * Sign a transaction using Privy's custodial wallet
 * @param {string} privyUserId - Privy user ID
 * @param {Transaction} transaction - Solana transaction to sign
 * @returns {Promise<Transaction>} Signed transaction
 */
async function signTransaction(privyUserId, transaction) {
  try {
    // Privy will sign the transaction using the custodial wallet
    const signedTx = await privyClient.solana.signTransaction(
      privyUserId,
      transaction
    );

    return signedTx;
  } catch (error) {
    console.error('Error signing transaction with Privy:', error);
    throw error;
  }
}

module.exports = {
  privyClient,
  createCustodialWallet,
  getPrivyWallet,
  signTransaction
};
