const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
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

// Program ID from deployed contract
const PROGRAM_ID = process.env.SOLANA_PROGRAM_ID 
  ? new PublicKey(process.env.SOLANA_PROGRAM_ID) 
  : null;

// Load IDL for the program
let IDL = null;
try {
  const idlPath = path.join(__dirname, '../../solana-contract/target/idl/civicchain.json');
  if (fs.existsSync(idlPath)) {
    IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    console.log('✅ Solana IDL loaded successfully from:', idlPath);
    console.log('✅ Program ID from IDL:', IDL.address);
  } else {
    console.warn('⚠️  IDL file not found at:', idlPath);
  }
} catch (error) {
  console.warn('⚠️  Solana IDL not found. Blockchain features will be limited.');
  console.warn('   Build the contract with: cd solana-contract && anchor build');
  console.warn('   Error:', error.message);
}

// PDA helper functions are now inline in each function to use the correct program ID

/**
 * Create an Anchor program instance
 * @param {Keypair} wallet - Wallet to use as provider
 * @returns {Program} Anchor program instance
 */
function getProgram(wallet) {
  if (!IDL || !PROGRAM_ID) {
    throw new Error('Solana program not configured. IDL or Program ID missing.');
  }
  
  // Use IDL's program ID if available and matches
  const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;
  
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: 'confirmed' }
  );
  
  return new Program(IDL, programId, provider);
}

/**
 * Create a new user account on-chain
 * @param {string} walletAddress - User's wallet address
 * @param {number} initialRep - Initial reputation (default 100)
 * @param {string} role - User role (citizen/government)
 * @returns {Promise<string>} Transaction signature
 */
async function createUserOnChain(walletAddress, initialRep = 100, role = 'citizen') {
  try {
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain user creation');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const userPubkey = new PublicKey(walletAddress);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;
    const [userPDA, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), userPubkey.toBuffer()],
      programId
    );

    // Check if user account already exists
    try {
      const accountInfo = await connection.getAccountInfo(userPDA);
      if (accountInfo) {
        console.log(`ℹ️  User account already exists for ${walletAddress}`);
        return null; // User already initialized
      }
    } catch (error) {
      // Account doesn't exist, proceed with creation
    }

    const program = getProgram(masterKeypair);

    // Convert role to enum - IDL uses PascalCase: { Citizen: {} } or { Government: {} }
    const roleEnum = role === 'government' ? { Government: {} } : { Citizen: {} };

    // Call initialize_user instruction
    const tx = await program.methods
      .initializeUser(initialRep, roleEnum)
      .accounts({
        userAccount: userPDA,
        authority: userPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([masterKeypair]) // Master keypair pays for account creation
      .rpc();

    console.log(`⛓️  Created user on-chain: ${tx}`);
    return tx;

  } catch (error) {
    console.error('Error creating user on-chain:', error);
    console.error('Stack trace:', error.stack);
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
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain issue creation');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const reporterPubkey = new PublicKey(issueData.wallet_address);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;
    
    // Create issue hash from issue_id
    const issueHash = createHash('sha256')
      .update(issueData.issue_id)
      .digest();

    const [issuePDA, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      programId
    );
    const [userPDA, userBump] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      programId
    );

    const program = getProgram(masterKeypair);

    // Map category to enum - IDL uses PascalCase: { Pothole: {} }, { Garbage: {} }, etc.
    const categoryMap = {
      'pothole': { Pothole: {} },
      'garbage': { Garbage: {} },
      'streetlight': { Streetlight: {} },
      'water': { Water: {} },
      'other': { Other: {} }
    };
    const categoryEnum = categoryMap[issueData.category.toLowerCase()] || { Other: {} };

    // Calculate priority (0-100 range to 0-255)
    const priority = Math.min(255, Math.floor((issueData.priority_score || 0) * 2.55));

    // Call create_issue instruction
    const tx = await program.methods
      .createIssue(Array.from(issueHash), categoryEnum, priority)
      .accounts({
        issueAccount: issuePDA,
        userAccount: userPDA,
        authority: reporterPubkey,
        systemProgram: SystemProgram.programId,
      })
      .signers([masterKeypair]) // Master keypair pays for account creation
      .rpc();

    console.log(`⛓️  Created issue on-chain: ${tx}`);
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
 * @param {string} voterId - Voter's wallet address
 * @param {string} reporterAddress - Reporter's wallet address
 * @param {string} voteType - 'upvote' or 'downvote'
 * @returns {Promise<string>} Transaction signature
 */
async function recordVoteOnChain(issueId, voterId, reporterAddress, voteType) {
  try {
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain vote recording');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const voterPubkey = new PublicKey(voterId);
    const reporterPubkey = new PublicKey(reporterAddress);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;

    // Create issue hash from issue_id
    const issueHash = createHash('sha256')
      .update(issueId)
      .digest();

    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      programId
    );
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      programId
    );
    const [voterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), voterPubkey.toBuffer()],
      programId
    );

    const program = getProgram(masterKeypair);

    // Map vote type to enum - IDL uses PascalCase: { Upvote: {} } or { Downvote: {} }
    const voteTypeEnum = voteType.toLowerCase() === 'upvote' ? { Upvote: {} } : { Downvote: {} };

    // Call record_vote instruction
    const tx = await program.methods
      .recordVote(voteTypeEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: voterPubkey,
      })
      .signers([masterKeypair]) // Master keypair signs
      .rpc();

    console.log(`⛓️  Recorded ${voteType} on-chain: ${tx}`);
    return tx;

  } catch (error) {
    console.error('Error recording vote on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

/**
 * Record verification on-chain
 * @param {string} issueId - Issue ID
 * @param {string} verifierId - Verifier's wallet address
 * @param {string} reporterAddress - Reporter's wallet address
 * @returns {Promise<string>} Transaction signature
 */
async function recordVerificationOnChain(issueId, verifierId, reporterAddress) {
  try {
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain verification');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const verifierPubkey = new PublicKey(verifierId);
    const reporterPubkey = new PublicKey(reporterAddress);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;

    // Create issue hash from issue_id
    const issueHash = createHash('sha256')
      .update(issueId)
      .digest();

    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      programId
    );
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      programId
    );
    const [verifierPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), verifierPubkey.toBuffer()],
      programId
    );

    const program = getProgram(masterKeypair);

    // Call record_verification instruction
    const tx = await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        verifierAccount: verifierPDA,
        verifier: verifierPubkey,
      })
      .signers([masterKeypair]) // Master keypair signs
      .rpc();

    console.log(`⛓️  Recorded verification on-chain: ${tx}`);
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
 * @param {string} newStatus - New status
 * @param {string} governmentWallet - Government user's wallet
 * @param {string} reporterAddress - Reporter's wallet address
 * @returns {Promise<string>} Transaction signature
 */
