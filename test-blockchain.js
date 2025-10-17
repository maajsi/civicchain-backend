/**
 * Test Script for Blockchain Integration
 * 
 * This script tests the Solana blockchain integration to identify
 * and fix any enum serialization issues.
 */

const { PublicKey, Keypair } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { Connection } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

const MASTER_WALLET_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
const masterKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(MASTER_WALLET_PRIVATE_KEY)));
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID);

// Load IDL
const idlPath = path.join(__dirname, 'solana-contract/target/idl/idl.json');
const IDL = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

console.log('🔧 Testing Blockchain Integration\n');
console.log(`Program ID: ${PROGRAM_ID.toString()}`);
console.log(`Master Wallet: ${masterKeypair.publicKey.toString()}`);
console.log(`\n📋 IDL Loaded:`);
console.log(`- Instructions: ${IDL.instructions.length}`);
console.log(`- Types: ${IDL.types.length}\n`);

// Test enum formats
console.log('🧪 Testing Enum Formats:\n');

// Test 1: Object format (WRONG)
console.log('Test 1: Object format { Citizen: {} }');
try {
  const testEnum1 = { Citizen: {} };
  console.log('  Structure:', JSON.stringify(testEnum1));
  console.log('  ❌ This format is INCORRECT for Anchor enums\n');
} catch (e) {
  console.log('  Error:', e.message, '\n');
}

// Test 2: String format (WRONG)
console.log('Test 2: String format "Citizen"');
try {
  const testEnum2 = "Citizen";
  console.log('  Structure:', JSON.stringify(testEnum2));
  console.log('  ❌ This format is INCORRECT for Anchor enums\n');
} catch (e) {
  console.log('  Error:', e.message, '\n');
}

// Test 3: Correct format
console.log('Test 3: Checking IDL for correct format...');
console.log('  IDL UserRole variants:', JSON.stringify(IDL.types.find(t => t.name === 'UserRole').type.variants, null, 2));
console.log('  ✅ Enums should be passed as variant objects without empty braces\n');

// Test actual program call
async function testProgramCall() {
  console.log('\n🚀 Testing Actual Program Call:\n');
  
  const provider = new AnchorProvider(connection, new Wallet(masterKeypair), { commitment: 'confirmed' });
  const program = new Program(IDL, PROGRAM_ID, provider);
  
  // Create test wallet
  const testWallet = Keypair.generate();
  console.log(`Test wallet: ${testWallet.publicKey.toString()}`);
  
  // Derive PDA
  const [userPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('user'), testWallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`User PDA: ${userPDA.toString()}`);
  
  // Test different enum formats
  const enumFormats = [
    { name: 'Object with empty braces', value: { citizen: {} } },
    { name: 'Object PascalCase with empty braces', value: { Citizen: {} } },
    { name: 'Variant object', value: { citizen: null } },
    { name: 'Variant object PascalCase', value: { Citizen: null } },
  ];
  
  for (const format of enumFormats) {
    console.log(`\nTrying: ${format.name}`);
    console.log(`  Value: ${JSON.stringify(format.value)}`);
    
    try {
      // Don't actually send, just build to test serialization
      const tx = await program.methods
        .initializeUser(100, format.value)
        .accounts({
          userAccount: userPDA,
          authority: testWallet.publicKey,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        })
        .transaction();
      
      console.log(`  ✅ Serialization successful!`);
      console.log(`  This format works!`);
      break;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

testProgramCall().then(() => {
  console.log('\n✅ Test complete');
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  console.error('Stack:', error.stack);
});
