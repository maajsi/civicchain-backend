/**
 * CivicChain Solana Service
 * 
 * SERVER-SIDE BLOCKCHAIN APPROACH
 * --------------------------------
 * This service uses a server-side approach where:
 * 1. Privy custodial wallets are created for user identity (wallet addresses)
 * 2. Master wallet signs and pays for ALL blockchain transactions
 * 3. User wallet addresses are used as authorities in smart contract calls
 * 
 * Benefits:
 * - No gas fees for users
 * - Simplified user experience (no wallet management)
 * - Privy handles wallet creation and recovery
 * - All transactions paid by platform (master wallet)
 * 
 * Trade-offs:
 * - Platform pays for all gas fees
 * - Users don't directly sign transactions (delegated to master wallet)
 * - Still maintains on-chain user identity via PDA accounts
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


let privy;
async function getPrivyClient() {
  if (!privy) {
    const module = await import('@privy-io/node');
    privy = new module.PrivyClient({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET,
    });
  }
  return privy;
}

const MASTER_WALLET_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
if (!MASTER_WALLET_PRIVATE_KEY) throw new Error('MASTER_WALLET_PRIVATE_KEY missing from .env');

const masterKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(MASTER_WALLET_PRIVATE_KEY)));
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);

const idlPath = path.join(__dirname, '../../solana-contract/target/idl/idl.json');
if (!fs.existsSync(idlPath)) throw new Error('IDL file not found at: ' + idlPath);
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

function getProgram(wallet) {
  if (!wallet || !wallet.publicKey) throw new Error('getProgram: wallet is not a Keypair');
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  return new Program(IDL, PROGRAM_ID, provider);
}

// ---- Privy SDK: Get User's Solana Wallet ----
// Use privy.wallets().get() instead of privy.users().get() as per docs
async function getUserSolanaWallet(walletId) {
  const privy = await getPrivyClient();
  const wallet = await privy.wallets().get(walletId);
  
  if (!wallet) {
    throw new Error('Privy: Wallet not found: ' + walletId);
  }
  
  if (wallet.chain_type !== 'solana') {
    throw new Error('Privy: Wallet is not a Solana wallet');
  }

  // Return wallet info
  return {
    walletId: wallet.id,
    address: wallet.address,
    publicKey: new PublicKey(wallet.address),
  };
}

// ---- Funding Wallet ----
async function fundWallet(toPublicKeyOrKeypair, lamports = 1 * LAMPORTS_PER_SOL) {
  let toPubkey;
  if (toPublicKeyOrKeypair instanceof Keypair) {
    toPubkey = toPublicKeyOrKeypair.publicKey;
  } else if (toPublicKeyOrKeypair instanceof PublicKey) {
    toPubkey = toPublicKeyOrKeypair;
  } else if (typeof toPublicKeyOrKeypair === 'string') {
    toPubkey = new PublicKey(toPublicKeyOrKeypair);
  } else {
    throw new Error('fundWallet: invalid argument');
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: masterKeypair.publicKey,
      toPubkey,
      lamports,
    })
  );
  const signature = await connection.sendTransaction(tx, [masterKeypair]);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

// ---- Create User On-Chain ----
// NOTE: Server-side approach - Master wallet signs all transactions
// Privy custodial wallets are used for identity (the authority), but master wallet pays gas
async function createUserOnChain(walletInfoOrId, initialRep = 100, role = 'citizen') {
  let address, publicKey;
  
  // Support both formats: direct wallet info object OR wallet ID string
  if (typeof walletInfoOrId === 'object') {
    // Direct wallet info passed from createCustodialWallet
    address = walletInfoOrId.walletAddress;
    publicKey = new PublicKey(address);
  } else {
    // Wallet ID - fetch wallet info
    const walletInfo = await getUserSolanaWallet(walletInfoOrId);
    address = walletInfo.address;
    publicKey = walletInfo.publicKey;
  }
  
  // Build the transaction - master wallet signs and pays
  const program = getProgram(masterKeypair);
  const [userPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), publicKey.toBuffer()],
    PROGRAM_ID
  );
  
  // Anchor expects PascalCase enum variants
  const roleEnum = role === 'government' ? { Government: {} } : { Citizen: {} };
  
  try {
    console.log(`⛓️  Creating user account on-chain for ${address}`);
    console.log(`   User PDA: ${userPDA.toString()}`);
    console.log(`   Authority (Privy wallet): ${publicKey.toString()}`);
    console.log(`   Role: ${role}`);
    
    // Master wallet signs and pays for the transaction
    const tx = await program.methods
      .initializeUser(initialRep, roleEnum)
      .accounts({
        userAccount: userPDA,
        authority: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ User account created on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error creating user on-chain:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to create user on-chain: ${error.message}`);
  }
}

// ---- Create Issue On-Chain ----
async function createIssueOnChain(walletIdOrAddress, issueId, category = 'other', priority = 50) {
  let publicKey;
  
  // Support wallet ID or direct address
  if (typeof walletIdOrAddress === 'string' && walletIdOrAddress.length > 50) {
    // It's a wallet address
    publicKey = new PublicKey(walletIdOrAddress);
  } else {
    // It's a wallet ID - fetch wallet info
    const walletInfo = await getUserSolanaWallet(walletIdOrAddress);
    publicKey = walletInfo.publicKey;
  }
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), publicKey.toBuffer()], PROGRAM_ID);

  // PascalCase enums
  const categoryMap = {
    pothole: { Pothole: {} },
    garbage: { Garbage: {} },
    streetlight: { Streetlight: {} },
    water: { Water: {} },
    other: { Other: {} }
  };
  const categoryEnum = categoryMap[category.toLowerCase()] || { Other: {} };
  
  try {
    console.log(`⛓️  Creating issue on-chain: ${issueId}`);
    
    const tx = await program.methods
      .createIssue(Array.from(issueHash), categoryEnum, priority)
      .accounts({
        issueAccount: issuePDA,
        userAccount: userPDA,
        authority: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ Issue created on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error creating issue on-chain:', error);
    throw new Error(`Failed to create issue on-chain: ${error.message}`);
  }
}

// ---- Record Vote On-Chain ----
async function recordVoteOnChain(voterWalletAddress, issueId, reporterWalletAddress, voteType = 'upvote') {
  const voterPubkey = new PublicKey(voterWalletAddress);
  const reporterPubkey = new PublicKey(reporterWalletAddress);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [reporterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), reporterPubkey.toBuffer()], PROGRAM_ID);
  const [voterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), voterPubkey.toBuffer()], PROGRAM_ID);
  
  // PascalCase enums
  const voteTypeEnum = voteType.toLowerCase() === 'upvote' ? { Upvote: {} } : { Downvote: {} };
  
  try {
    console.log(`⛓️  Recording ${voteType} on-chain for issue: ${issueId}`);
    
    const tx = await program.methods
      .recordVote(voteTypeEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: voterPubkey,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ Vote recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error recording vote on-chain:', error);
    throw new Error(`Failed to record vote on-chain: ${error.message}`);
  }
}

// ---- Record Verification On-Chain ----
async function recordVerificationOnChain(verifierWalletAddress, issueId, reporterWalletAddress) {
  const verifierPubkey = new PublicKey(verifierWalletAddress);
  const reporterPubkey = new PublicKey(reporterWalletAddress);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [verifierPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), verifierPubkey.toBuffer()], PROGRAM_ID);
  const [reporterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), reporterPubkey.toBuffer()], PROGRAM_ID);
  
  try {
    console.log(`⛓️  Recording verification on-chain for issue: ${issueId}`);
    
    const tx = await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        verifierAccount: verifierPDA,
        verifier: verifierPubkey,
      })
      .signers([masterKeypair])
      .rpc();
    
    console.log(`✅ Verification recorded on-chain. Tx: ${tx}`);
    return tx;
  } catch (error) {
    console.error('❌ Error recording verification on-chain:', error);
    throw new Error(`Failed to record verification on-chain: ${error.message}`);
  }
}

// ---- Update Issue Status On-Chain ----
async function updateIssueStatusOnChain(governmentWalletAddress, issueId, reporterWalletAddress, newStatus = 'resolved') {
  const governmentPubkey = new PublicKey(governmentWalletAddress);
  const reporterPubkey = new PublicKey(reporterWalletAddress);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [governmentPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), governmentPubkey.toBuffer()], PROGRAM_ID);
  const [reporterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), reporterPubkey.toBuffer()], PROGRAM_ID);

  // PascalCase enums
  const statusMap = {
    open: { Open: {} },
    inprogress: { InProgress: {} },
    resolved: { Resolved: {} },
    closed: { Closed: {} }
  };
  const statusEnum = statusMap[newStatus.toLowerCase().replace(/[_\s]/g, '')] || { Open: {} };
  
  try {
    console.log(`⛓️  Updating issue status on-chain: ${issueId} -> ${newStatus}`);
    
    const tx = await program.methods
      .updateIssueStatus(statusEnum)
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        governmentAccount: governmentPDA,
        government: governmentPubkey,
      })
      .signers([masterKeypair])
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
  getUserSolanaWallet,
  getPrivyClient, // Export for advanced usage
};