async function updateIssueStatusOnChain(issueId, newStatus, governmentWallet, reporterAddress) {
  try {
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain status update');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const governmentPubkey = new PublicKey(governmentWallet);
    const reporterPubkey = new PublicKey(reporterAddress);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;

    // Create issue hash from issue_id
    const issueHash = createHash('sha256')
      .update(issueId)
      .digest();

    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      programId
    );
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), reporterPubkey.toBuffer()],
      programId
    );
    const [governmentPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), governmentPubkey.toBuffer()],
      programId
    );

    const program = getProgram(masterKeypair);

    // Map status to enum - IDL uses PascalCase: { Open: {} }, { InProgress: {} }, { Resolved: {} }, { Closed: {} }
    const statusMap = {
      'open': { Open: {} },
      'in_progress': { InProgress: {} },
      'resolved': { Resolved: {} },
      'closed': { Closed: {} }
    };
    const statusEnum = statusMap[newStatus.toLowerCase()] || { Open: {} };

    // Call update_issue_status instruction
    const tx = await program.methods
      .updateIssueStatus(statusEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        governmentAccount: governmentPDA,
        government: governmentPubkey,
      })
      .signers([masterKeypair]) // Master keypair signs
      .rpc();

    console.log(`⛓️  Updated issue status on-chain: ${tx}`);
    return tx;

  } catch (error) {
    console.error('Error updating issue status on-chain:', error);
    console.error('Stack trace:', error.stack);
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
    if (!IDL || !PROGRAM_ID) {
      console.warn('⚠️  Solana program not configured, skipping on-chain reputation update');
      return null;
    }

    if (!masterKeypair) {
      throw new Error('Master wallet not configured');
    }

    const userPubkey = new PublicKey(walletAddress);
    const programId = IDL.address ? new PublicKey(IDL.address) : PROGRAM_ID;
    const [userPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), userPubkey.toBuffer()],
      programId
    );

    const program = getProgram(masterKeypair);

    // Call update_reputation instruction
    const tx = await program.methods
      .updateReputation(newRep)
      .accounts({
        userAccount: userPDA,
        authority: masterKeypair.publicKey, // Admin authority
      })
      .signers([masterKeypair])
      .rpc();

    console.log(`⛓️  Updated reputation on-chain: ${tx}`);
    return tx;

  } catch (error) {
    console.error('Error updating reputation on-chain:', error);
    console.error('Stack trace:', error.stack);
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
  PROGRAM_ID,
  IDL,
  getProgram,
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
