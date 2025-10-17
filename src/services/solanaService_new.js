/**
 * CivicChain Solana Service
 * 
 * SERVER-SIDE BLOCKCHAIN APPROACH
 * --------------------------------
 * This service uses a server-side approach where:
 * 1. User keypairs are generated server-side and stored encrypted in the database
 * 2. Master wallet pays for account creation
 * 3. User keypairs sign their own transactions
 * 
 * Benefits:
 * - No gas fees for account creation (platform pays)
 * - Users directly sign their transactions
 * - Full on-chain user identity
 * 
 * Trade-offs:
 * - Platform stores user private keys (encrypted)
 * - Platform pays for account creation
 */
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MASTER_WALLET_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
if (!MASTER_WALLET_PRIVATE_KEY) throw new Error('MASTER_WALLET_PRIVATE_KEY missing from .env');

const masterKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(MASTER_WALLET_PRIVATE_KEY)));
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);

const idlPath = path.join(__dirname, '../../solana-contract/target/idl/idl.json');
if (!fs.existsSync(idlPath)) throw new Error('IDL file not found at: ' + idlPath);
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

console.log('✅ Solana service initialized');
console.log('✅ Program ID:', PROGRAM_ID.toString());
console.log('✅ Master wallet:', masterKeypair.publicKey.toString());

function getProgram(wallet) {
  if (!wallet || !wallet.publicKey) throw new Error('getProgram: wallet is not a Keypair');
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  return new Program(IDL, PROGRAM_ID, provider);
}

// =====================================================
//  UTILITY FUNCTIONS
// =====================================================

/**
 * Generate a new Solana keypair for a user
 * @returns {Object} - { keypair, publicKey, privateKey }
 */
function generateKeypair() {
  const keypair = Keypair.generate();
  return {
    keypair,
    publicKey: keypair.publicKey.toString(),
    privateKey: JSON.stringify(Array.from(keypair.secretKey)), // Store as JSON array
  };
}

/**
 * Restore a keypair from private key
 * @param {string} privateKeyStr - JSON string of secret key array
 * @returns {Keypair}
 */
