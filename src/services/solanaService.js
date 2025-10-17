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
async function getUserSolanaWallet(privyUserId) {
  // Get the user to access their linked accounts
  const privy = await getPrivyClient();
  const user = await privy.users().get(privyUserId);
  if (!user) throw new Error('Privy: User not found: ' + privyUserId);

  // Find the Solana embedded wallet in linked accounts
  const solanaWallet = user.linked_accounts.find(
    account => account.type === 'solana_embedded_wallet'
  );
  
  if (!solanaWallet) {
    throw new Error('Privy: No Solana embedded wallet found for user ' + privyUserId);
  }

  // Return wallet ID and address
  // Note: Privy does NOT expose private keys directly
  // You must use Privy's signing/transaction methods
  return {
    walletId: solanaWallet.wallet_id,
    address: solanaWallet.address,
    publicKey: new PublicKey(solanaWallet.address),
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
async function createUserOnChain(privyUserId, initialRep = 100, role = 'citizen') {
  const { walletId, address, publicKey } = await getUserSolanaWallet(privyUserId);
  
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
  
  // Create transaction
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  // Serialize and sign with Privy
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet', // or 'solana:mainnet'
    params: {
      transaction: serializedTx,
    },
  });
  
  // Send the signed transaction
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Create Issue On-Chain ----
async function createIssueOnChain(reporterPrivyUserId, issueId, category = 'other', priority = 50) {
  const { walletId, publicKey } = await getUserSolanaWallet(reporterPrivyUserId);
  
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
  
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet',
    params: { transaction: serializedTx },
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Record Vote On-Chain ----
async function recordVoteOnChain(voterPrivyUserId, issueId, reporterPubkey, voteType = 'upvote') {
  const { walletId, publicKey } = await getUserSolanaWallet(voterPrivyUserId);
  
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
  
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet',
    params: { transaction: serializedTx },
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Record Verification On-Chain ----
async function recordVerificationOnChain(verifierPrivyUserId, issueId) {
  const { walletId, publicKey } = await getUserSolanaWallet(verifierPrivyUserId);
  
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
  
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet',
    params: { transaction: serializedTx },
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Update Issue Status On-Chain ----
async function updateIssueStatusOnChain(governmentPrivyUserId, issueId, newStatus = 'resolved') {
  const { walletId, publicKey } = await getUserSolanaWallet(governmentPrivyUserId);
  
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
  
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet',
    params: { transaction: serializedTx },
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
    { skipPreflight: false }
  );
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

// ---- Update Reputation On-Chain ----
async function updateReputationOnChain(authorityPrivyUserId, userPubkey, newRep) {
  const { walletId, publicKey } = await getUserSolanaWallet(authorityPrivyUserId);
  
  const program = getProgram(masterKeypair);
  const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from('user'), new PublicKey(userPubkey).toBuffer()], PROGRAM_ID);
  
  const ix = await program.methods
    .updateReputation(newRep)
    .accounts({
      userAccount: userPDA,
      authority: publicKey,
    })
    .instruction();
  
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
  const privy = await getPrivyClient();
  const signedTx = await privy.wallets().solana().signTransaction(walletId, {
    caip2: 'solana:devnet',
    params: { transaction: serializedTx },
  });
  
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTx.transaction, 'base64'),
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