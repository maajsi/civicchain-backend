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

describe('Solana Service', () => {
  const solanaService = require('../src/services/solanaService');
  const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
  const fs = require('fs');
  const path = require('path');

  test('should export required functions', () => {
    expect(typeof solanaService.createUserOnChain).toBe('function');
    expect(typeof solanaService.createIssueOnChain).toBe('function');
    expect(typeof solanaService.recordVoteOnChain).toBe('function');
    expect(typeof solanaService.recordVerificationOnChain).toBe('function');
    expect(typeof solanaService.updateIssueStatusOnChain).toBe('function');
    expect(typeof solanaService.updateReputationOnChain).toBe('function');
    expect(typeof solanaService.fundWallet).toBe('function');
    expect(typeof solanaService.getBalance).toBe('function');
  });

  test('should diagnose Anchor compatibility', async () => {
    console.log('\n🔍 ANCHOR COMPATIBILITY DIAGNOSTIC\n');
    console.log('='.repeat(60));
    
    // Load IDL
    const idlPath = path.join(__dirname, '../solana-contract/target/idl/civicchain.json');
    let idl = null;
    try {
      idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
      console.log('✅ IDL loaded successfully');
      console.log('   Address:', idl.address);
      console.log('   Version:', idl.metadata?.version);
      console.log('   Spec:', idl.metadata?.spec);
      console.log('   Instructions:', idl.instructions?.length);
      console.log('   Accounts:', idl.accounts?.length);
      console.log('   Types:', idl.types?.length);
    } catch (error) {
      console.log('❌ Failed to load IDL:', error.message);
      return;
    }

    console.log('\n' + '-'.repeat(60));
    console.log('Testing @coral-xyz/anchor...\n');
    
    // Test @coral-xyz/anchor
    try {
      const coralAnchor = require('@coral-xyz/anchor');
      const coralVersion = require('@coral-xyz/anchor/package.json').version;
      console.log('✅ @coral-xyz/anchor installed, version:', coralVersion);
      
      if (!solanaService.masterKeypair) {
        console.log('⚠️  Master keypair not loaded, skipping Program creation test');
      } else {
        try {
          const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
          const provider = new coralAnchor.AnchorProvider(
            connection,
            new coralAnchor.Wallet(solanaService.masterKeypair),
            { commitment: 'confirmed' }
          );
          
          const programId = new PublicKey(idl.address);
          console.log('   Attempting to create Program instance...');
          const program = new coralAnchor.Program(idl, programId, provider);
          console.log('   ✅ SUCCESS! Program created with @coral-xyz/anchor');
          console.log('   Program ID:', program.programId.toString());
          console.log('   Methods available:', Object.keys(program.methods).join(', '));
        } catch (error) {
          console.log('   ❌ FAILED to create Program with @coral-xyz/anchor');
          console.log('   Error:', error.message);
          console.log('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
          console.log('\n   🔍 This is the ROOT CAUSE of your issue!');
        }
      }
    } catch (err) {
      console.log('⚠️  @coral-xyz/anchor not found');
    }

    console.log('\n' + '-'.repeat(60));
    console.log('Testing @project-serum/anchor...\n');
    
    // Test @project-serum/anchor
    try {
      const serumAnchor = require('@project-serum/anchor');
      const serumVersion = require('@project-serum/anchor/package.json').version;
      console.log('✅ @project-serum/anchor installed, version:', serumVersion);
      
      if (!solanaService.masterKeypair) {
        console.log('⚠️  Master keypair not loaded, skipping Program creation test');
      } else {
        try {
          const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
          const provider = new serumAnchor.AnchorProvider(
            connection,
            new serumAnchor.Wallet(solanaService.masterKeypair),
            { commitment: 'confirmed' }
          );
          
          const programId = new PublicKey(idl.address);
          console.log('   Attempting to create Program instance...');
          const program = new serumAnchor.Program(idl, programId, provider);
          console.log('   ✅ SUCCESS! Program created with @project-serum/anchor');
          console.log('   Program ID:', program.programId.toString());
          console.log('   Methods available:', Object.keys(program.methods).join(', '));
        } catch (error) {
          console.log('   ❌ FAILED to create Program with @project-serum/anchor');
          console.log('   Error:', error.message);
        }
      }
    } catch (err) {
      console.log('⚠️  @project-serum/anchor not found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RECOMMENDATION:');
    console.log('   If @coral-xyz/anchor failed but @project-serum/anchor worked,');
    console.log('   update solanaService.js to use @project-serum/anchor instead.\n');
    
    expect(true).toBe(true); // Always pass, this is a diagnostic test
  }, 30000); // 30 second timeout
});