function keypairFromPrivateKey(privateKeyStr) {
  const secretKey = Uint8Array.from(JSON.parse(privateKeyStr));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Fund a wallet with SOL from master wallet
 * @param {string} walletAddress - Recipient wallet address
 * @param {number} amountSOL - Amount of SOL to send
 * @returns {Promise<string>} - Transaction signature
 */
async function fundWallet(walletAddress, amountSOL = 0.05) {
  try {
    const recipientPubkey = new PublicKey(walletAddress);
    const lamports = amountSOL * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    const signature = await connection.sendTransaction(transaction, [masterKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`💰 Funded wallet ${walletAddress} with ${amountSOL} SOL. Tx: ${signature}`);
    return signature;
  } catch (error) {
    console.error('Error funding wallet:', error);
    throw error;
  }
}

// =====================================================
//  BLOCKCHAIN FUNCTIONS
// =====================================================

/**
 * Create a user account on-chain
 * @param {string} userPrivateKey - User's private key (JSON string)
 * @param {number} initialRep - Initial reputation (default 100)
 * @param {string} role - User role: 'citizen' or 'government'
 * @returns {Promise<string>} - Transaction signature
 */
async function createUserOnChain(userPrivateKey, initialRep = 100, role = 'citizen') {
  try {
    const userKeypair = keypairFromPrivateKey(userPrivateKey);
    const userPubkey = userKeypair.publicKey;
    
    console.log(`⛓️  Creating user account on-chain for: ${userPubkey.toString()}`);
    
    // Derive user PDA
    const [userPDA, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    console.log(`✅ User PDA: ${userPDA.toString()}`);
    
    // Check if account already exists
    const accountInfo = await connection.getAccountInfo(userPDA);
    if (accountInfo) {
      console.log('⚠️  User account already exists on-chain');
      return null;
    }
    
    // Map role to enum
    const roleEnum = role === 'government' ? { government: {} } : { citizen: {} };
    
    // Get program with master wallet as payer
    const program = getProgram(masterKeypair);
    
    // Call initialize_user instruction
    const tx = await program.methods
      .initializeUser(
        userPubkey,    // user_pubkey parameter
        initialRep,    // initial_rep
        roleEnum       // role enum
      )
      .accounts({
        userAccount: userPDA,
        payer: masterKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ User account created on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error creating user on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Create an issue on-chain
 * @param {string} issueId - Issue ID from database
 * @param {string} reporterPrivateKey - Reporter's private key
 * @param {string} category - Issue category
 * @param {number} priority - Priority score (0-100)
 * @returns {Promise<string>} - Transaction signature
 */
async function createIssueOnChain(issueId, reporterPrivateKey, category, priority) {
  try {
    const reporterKeypair = keypairFromPrivateKey(reporterPrivateKey);
    const reporterPubkey = reporterKeypair.publicKey;
    
    console.log(`⛓️  Creating issue on-chain: ${issueId}`);
    
    // Generate issue hash
    const issueHash = createHash('sha256').update(issueId.toString()).digest();
    
    // Derive PDAs
    const [issuePDA, issueBump] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      PROGRAM_ID
    );
    
    const [userPDA, userBump] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    console.log(`✅ Issue PDA: ${issuePDA.toString()}`);
    console.log(`✅ User PDA: ${userPDA.toString()}`);
    
    // Map category to enum
    const categoryMap = {
      pothole: { pothole: {} },
      garbage: { garbage: {} },
      streetlight: { streetlight: {} },
      water: { water: {} },
      other: { other: {} },
    };
    const categoryEnum = categoryMap[category.toLowerCase()] || { other: {} };
    
    // Get program with reporter as signer
    const program = getProgram(reporterKeypair);
    
    // Call create_issue instruction
    const tx = await program.methods
      .createIssue(
        Array.from(issueHash), // issue_hash as byte array
        categoryEnum,          // category enum
        priority               // priority u8
      )
      .accounts({
        issueAccount: issuePDA,
        userAccount: userPDA,
        authority: reporterPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([reporterKeypair])
      .rpc();
    
    console.log(`✅ Issue created on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error creating issue on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Record a vote on-chain
 * @param {string} issueId - Issue ID
 * @param {string} voterPrivateKey - Voter's private key
 * @param {string} reporterWalletAddress - Reporter's wallet address
 * @param {string} voteType - 'upvote' or 'downvote'
 * @returns {Promise<string>} - Transaction signature
 */
async function recordVoteOnChain(issueId, voterPrivateKey, reporterWalletAddress, voteType) {
  try {
    const voterKeypair = keypairFromPrivateKey(voterPrivateKey);
    const voterPubkey = voterKeypair.publicKey;
    const reporterPubkey = new PublicKey(reporterWalletAddress);
    
    console.log(`⛓️  Recording ${voteType} on-chain for issue: ${issueId}`);
    
    // Generate issue hash
    const issueHash = createHash('sha256').update(issueId.toString()).digest();
    
    // Derive PDAs
    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      PROGRAM_ID
    );
    
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    const [voterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), voterPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    // Map vote type to enum
    const voteTypeEnum = voteType === 'downvote' ? { downvote: {} } : { upvote: {} };
    
    // Get program with voter as signer
    const program = getProgram(voterKeypair);
    
    // Call record_vote instruction
    const tx = await program.methods
      .recordVote(voteTypeEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: voterPubkey,
      })
      .signers([voterKeypair])
      .rpc();
    
    console.log(`✅ Vote recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error recording vote on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Record a verification on-chain
 * @param {string} issueId - Issue ID
 * @param {string} verifierPrivateKey - Verifier's private key
 * @param {string} reporterWalletAddress - Reporter's wallet address
 * @returns {Promise<string>} - Transaction signature
 */
async function recordVerificationOnChain(issueId, verifierPrivateKey, reporterWalletAddress) {
  try {
    const verifierKeypair = keypairFromPrivateKey(verifierPrivateKey);
    const verifierPubkey = verifierKeypair.publicKey;
    const reporterPubkey = new PublicKey(reporterWalletAddress);
    
    console.log(`⛓️  Recording verification on-chain for issue: ${issueId}`);
    
    // Generate issue hash
    const issueHash = createHash('sha256').update(issueId.toString()).digest();
    
    // Derive PDAs
    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      PROGRAM_ID
    );
    
    const [verifierPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), verifierPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    // Note: recordVerification in IDL doesn't require reporterAccount
    // Get program with verifier as signer
    const program = getProgram(verifierKeypair);
    
    // Call record_verification instruction
    const tx = await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        verifierAccount: verifierPDA,
        verifier: verifierPubkey,
      })
      .signers([verifierKeypair])
      .rpc();
    
    console.log(`✅ Verification recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error recording verification on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Update issue status on-chain (government only)
 * @param {string} issueId - Issue ID
 * @param {string} governmentPrivateKey - Government user's private key
 * @param {string} reporterWalletAddress - Reporter's wallet address
 * @param {string} newStatus - New status: 'open', 'in_progress', 'resolved', 'closed'
 * @returns {Promise<string>} - Transaction signature
 */
async function updateIssueStatusOnChain(issueId, governmentPrivateKey, reporterWalletAddress, newStatus) {
  try {
    const governmentKeypair = keypairFromPrivateKey(governmentPrivateKey);
    const governmentPubkey = governmentKeypair.publicKey;
    const reporterPubkey = new PublicKey(reporterWalletAddress);
    
    console.log(`⛓️  Updating issue status on-chain: ${issueId} -> ${newStatus}`);
    
    // Generate issue hash
    const issueHash = createHash('sha256').update(issueId.toString()).digest();
    
    // Derive PDAs
    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      PROGRAM_ID
    );
    
    const [governmentPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), governmentPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    // Map status to enum
    const statusMap = {
      open: { open: {} },
      in_progress: { inProgress: {} },
      resolved: { resolved: {} },
      closed: { closed: {} },
    };
    const statusEnum = statusMap[newStatus.toLowerCase()] || { open: {} };
    
    // Get program with government user as signer
    const program = getProgram(governmentKeypair);
    
    // Call update_issue_status instruction
    const tx = await program.methods
      .updateIssueStatus(statusEnum)
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: governmentPDA,
        government: governmentPubkey,
      })
      .signers([governmentKeypair])
      .rpc();
    
    console.log(`✅ Issue status updated on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error updating issue status on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Update user reputation on-chain
 * @param {string} userWalletAddress - User's wallet address
 * @param {number} newRep - New reputation value
 * @returns {Promise<string>} - Transaction signature
 */
async function updateReputationOnChain(userWalletAddress, newRep) {
  try {
    const userPubkey = new PublicKey(userWalletAddress);
    
    console.log(`⛓️  Updating reputation on-chain: ${userWalletAddress} -> ${newRep}`);
    
    // Derive user PDA
    const [userPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
    
    // Get program with master wallet as authority
    const program = getProgram(masterKeypair);
    
    // Call update_reputation instruction
    const tx = await program.methods
      .updateReputation(newRep)
      .accounts({
        userAccount: userPDA,
        authority: masterKeypair.publicKey,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ Reputation updated on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('Error updating reputation on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = {
  connection,
  masterKeypair,
  generateKeypair,
  keypairFromPrivateKey,
  fundWallet,
  createUserOnChain,
  createIssueOnChain,
  recordVoteOnChain,
  recordVerificationOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain,
};
