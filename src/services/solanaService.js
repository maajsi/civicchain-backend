/**
 * CivicChain Solana Service
 * 
 * IMPORTANT: Privy Embedded Wallet Architecture
 * -----------------------------------------------
 * Privy embedded wallets do NOT expose private keys directly for security reasons.
 * All transactions must be signed through Privy's API using the wallet ID.
 * 
 * This means we:
 * 1. Build transactions manually with Anchor instructions
 * 2. Serialize the transaction
 * 3. Send it to Privy's API to sign with the user's embedded wallet
 * 4. Broadcast the signed transaction to Solana
 * 
 * Reference: https://docs.privy.io/api-reference/wallets/solana/sign-transaction
 */
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
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
// NOTE: Privy embedded wallets cannot be used directly with Anchor
// because Privy does NOT expose private keys. You have two options:
// 1. Use server-side wallets (master wallet) to create accounts
// 2. Build transactions manually and use Privy's signTransaction API
async function createUserOnChain(walletInfoOrId, initialRep = 100, role = 'citizen') {
  let walletId, address, publicKey;
  
  // Support both formats: direct wallet info object OR wallet ID string
  if (typeof walletInfoOrId === 'object') {
    // Direct wallet info passed from createCustodialWallet
    walletId = walletInfoOrId.walletId;
    address = walletInfoOrId.walletAddress;
    publicKey = new PublicKey(address);
  } else {
    // Wallet ID - fetch wallet info
    const walletInfo = await getUserSolanaWallet(walletInfoOrId);
    walletId = walletInfo.walletId;
    address = walletInfo.address;
    publicKey = walletInfo.publicKey;
  }
  
  // Build the transaction instruction manually
  const program = getProgram(masterKeypair); // Use master wallet for provider
  const [userPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), publicKey.toBuffer()],
    PROGRAM_ID
  );
  const roleEnum = role === 'government' ? { Government: {} } : { Citizen: {} };
  
  // Build instruction
  const ix = await program.methods
    .initializeUser(initialRep, roleEnum)
    .accounts({
      userAccount: userPDA,
      authority: publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  
  // Create VersionedTransaction as per Privy docs
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  // Send the signed transaction
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Create Issue On-Chain ----
async function createIssueOnChain(walletId, issueId, category = 'other', priority = 50) {
  const { publicKey, address } = await getUserSolanaWallet(walletId);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), publicKey.toBuffer()], PROGRAM_ID);

  const categoryMap = {
    pothole: { Pothole: {} },
    garbage: { Garbage: {} },
    streetlight: { Streetlight: {} },
    water: { Water: {} },
    other: { Other: {} }
  };
  const categoryEnum = categoryMap[category.toLowerCase()] || { Other: {} };
  
  const ix = await program.methods
    .createIssue(Array.from(issueHash), categoryEnum, priority)
    .accounts({
      issueAccount: issuePDA,
      userAccount: userPDA,
      authority: publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  
  // Create VersionedTransaction
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Record Vote On-Chain ----
async function recordVoteOnChain(walletId, issueId, reporterPubkey, voteType = 'upvote') {
  const { publicKey } = await getUserSolanaWallet(walletId);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [reporterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), new PublicKey(reporterPubkey).toBuffer()], PROGRAM_ID);
  const [voterPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), publicKey.toBuffer()], PROGRAM_ID);
  const voteTypeEnum = voteType.toLowerCase() === 'upvote' ? { Upvote: {} } : { Downvote: {} };
  
  const ix = await program.methods
    .recordVote(voteTypeEnum)
    .accounts({
      issueAccount: issuePDA,
      reporterAccount: reporterPDA,
      voterAccount: voterPDA,
      voter: publicKey,
    })
    .instruction();
  
  // Create VersionedTransaction
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Record Verification On-Chain ----
async function recordVerificationOnChain(walletId, issueId) {
  const { publicKey } = await getUserSolanaWallet(walletId);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [verifierPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), publicKey.toBuffer()], PROGRAM_ID);
  
  const ix = await program.methods
    .recordVerification()
    .accounts({
      issueAccount: issuePDA,
      verifierAccount: verifierPDA,
      verifier: publicKey,
    })
    .instruction();
  
  // Create VersionedTransaction
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Update Issue Status On-Chain ----
async function updateIssueStatusOnChain(walletId, issueId, newStatus = 'resolved') {
  const { publicKey } = await getUserSolanaWallet(walletId);
  
  const program = getProgram(masterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [governmentPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), publicKey.toBuffer()], PROGRAM_ID);

  const statusMap = {
    open: { Open: {} },
    inprogress: { InProgress: {} },
    resolved: { Resolved: {} },
    closed: { Closed: {} }
  };
  const statusEnum = statusMap[newStatus.toLowerCase().replace(/[_\s]/g, '')] || { Open: {} };
  
  const ix = await program.methods
    .updateIssueStatus(statusEnum)
    .accounts({
      issueAccount: issuePDA,
      governmentAccount: governmentPDA,
      government: publicKey,
    })
    .instruction();
  
  // Create VersionedTransaction
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Update Reputation On-Chain ----
async function updateReputationOnChain(walletId, userPubkey, newRep) {
  const { publicKey } = await getUserSolanaWallet(walletId);
  
  const program = getProgram(masterKeypair);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), new PublicKey(userPubkey).toBuffer()], PROGRAM_ID);
  
  const ix = await program.methods
    .updateReputation(newRep)
    .accounts({
      userAccount: userPDA,
      authority: publicKey,
    })
    .instruction();
  
  // Create VersionedTransaction
  const { blockhash: recentBlockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: publicKey,
    instructions: [ix],
    recentBlockhash,
  });
  const transaction = new VersionedTransaction(message.compileToV0Message());
  
  // Sign transaction with Privy
  const privy = await getPrivyClient();
  const { signedTransaction } = await privy.wallets().solana().signTransaction(walletId, {
    transaction: Buffer.from(transaction.serialize()).toString('base64'),
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
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