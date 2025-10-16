const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { Program, AnchorProvider, web3, BN } = require('@coral-xyz/anchor');
require('dotenv').config();

// Load master wallet
let masterKeypair = null;
if (process.env.MASTER_WALLET_PRIVATE_KEY) {
  try {
    const privateKeyArray = JSON.parse(process.env.MASTER_WALLET_PRIVATE_KEY);
    masterKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    console.log('✅ Master wallet loaded:', masterKeypair.publicKey.toString());
  } catch (error) {
    console.warn('⚠️  Master wallet not configured properly:', error.message);
  }
}

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Program ID will be set after deployment
const PROGRAM_ID = process.env.SOLANA_PROGRAM_ID 
  ? new PublicKey(process.env.SOLANA_PROGRAM_ID) 
  : null;

/**
 * Create a new user account on-chain
 * @param {string} walletAddress - User's wallet address
 * @param {number} initialRep - Initial reputation (default 100)
 * @param {string} role - User role (citizen/government)
 * @returns {Promise<string>} Transaction signature
 */
async function createUserOnChain(walletAddress, initialRep = 100, role = 'citizen') {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain user creation');
      return `mock_user_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    // This will be replaced with actual Anchor program call after contract deployment
    const mockTxHash = `user_${walletAddress.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Created user on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error creating user on-chain:', error);
    throw error;
  }
}

/**
 * Create an issue on-chain
 * @param {Object} issueData - Issue data
 * @returns {Promise<string>} Transaction signature
 */
async function createIssueOnChain(issueData) {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain issue creation');
      return `mock_issue_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    // This will be replaced with actual Anchor program call
    const mockTxHash = `issue_${issueData.issue_id.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Created issue on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error creating issue on-chain:', error);
    throw error;
  }
}

/**
 * Record a vote on-chain
 * @param {string} issueId - Issue ID
 * @param {string} voterId - Voter's user ID
 * @param {string} voteType - 'upvote' or 'downvote'
 * @returns {Promise<string>} Transaction signature
 */
async function recordVoteOnChain(issueId, voterId, voteType) {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain vote recording');
      return `mock_vote_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    const mockTxHash = `vote_${voteType}_${issueId.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Recorded ${voteType} on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error recording vote on-chain:', error);
    throw error;
  }
}

/**
 * Record verification on-chain
 * @param {string} issueId - Issue ID
 * @param {string} verifierId - Verifier's user ID
 * @returns {Promise<string>} Transaction signature
 */
async function recordVerificationOnChain(issueId, verifierId) {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain verification');
      return `mock_verify_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    const mockTxHash = `verify_${issueId.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Recorded verification on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error recording verification on-chain:', error);
    throw error;
  }
}

/**
 * Update issue status on-chain (government only)
 * @param {string} issueId - Issue ID
 * @param {string} newStatus - New status
 * @param {string} governmentWallet - Government user's wallet
 * @returns {Promise<string>} Transaction signature
 */
async function updateIssueStatusOnChain(issueId, newStatus, governmentWallet) {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain status update');
      return `mock_status_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    const mockTxHash = `status_${newStatus}_${issueId.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Updated issue status on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error updating issue status on-chain:', error);
    throw error;
  }
}

/**
 * Update user reputation on-chain
 * @param {string} walletAddress - User's wallet address
 * @param {number} newRep - New reputation value
 * @returns {Promise<string>} Transaction signature
 */
async function updateReputationOnChain(walletAddress, newRep) {
  try {
    if (!PROGRAM_ID) {
      console.warn('⚠️  Solana program not deployed, skipping on-chain reputation update');
      return `mock_rep_tx_${Date.now()}`;
    }

    // For now, return mock transaction
    const mockTxHash = `rep_${walletAddress.substring(0, 8)}_${Date.now()}`;
    console.log(`📝 Updated reputation on-chain: ${mockTxHash}`);
    return mockTxHash;

  } catch (error) {
    console.error('Error updating reputation on-chain:', error);
    throw error;
  }
}

/**
 * Fund a wallet with devnet SOL
 * @param {string} recipientPublicKeyString - The recipient's public key as string
 * @param {number} amount - Amount in SOL (default 0.05)
 * @returns {Promise<string>} Transaction signature
 */
async function fundWallet(recipientPublicKeyString, amount = 0.05) {
  if (!masterKeypair) {
    throw new Error('Master wallet not configured');
  }

  const recipientPublicKey = new PublicKey(recipientPublicKeyString);
  const lamports = amount * LAMPORTS_PER_SOL;

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: masterKeypair.publicKey,
      toPubkey: recipientPublicKey,
      lamports: Math.floor(lamports),
    })
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [masterKeypair],
    { commitment: 'confirmed' }
  );

  return signature;
}

/**
 * Get wallet balance
 * @param {string} publicKeyString - The wallet's public key as string
 * @returns {Promise<number>} Balance in SOL
 */
async function getBalance(publicKeyString) {
  const publicKey = new PublicKey(publicKeyString);
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Check if wallet needs refill and refill if necessary
 * @param {string} publicKeyString - The wallet's public key as string
 * @param {number} threshold - Minimum balance threshold (default 0.01 SOL)
 * @returns {Promise<string|null>} Transaction signature if refilled, null otherwise
 */
async function checkAndRefillWallet(publicKeyString, threshold = 0.01) {
  const balance = await getBalance(publicKeyString);
  
  if (balance < threshold) {
    console.log(`💰 Refilling wallet ${publicKeyString} (balance: ${balance} SOL)`);
    return await fundWallet(publicKeyString, 0.05);
  }
  
  return null;
}

module.exports = {
  connection,
  masterKeypair,
  createUserOnChain,
  createIssueOnChain,
  recordVoteOnChain,
  recordVerificationOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain,
  fundWallet,
  getBalance,
  checkAndRefillWallet
};
