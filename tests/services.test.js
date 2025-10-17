// Test AI service functionality
const { normalizeCategory } = require('../src/services/aiService');

describe('AI Service', () => {
  describe('Category Normalization', () => {
    test('should normalize pothole variations', () => {
      expect(normalizeCategory('pothole')).toBe('pothole');
      expect(normalizeCategory('potholes')).toBe('pothole');
      expect(normalizeCategory('POTHOLE')).toBe('pothole');
    });

    test('should normalize garbage variations', () => {
      expect(normalizeCategory('garbage')).toBe('garbage');
      expect(normalizeCategory('trash')).toBe('garbage');
      expect(normalizeCategory('waste')).toBe('garbage');
    });

    test('should normalize streetlight variations', () => {
      expect(normalizeCategory('streetlight')).toBe('streetlight');
      expect(normalizeCategory('street_light')).toBe('streetlight');
      expect(normalizeCategory('light')).toBe('streetlight');
    });

    test('should normalize water variations', () => {
      expect(normalizeCategory('water')).toBe('water');
      expect(normalizeCategory('water_leak')).toBe('water');
      expect(normalizeCategory('water_main')).toBe('water');
    });

    test('should return other for unknown categories', () => {
      expect(normalizeCategory('unknown')).toBe('other');
      expect(normalizeCategory('random')).toBe('other');
      expect(normalizeCategory('')).toBe('other');
    });
  });
});

