const { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const config = require('../config');

let connection;
let masterKeypair;

function initializeSolana() {
  try {
    connection = new Connection(config.solana.rpcUrl, 'confirmed');
    
    if (config.solana.masterWalletPrivateKey) {
      const privateKeyArray = JSON.parse(config.solana.masterWalletPrivateKey);
      masterKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
      console.log('Solana initialized with master wallet:', masterKeypair.publicKey.toString());
    } else {
      console.warn('WARNING: Master wallet private key not configured. Wallet funding will not work.');
    }
  } catch (error) {
    console.error('Failed to initialize Solana:', error.message);
  }
}

async function fundWallet(recipientPublicKeyString, amountLamports = config.wallet.fundingAmount) {
  if (!masterKeypair) {
    throw new Error('Master wallet not initialized');
  }
  
  try {
    const recipientPublicKey = new PublicKey(recipientPublicKeyString);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterKeypair.publicKey,
        toPubkey: recipientPublicKey,
        lamports: amountLamports,
      })
    );
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [masterKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`Funded wallet ${recipientPublicKeyString} with ${amountLamports / LAMPORTS_PER_SOL} SOL. Tx: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Failed to fund wallet:', error.message);
    throw error;
  }
}

async function getWalletBalance(publicKeyString) {
  try {
    const publicKey = new PublicKey(publicKeyString);
    const balance = await connection.getBalance(publicKey);
    return balance;
  } catch (error) {
    console.error('Failed to get wallet balance:', error.message);
    return 0;
  }
}

async function checkAndRefillWallet(publicKeyString) {
  try {
    const balance = await getWalletBalance(publicKeyString);
    
    if (balance < config.wallet.refillThreshold) {
      console.log(`Wallet ${publicKeyString} balance low (${balance / LAMPORTS_PER_SOL} SOL), refilling...`);
      const signature = await fundWallet(publicKeyString, config.wallet.refillAmount);
      return { refilled: true, signature, newBalance: balance + config.wallet.refillAmount };
    }
    
    return { refilled: false, balance };
  } catch (error) {
    console.error('Failed to check/refill wallet:', error.message);
    return { refilled: false, error: error.message };
  }
}

// Mock smart contract functions - these would interact with actual deployed Solana program
async function createIssueOnChain(walletAddress, issueHash, timestamp) {
  try {
    // In production, this would call the actual Solana program
    // For now, we just create a mock transaction
    console.log(`[Mock] Creating issue on-chain: ${issueHash} for wallet ${walletAddress}`);
    
    // Simulate transaction hash
    const mockTxHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return mockTxHash;
  } catch (error) {
    console.error('Failed to create issue on-chain:', error.message);
    throw error;
  }
}

async function updateReputationOnChain(walletAddress, newRep) {
  try {
    console.log(`[Mock] Updating reputation on-chain for ${walletAddress}: ${newRep}`);
    const mockTxHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return mockTxHash;
  } catch (error) {
    console.error('Failed to update reputation on-chain:', error.message);
    throw error;
  }
}

async function updateIssueStatusOnChain(issueHash, status) {
  try {
    console.log(`[Mock] Updating issue status on-chain: ${issueHash} -> ${status}`);
    const mockTxHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return mockTxHash;
  } catch (error) {
    console.error('Failed to update issue status on-chain:', error.message);
    throw error;
  }
}

async function initializeUserOnChain(walletAddress, initialRep = 100) {
  try {
    console.log(`[Mock] Initializing user on-chain: ${walletAddress} with rep ${initialRep}`);
    const mockTxHash = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return mockTxHash;
  } catch (error) {
    console.error('Failed to initialize user on-chain:', error.message);
    throw error;
  }
}

module.exports = {
  initializeSolana,
  fundWallet,
  getWalletBalance,
  checkAndRefillWallet,
  createIssueOnChain,
  updateReputationOnChain,
  updateIssueStatusOnChain,
  initializeUserOnChain
};
