// CivicChain Solana Smart Contract Integration Test
// Program ID: 6EdYdgs56yiyNYgo2oTnnVoK3FCDXh4JYF1DzXRQQf4q

const anchor = require('@coral-xyz/anchor');
const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

describe('CivicChain - Solana Playground Integration', () => {
  const PROGRAM_ID = new PublicKey('6EdYdgs56yiyNYgo2oTnnVoK3FCDXh4JYF1DzXRQQf4q');
  let connection, provider, program, idl;
  let masterWallet;
  let citizen, government, voter;
  let citizenPDA, governmentPDA, issuePDA, issueHash;

  // Helper to fund wallet using masterWallet
  async function fundWalletFromMaster(toKeypair, lamports = 1 * LAMPORTS_PER_SOL) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterWallet.publicKey,
        toPubkey: toKeypair.publicKey,
        lamports,
      })
    );
    const signature = await connection.sendTransaction(tx, [masterWallet]);
    await connection.confirmTransaction(signature, "confirmed");
  }

  beforeAll(async () => {
    // Setup connection
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    // Load master wallet from env (JSON array)
    const masterKey = process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!masterKey) throw new Error('MASTER_WALLET_PRIVATE_KEY missing from .env');
    masterWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(masterKey)));
    provider = new anchor.AnchorProvider(connection, new anchor.Wallet(masterWallet), { commitment: "confirmed" });
    anchor.setProvider(provider);

    // Load IDL from playground export (update path if needed)
    idl = JSON.parse(fs.readFileSync(path.join(__dirname, '../solana-contract/target/idl/idl.json'), 'utf8'));
    program = new anchor.Program(idl, PROGRAM_ID, provider);

    // Generate wallets
    citizen = Keypair.generate();
    government = Keypair.generate();
    voter = Keypair.generate();

    // Fund wallets using master wallet (no faucet)
    await fundWalletFromMaster(citizen);
    await fundWalletFromMaster(government);
    await fundWalletFromMaster(voter);

    // Derive PDAs
    [citizenPDA] = await PublicKey.findProgramAddressSync([Buffer.from("user"), citizen.publicKey.toBuffer()], PROGRAM_ID);
    [governmentPDA] = await PublicKey.findProgramAddressSync([Buffer.from("user"), government.publicKey.toBuffer()], PROGRAM_ID);

    // Prepare issue hash/PDA
    issueHash = require('crypto').createHash('sha256').update('test-issue-' + Date.now()).digest();
    [issuePDA] = await PublicKey.findProgramAddressSync([Buffer.from("issue"), issueHash], PROGRAM_ID);
  }, 60000);

  test('1. Initialize User', async () => {
    await program.methods
      .initializeUser(100, { citizen: {} })
      .accounts({
        userAccount: citizenPDA,
        authority: citizen.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([citizen])
      .rpc();

    const user = await program.account.userAccount.fetch(citizenPDA);
    expect(user.reputation).toBe(100);

    await program.methods
      .initializeUser(500, { government: {} })
      .accounts({
        userAccount: governmentPDA,
        authority: government.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([government])
      .rpc();

    const gov = await program.account.userAccount.fetch(governmentPDA);
    expect(gov.role).toEqual({ government: {} });
  }, 60000);

  test('2. Create Issue', async () => {
    await program.methods
      .createIssue(Array.from(issueHash), { pothole: {} }, 75)
      .accounts({
        issueAccount: issuePDA,
        userAccount: citizenPDA,
        authority: citizen.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([citizen])
      .rpc();

    const issue = await program.account.issueAccount.fetch(issuePDA);
    expect(issue.priority).toBe(75);
    expect(issue.category).toEqual({ pothole: {} });
  }, 60000);

  test('3. Record Vote', async () => {
    const [voterPDA] = await PublicKey.findProgramAddressSync([Buffer.from("user"), voter.publicKey.toBuffer()], PROGRAM_ID);

    // Initialize voter as citizen
    await program.methods
      .initializeUser(100, { citizen: {} })
      .accounts({
        userAccount: voterPDA,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    await program.methods
      .recordVote({ upvote: {} })
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: citizenPDA,
        voterAccount: voterPDA,
        voter: voter.publicKey,
      })
      .signers([voter])
      .rpc();

    const issue = await program.account.issueAccount.fetch(issuePDA);
    expect(issue.upvotes).toBe(1);
  }, 60000);

  test('4. Record Verification', async () => {
    const [voterPDA] = await PublicKey.findProgramAddressSync([Buffer.from("user"), voter.publicKey.toBuffer()], PROGRAM_ID);

    // Make sure the issue is resolved before verification
    await program.methods
      .updateIssueStatus({ resolved: {} })
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: governmentPDA,
        government: government.publicKey,
      })
      .signers([government])
      .rpc();

    await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        verifierAccount: voterPDA,
        verifier: voter.publicKey,
      })
      .signers([voter])
      .rpc();

    const issue = await program.account.issueAccount.fetch(issuePDA);
    expect(issue.verifications).toBe(1);
  }, 60000);

  test('5. Update Issue Status', async () => {
    // Reopen the issue and set to inProgress, then resolved
    await program.methods
      .updateIssueStatus({ inProgress: {} })
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: governmentPDA,
        government: government.publicKey,
      })
      .signers([government])
      .rpc();

    await program.methods
      .updateIssueStatus({ resolved: {} })
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: governmentPDA,
        government: government.publicKey,
      })
      .signers([government])
      .rpc();

    const issue = await program.account.issueAccount.fetch(issuePDA);
    expect(issue.status).toEqual({ resolved: {} });
  }, 60000);

  test('6. Update Reputation', async () => {
    await program.methods
      .updateReputation(250)
      .accounts({
        userAccount: citizenPDA,
        authority: masterWallet.publicKey,
      })
      .signers([masterWallet])
      .rpc();

    const user = await program.account.userAccount.fetch(citizenPDA);
    expect(user.reputation).toBe(250);
  }, 60000);
});