describe('Solana Contract - Complete Integration Tests', () => {
  const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
  const { createHash } = require('crypto');
  const fs = require('fs');
  const path = require('path');
  
  let connection, masterWallet, program, programId, idl;
  let citizen1, citizen2, governmentUser;
  let testIssueId, testIssueHash, testIssuePDA; // Shared state

  beforeAll(async () => {
    const masterPrivateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!masterPrivateKey) {
      throw new Error('MASTER_WALLET_PRIVATE_KEY not set');
    }

    // Load and fix IDL
    const idlPath = path.join(__dirname, '../solana-contract/target/idl/civicchain.json');
    idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    // Apply IDL fix
    if (idl.accounts && idl.types) {
      idl.accounts = idl.accounts.map(account => {
        const typeDefinition = idl.types.find(t => t.name === account.name);
        if (typeDefinition && !account.type) {
          return { ...account, type: typeDefinition.type };
        }
        return account;
      });
    }

    masterWallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(masterPrivateKey)));
    connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    const coralAnchor = require('@coral-xyz/anchor');
    const provider = new coralAnchor.AnchorProvider(connection, new coralAnchor.Wallet(masterWallet), {});
    programId = new PublicKey(idl.address);
    program = new coralAnchor.Program(idl, provider);

    // Create test users
    citizen1 = Keypair.generate();
    citizen2 = Keypair.generate();
    governmentUser = Keypair.generate();

    console.log('\n🔧 Setting up test environment...');
    console.log('   Master wallet:', masterWallet.publicKey.toString());
    console.log('   Citizen 1:', citizen1.publicKey.toString());
    console.log('   Citizen 2:', citizen2.publicKey.toString());
    console.log('   Government:', governmentUser.publicKey.toString());
  }, 60000);

  // Helper function to fund a wallet
  async function fundWallet(wallet, amount = 0.1) {
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterWallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx, [masterWallet]);
  }

  test('1. initialize_user - Create citizen users', async () => {
    console.log('\n📝 Test 1: Initialize citizen users\n');
    
    // Fund citizens
    await fundWallet(citizen1);
    await fundWallet(citizen2);
    
    for (const citizen of [citizen1, citizen2]) {
      const [userPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('user'), citizen.publicKey.toBuffer()],
        programId
      );

      const tx = await program.methods
        .initializeUser(100, { citizen: {} })
        .accounts({
          userAccount: userPDA,
          authority: citizen.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([citizen])
        .rpc();

      console.log(`✅ Citizen initialized: ${citizen.publicKey.toString().slice(0, 8)}...`);
      console.log(`   Transaction: ${tx}`);

      // Verify account
      const account = await program.account.userAccount.fetch(userPDA);
      expect(account.reputation).toBe(100);
      expect(account.role).toEqual({ citizen: {} });
    }
  }, 60000);

  test('2. initialize_user - Create government user', async () => {
    console.log('\n📝 Test 2: Initialize government user\n');
    
    await fundWallet(governmentUser);
    
    const [userPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), governmentUser.publicKey.toBuffer()],
      programId
    );

    const tx = await program.methods
      .initializeUser(500, { government: {} })
      .accounts({
        userAccount: userPDA,
        authority: governmentUser.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([governmentUser])
      .rpc();

    console.log(`✅ Government user initialized`);
    console.log(`   Transaction: ${tx}`);

    const account = await program.account.userAccount.fetch(userPDA);
    expect(account.reputation).toBe(500);
    expect(account.role).toEqual({ government: {} });
  }, 60000);

  test('3. create_issue - Citizen reports an issue', async () => {
    console.log('\n📝 Test 3: Create issue\n');
    
    testIssueId = 'test-issue-' + Date.now();
    testIssueHash = createHash('sha256').update(testIssueId).digest();
    
    [testIssuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), testIssueHash],
      programId
    );
    const [userPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen1.publicKey.toBuffer()],
      programId
    );

    const tx = await program.methods
      .createIssue(Array.from(testIssueHash), { pothole: {} }, 75)
      .accounts({
        issueAccount: testIssuePDA,
        userAccount: userPDA,
        authority: citizen1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([citizen1])
      .rpc();

    console.log(`✅ Issue created`);
    console.log(`   Issue ID: ${testIssueId}`);
    console.log(`   Transaction: ${tx}`);

    const issue = await program.account.issueAccount.fetch(testIssuePDA);
    expect(issue.status).toEqual({ open: {} });
    expect(issue.category).toEqual({ pothole: {} });
    expect(issue.priority).toBe(75);
    expect(issue.upvotes).toBe(0);
    expect(issue.downvotes).toBe(0);

    // Verify user's total_issues incremented
    const user = await program.account.userAccount.fetch(userPDA);
    expect(user.totalIssues).toBe(1);
  }, 60000);

  test('4. record_vote - Citizens vote on issue', async () => {
    console.log('\n📝 Test 4: Record votes\n');
    
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen1.publicKey.toBuffer()],
      programId
    );
    const [voterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen2.publicKey.toBuffer()],
      programId
    );

    // Citizen 2 upvotes
    const tx = await program.methods
      .recordVote({ upvote: {} })
      .accounts({
        issueAccount: testIssuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: citizen2.publicKey,
      })
      .signers([citizen2])
      .rpc();

    console.log(`✅ Upvote recorded`);
    console.log(`   Transaction: ${tx}`);

    const issue = await program.account.issueAccount.fetch(testIssuePDA);
    expect(issue.upvotes).toBe(1);
    expect(issue.downvotes).toBe(0);
  }, 60000);

  test('5. update_issue_status - Government updates status', async () => {
    console.log('\n📝 Test 5: Update issue status (government only)\n');
    
    const [govPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), governmentUser.publicKey.toBuffer()],
      programId
    );

    // Update to InProgress
    const tx1 = await program.methods
      .updateIssueStatus({ inProgress: {} })
      .accounts({
        issueAccount: testIssuePDA,
        governmentAccount: govPDA,
        government: governmentUser.publicKey,
      })
      .signers([governmentUser])
      .rpc();

    console.log(`✅ Status updated to InProgress`);
    console.log(`   Transaction: ${tx1}`);

    let issue = await program.account.issueAccount.fetch(testIssuePDA);
    expect(issue.status).toEqual({ inProgress: {} });

    // Update to Resolved
    const tx2 = await program.methods
      .updateIssueStatus({ resolved: {} })
      .accounts({
        issueAccount: testIssuePDA,
        governmentAccount: govPDA,
        government: governmentUser.publicKey,
      })
      .signers([governmentUser])
      .rpc();

    console.log(`✅ Status updated to Resolved`);
    console.log(`   Transaction: ${tx2}`);

    issue = await program.account.issueAccount.fetch(testIssuePDA);
    expect(issue.status).toEqual({ resolved: {} });
  }, 60000);

  test('6. record_verification - Citizen verifies resolved issue', async () => {
    console.log('\n📝 Test 6: Record verification\n');
    
    const [verifierPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen2.publicKey.toBuffer()],
      programId
    );

    const tx = await program.methods
      .recordVerification()
      .accounts({
        issueAccount: testIssuePDA,
        verifierAccount: verifierPDA,
        verifier: citizen2.publicKey,
      })
      .signers([citizen2])
      .rpc();

    console.log(`✅ Verification recorded`);
    console.log(`   Transaction: ${tx}`);

    const issue = await program.account.issueAccount.fetch(testIssuePDA);
    expect(issue.verifications).toBe(1);

    const verifier = await program.account.userAccount.fetch(verifierPDA);
    expect(verifier.totalVerifications).toBe(1);
  }, 60000);

  test('7. update_reputation - Update user reputation', async () => {
    console.log('\n📝 Test 7: Update reputation\n');
    
    const [userPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen1.publicKey.toBuffer()],
      programId
    );

    const tx = await program.methods
      .updateReputation(150)
      .accounts({
        userAccount: userPDA,
        authority: masterWallet.publicKey,
      })
      .signers([masterWallet])
      .rpc();

    console.log(`✅ Reputation updated`);
    console.log(`   Transaction: ${tx}`);

    const user = await program.account.userAccount.fetch(userPDA);
    expect(user.reputation).toBe(150);
  }, 60000);

  test('8. Full workflow - Complete issue lifecycle', async () => {
    console.log('\n📝 Test 8: Complete issue lifecycle\n');
    
    const issueId = 'workflow-issue-' + Date.now();
    const issueHash = createHash('sha256').update(issueId).digest();
    
    // 1. Create issue
    const [issuePDA] = await PublicKey.findProgramAddress(
      [Buffer.from('issue'), issueHash],
      programId
    );
    const [reporterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen1.publicKey.toBuffer()],
      programId
    );

    await program.methods
      .createIssue(Array.from(issueHash), { garbage: {} }, 90)
      .accounts({
        issueAccount: issuePDA,
        userAccount: reporterPDA,
        authority: citizen1.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([citizen1])
      .rpc();
    console.log('   ✅ Issue created');

    // 2. Vote
    const [voterPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), citizen2.publicKey.toBuffer()],
      programId
    );
    await program.methods
      .recordVote({ upvote: {} })
      .accounts({
        issueAccount: issuePDA,
        reporterAccount: reporterPDA,
        voterAccount: voterPDA,
        voter: citizen2.publicKey,
      })
      .signers([citizen2])
      .rpc();
    console.log('   ✅ Vote recorded');

    // 3. Government updates to InProgress
    const [govPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('user'), governmentUser.publicKey.toBuffer()],
      programId
    );
    await program.methods
      .updateIssueStatus({ inProgress: {} })
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: govPDA,
        government: governmentUser.publicKey,
      })
      .signers([governmentUser])
      .rpc();
    console.log('   ✅ Status: InProgress');

    // 4. Government marks as Resolved
    await program.methods
      .updateIssueStatus({ resolved: {} })
      .accounts({
        issueAccount: issuePDA,
        governmentAccount: govPDA,
        government: governmentUser.publicKey,
      })
      .signers([governmentUser])
      .rpc();
    console.log('   ✅ Status: Resolved');

    // 5. Citizen verifies
    await program.methods
      .recordVerification()
      .accounts({
        issueAccount: issuePDA,
        verifierAccount: voterPDA,
        verifier: citizen2.publicKey,
      })
      .signers([citizen2])
      .rpc();
    console.log('   ✅ Verification recorded');

    // Verify final state
    const issue = await program.account.issueAccount.fetch(issuePDA);
    expect(issue.status).toEqual({ resolved: {} });
    expect(issue.upvotes).toBe(1);
    expect(issue.verifications).toBe(1);
    
    console.log('\n🎉 COMPLETE WORKFLOW SUCCESS!\n');
    console.log('✅ ALL CONTRACT FUNCTIONS TESTED AND WORKING!\n');
    console.log('📌 Now apply the IDL fix to solanaService.js for production use.\n');
  }, 120000);
});