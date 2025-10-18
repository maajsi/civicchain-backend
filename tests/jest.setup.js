// Test setup: ensure MASTER_WALLET_PRIVATE_KEY exists for services that import it
const { Keypair } = require('@solana/web3.js');
const kp = Keypair.generate();
process.env.MASTER_WALLET_PRIVATE_KEY = JSON.stringify(Array.from(kp.secretKey));

// Make tests quieter
process.env.DOTENV_QUIET = 'true';
