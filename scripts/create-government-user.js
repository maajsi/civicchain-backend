const dotenv = require('dotenv');
dotenv.config();
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const pool = require('../src/config/database');
const { fundWallet, createUserOnChain } = require('../src/services/solanaService');
const { v4: uuidv4 } = require('uuid');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [k, v] = arg.replace(/^--/, '').split('=');
      args[k] = v === undefined ? true : v;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const email = args.email || args.e;
  const name = args.name || 'Government Official';
  const profilePic = args.profile_pic || args.profilePic || null;
  const providerId = args.provider_id || args.providerId || null;
  const rep = args.rep ? parseInt(String(args.rep), 10) : 100;
  const fund = args.fund === undefined ? true : String(args.fund).toLowerCase() !== 'false';
  const skipOnchain = String(args.skip_onchain || args.skipOnchain || 'false').toLowerCase() === 'true';
  if (!email) {
    console.error('Missing --email');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let userRes = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userRes.rows[0];
    if (!user) {
      const keypair = Keypair.generate();
      const walletAddress = keypair.publicKey.toBase58();
      const privateKey = bs58.encode(keypair.secretKey);
      const userId = uuidv4();
      const inserted = await client.query(
        `INSERT INTO users (user_id, email, name, profile_pic, wallet_address, role, rep, private_key, provider_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [userId, email, name, profilePic, walletAddress, 'government', rep, privateKey, providerId]
      );
      user = inserted.rows[0];
      console.log(JSON.stringify({ created: true, user_id: user.user_id, wallet_address: user.wallet_address }));
    } else {
      let walletAddress = user.wallet_address;
      let privateKey = user.private_key;
      if (!walletAddress || !privateKey) {
        const keypair = Keypair.generate();
        walletAddress = keypair.publicKey.toBase58();
        privateKey = bs58.encode(keypair.secretKey);
      }
      const updated = await client.query(
        `UPDATE users SET role = 'government', name = COALESCE($1,name), profile_pic = COALESCE($2,profile_pic), wallet_address = $3, private_key = $4, provider_id = COALESCE($5,provider_id)
         WHERE user_id = $6 RETURNING *`,
        [name || null, profilePic, walletAddress, privateKey, providerId, user.user_id]
      );
      user = updated.rows[0];
      console.log(JSON.stringify({ created: false, user_id: user.user_id, wallet_address: user.wallet_address }));
    }
    await client.query('COMMIT');
    if (fund) {
      try {
        await fundWallet(user.wallet_address, 0.05);
      } catch (e) {
        console.warn('fundWallet failed:', e.message);
      }
    }
    if (!skipOnchain) {
      try {
        const roleEnum = { government: {} };
        const tx = await createUserOnChain(user.wallet_address, rep, roleEnum, user.private_key);
        if (tx) console.log(JSON.stringify({ onchain_initialized: true, tx }));
      } catch (e) {
        console.warn('createUserOnChain failed:', e.message);
      }
    }
    console.log(JSON.stringify({ success: true, user: { user_id: user.user_id, email: user.email, wallet_address: user.wallet_address, role: user.role, rep: user.rep } }));
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
