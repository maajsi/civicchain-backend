// Simplified CivicChain Solana Service
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

function getProgram(wallet) {
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  return new Program(IDL, PROGRAM_ID, provider);
}

// Helper to fund wallet using master wallet
async function fundWalletFromMaster(toKeypair, lamports = 1 * LAMPORTS_PER_SOL) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: masterKeypair.publicKey,
      toPubkey: toKeypair.publicKey,
      lamports,
    })
  );
  const signature = await connection.sendTransaction(tx, [masterKeypair]);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

// Create User on-chain
async function createUserOnChain(userKeypair, initialRep = 100, role = 'citizen') {
  const program = getProgram(userKeypair);
  const [userPDA] = await PublicKey.findProgramAddressSync(
    [Buffer.from('user'), userKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const roleEnum = role === 'government' ? { Government: {} } : { Citizen: {} };
  return await program.methods
    .initializeUser(initialRep, roleEnum)
    .accounts({
      userAccount: userPDA,
      authority: userKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([userKeypair])
    .rpc();
}

// Create Issue on-chain
async function createIssueOnChain(reporterKeypair, issueId, category = 'other', priority = 50) {
  const program = getProgram(reporterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = await PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [userPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), reporterKeypair.publicKey.toBuffer()], PROGRAM_ID);

  const categoryMap = {
    pothole: { Pothole: {} },
    garbage: { Garbage: {} },
    streetlight: { Streetlight: {} },
    water: { Water: {} },
    other: { Other: {} }
  };
  const categoryEnum = categoryMap[category.toLowerCase()] || { Other: {} };
  return await program.methods
    .createIssue(Array.from(issueHash), categoryEnum, priority)
    .accounts({
      issueAccount: issuePDA,
      userAccount: userPDA,
      authority: reporterKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([reporterKeypair])
    .rpc();
}

// Record Vote on-chain
async function recordVoteOnChain(voterKeypair, issueId, reporterPubkey, voteType = 'upvote') {
  const program = getProgram(voterKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = await PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [reporterPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), reporterPubkey.toBuffer()], PROGRAM_ID);
  const [voterPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), voterKeypair.publicKey.toBuffer()], PROGRAM_ID);
  const voteTypeEnum = voteType.toLowerCase() === 'upvote' ? { Upvote: {} } : { Downvote: {} };
  return await program.methods
    .recordVote(voteTypeEnum)
    .accounts({
      issueAccount: issuePDA,
      reporterAccount: reporterPDA,
      voterAccount: voterPDA,
      voter: voterKeypair.publicKey,
    })
    .signers([voterKeypair])
    .rpc();
}

// Record Verification on-chain
async function recordVerificationOnChain(verifierKeypair, issueId) {
  const program = getProgram(verifierKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = await PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [verifierPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), verifierKeypair.publicKey.toBuffer()], PROGRAM_ID);
  return await program.methods
    .recordVerification()
    .accounts({
      issueAccount: issuePDA,
      verifierAccount: verifierPDA,
      verifier: verifierKeypair.publicKey,
    })
    .signers([verifierKeypair])
    .rpc();
}

// Update Issue Status on-chain
async function updateIssueStatusOnChain(governmentKeypair, issueId, newStatus = 'resolved') {
  const program = getProgram(governmentKeypair);
  const issueHash = createHash('sha256').update(issueId).digest();
  const [issuePDA] = await PublicKey.findProgramAddressSync([Buffer.from('issue'), issueHash], PROGRAM_ID);
  const [governmentPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), governmentKeypair.publicKey.toBuffer()], PROGRAM_ID);

  const statusMap = {
    open: { Open: {} },
    inprogress: { InProgress: {} },
    resolved: { Resolved: {} },
    closed: { Closed: {} }
  };
  const statusEnum = statusMap[newStatus.toLowerCase().replace(/[_\s]/g, '')] || { Open: {} };
  return await program.methods
    .updateIssueStatus(statusEnum)
    .accounts({
      issueAccount: issuePDA,
      governmentAccount: governmentPDA,
      government: governmentKeypair.publicKey,
    })
    .signers([governmentKeypair])
    .rpc();
}

// Update Reputation on-chain
async function updateReputationOnChain(authorityKeypair, userPubkey, newRep) {
  const program = getProgram(authorityKeypair);
  const [userPDA] = await PublicKey.findProgramAddressSync([Buffer.from('user'), userPubkey.toBuffer()], PROGRAM_ID);
  return await program.methods
    .updateReputation(newRep)
    .accounts({
      userAccount: userPDA,
      authority: authorityKeypair.publicKey,
    })
    .signers([authorityKeypair])
    .rpc();
}

module.exports = {
  connection,
  masterKeypair,
  PROGRAM_ID,
  IDL,
  fundWalletFromMaster,
  createUserOnChain,
  createIssueOnChain,
  recordVoteOnChain,
  recordVerificationOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain,
};