/**
 * CivicChain Solana Service
 * 
 * SERVER-SIDE CUSTODIAL WALLET APPROACH
 * --------------------------------------
 * This service uses a server-side custodial wallet approach:
 * 1. Backend generates and stores user keypairs securely in database
 * 2. Master wallet funds new user wallets with initial SOL
 * 3. User keypairs sign their own transactions (true ownership)
 * 4. Platform can assist with transaction signing when needed
 * 
 * Benefits:
 * - True wallet ownership (users have their own keypairs)
 * - On-chain transactions signed by actual user wallets
 * - No third-party dependencies (no Privy)
 * - Flexible: can add client-side signing later
 * 
 * Security:
 * - Private keys encrypted in database
 * - Access controlled by authentication
 * - Can add HSM/KMS integration for production
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
const bs58 = require('bs58');

// Configuration
const MASTER_WALLET_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
if (!MASTER_WALLET_PRIVATE_KEY) throw new Error('MASTER_WALLET_PRIVATE_KEY missing from .env');

const masterKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(MASTER_WALLET_PRIVATE_KEY)));
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);

console.log('✅ Master wallet loaded:', masterKeypair.publicKey.toBase58());
console.log('✅ Program ID:', PROGRAM_ID.toBase58());

// Load IDL
const idlPath = path.join(__dirname, '../../solana-contract/target/idl/idl.json');
let IDL;
if (fs.existsSync(idlPath)) {
  IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  console.log('✅ Solana IDL loaded successfully');
} else {
  console.warn('⚠️  IDL file not found. Blockchain features disabled.');
}

function getProgram(wallet) {
  if (!IDL) throw new Error('IDL not loaded');
  if (!wallet || !wallet.publicKey) throw new Error('getProgram: wallet is not a Keypair');
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  return new Program(IDL, PROGRAM_ID, provider);
}

// ---- Generate New User Wallet ----
function generateUserWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
  };
}

// ---- Load User Keypair from Private Key ----
function loadUserKeypair(privateKeyBase58) {
  const secretKey = bs58.decode(privateKeyBase58);
  return Keypair.fromSecretKey(secretKey);
}

// ---- Fund User Wallet ----
async function fundWallet(toPublicKeyOrAddress, lamports = Math.floor(0.05 * LAMPORTS_PER_SOL)) {
  let toPubkey;
  if (toPublicKeyOrAddress instanceof PublicKey) {
    toPubkey = toPublicKeyOrAddress;
  } else if (typeof toPublicKeyOrAddress === 'string') {
    toPubkey = new PublicKey(toPublicKeyOrAddress);
  } else {
    throw new Error('fundWallet: invalid argument');
  }
  
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: masterKeypair.publicKey,
      toPubkey,
      lamports: Math.floor(lamports),
    })
  );
  
  const signature = await connection.sendTransaction(tx, [masterKeypair]);
  await connection.confirmTransaction(signature, "confirmed");
  console.log(`💰 Funded wallet ${toPubkey.toBase58()} with ${lamports / LAMPORTS_PER_SOL} SOL. Tx: ${signature}`);
  return signature;
}

// ---- Create User On-Chain ----
async function createUserOnChain(userPublicKey, userPrivateKeyBase58, initialRep = 100, role = 'citizen') {
  if (!IDL) {
    console.warn('⚠️  Blockchain not configured. Skipping on-chain user creation.');
    return null;
  }
  
  const userKeypair = loadUserKeypair(userPrivateKeyBase58);
  const program = getProgram(masterKeypair);
  
  // PDA derived from user's public key
  const [userPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), userKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  // Anchor enum format: camelCase
  const roleEnum = role === 'government' ? { government: {} } : { citizen: {} };
  
  try {
    console.log(`⛓️  Creating user account on-chain: ${userPublicKey}`);
    
    // Master wallet pays for account creation, passes user's pubkey as parameter
    const tx = await program.methods
      .initializeUser(userKeypair.publicKey, initialRep, roleEnum)
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
    console.error('❌ Error creating user on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw new Error(`Failed to create user on-chain: ${error.message}`);
  }
}

// ---- Create Issue On-Chain ----
async function createIssueOnChain(userPrivateKeyBase58, issueId, category = 'other', priority = 50) {
  if (!IDL) {
    console.warn('⚠️  Blockchain not configured. Skipping on-chain issue creation.');
    return null;
  }
  
  const userKeypair = loadUserKeypair(userPrivateKeyBase58);
  const program = getProgram(userKeypair); // User signs their own transaction
  
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), userKeypair.publicKey.toBuffer()], PROGRAM_ID);

  // Anchor enum format: camelCase
  const categoryMap = {
    pothole: { pothole: {} },
    garbage: { garbage: {} },
    streetlight: { streetlight: {} },
    water: { water: {} },
    other: { other: {} }
  };
  const categoryEnum = categoryMap[category.toLowerCase()] || { other: {} };
  
  try {
    console.log(`⛓️  Creating issue on-chain: ${issueId}`);
    
    // Convert Buffer to Uint8Array for Anchor (not Array.from which creates plain JS array)
    const tx = await program.methods
      .createIssue(new Uint8Array(issueHash), categoryEnum, priority)
      .accounts({
        issueAccount: issuePDA,
        userAccount: userPDA,
        authority: userKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair]) // User signs their own transaction
      .rpc();
    
    console.log(`✅ Issue created on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error creating issue on-chain:', error);
    console.error('Stack trace:', error.stack);
    throw new Error(`Failed to create issue on-chain: ${error.message}`);
  }
}

// ---- Record Vote On-Chain ----
async function recordVoteOnChain(voterPublicKey, voterPrivateKeyBase58, issueId, reporterPublicKey, voteType = 'upvote') {
  if (!IDL) {
    console.warn('⚠️  Blockchain not configured. Skipping on-chain vote recording.');
    return null;
  }
  
  const voterKeypair = loadUserKeypair(voterPrivateKeyBase58);
  const reporterPubkey = new PublicKey(reporterPublicKey);
  const program = getProgram(voterKeypair); // Voter signs their own transaction
  
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [reporterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), reporterPubkey.toBuffer()], PROGRAM_ID);
  const [voterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), voterKeypair.publicKey.toBuffer()], PROGRAM_ID);
  
  // Anchor enum format: camelCase
  const voteTypeEnum = voteType.toLowerCase() === 'upvote' ? { upvote: {} } : { downvote: {} };
  
  try {
    console.log(`⛓️  Recording ${voteType} on-chain for issue: ${issueId}`);
    
    const tx = await program.methods
      .recordVote(voteTypeEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: voterKeypair.publicKey,
      })
      .signers([voterKeypair]) // Voter signs their own transaction
      .rpc();
    
    console.log(`✅ Vote recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error recording vote on-chain:', error);
    throw new Error(`Failed to record vote on-chain: ${error.message}`);
  }
}

// ---- Record Verification On-Chain ----
async function recordVerificationOnChain(verifierPrivateKeyBase58, issueId) {
  if (!IDL) {
    console.warn('⚠️  Blockchain not configured. Skipping on-chain verification recording.');
    return null;
  }
  
  const verifierKeypair = loadUserKeypair(verifierPrivateKeyBase58);
  const program = getProgram(verifierKeypair); // Verifier signs their own transaction
  
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [verifierPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), verifierKeypair.publicKey.toBuffer()], PROGRAM_ID);
  
  try {
    console.log(`⛓️  Recording verification on-chain for issue: ${issueId}`);
    
    const tx = await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        verifierAccount: verifierPDA,
        verifier: verifierKeypair.publicKey,
      })
      .signers([verifierKeypair]) // Verifier signs their own transaction
      .rpc();
    
    console.log(`✅ Verification recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error recording verification on-chain:', error);
    throw new Error(`Failed to record verification on-chain: ${error.message}`);
  }
}

// ---- Update Issue Status On-Chain ----
async function updateIssueStatusOnChain(governmentPrivateKeyBase58, issueId, newStatus = 'resolved') {
  if (!IDL) {
    console.warn('⚠️  Blockchain not configured. Skipping on-chain status update.');
    return null;
  }
  
  const governmentKeypair = loadUserKeypair(governmentPrivateKeyBase58);
  const program = getProgram(governmentKeypair); // Government user signs their own transaction
  
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [governmentPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), governmentKeypair.publicKey.toBuffer()], PROGRAM_ID);

  // Anchor v0.29 enum format: Rust IssueStatus variants -> JS camelCase
  // Open -> open, InProgress -> inProgress, Resolved -> resolved, Closed -> closed
  const statusMap = {
    open: { open: {} },
    'in-progress': { inProgress: {} },
    'in_progress': { inProgress: {} },
    inprogress: { inProgress: {} },
    resolved: { resolved: {} },
    closed: { closed: {} }
  };
  const statusEnum = statusMap[newStatus.toLowerCase().replace(/[\s]/g, '-')] || { open: {} };
  
  try {
    console.log(`⛓️  Updating issue status on-chain: ${issueId} -> ${newStatus}`);
    
    const tx = await program.methods
      .updateIssueStatus(statusEnum)
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: governmentPDA,
        government: governmentKeypair.publicKey,
      })
      .signers([governmentKeypair]) // Government user signs their own transaction
      .rpc();
    
    console.log(`✅ Issue status updated on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error updating issue status on-chain:', error);
    throw new Error(`Failed to update issue status on-chain: ${error.message}`);
  }
}

// ---- Update Reputation On-Chain ----
async function updateReputationOnChain(userWalletAddress, newRep) {
  const userPubkey = new PublicKey(userWalletAddress);
  
  const program = getProgram(masterKeypair);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), userPubkey.toBuffer()], PROGRAM_ID);
  
  try {
    console.log(`⛓️  Updating reputation on-chain for ${userWalletAddress}: ${newRep}`);
    
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
    console.error('❌ Error updating reputation on-chain:', error);
    throw new Error(`Failed to update reputation on-chain: ${error.message}`);
  }
}

module.exports = {
  connection,
  masterKeypair,
  PROGRAM_ID,
  IDL,
  fundWallet,
  createUserOnChain,
  createIssueOnChain,
  recordVoteOnChain,
  recordVerificationOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain,
};