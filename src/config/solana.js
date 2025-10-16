const { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
require('dotenv').config();

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);

// Load master wallet from environment
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
  fundWallet,
  getBalance,
  checkAndRefillWallet,
  masterKeypair
};
