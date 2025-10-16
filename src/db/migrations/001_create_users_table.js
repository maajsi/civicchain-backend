const db = require('../index');

async function up() {
  console.log('Running migration: 001_create_users_table');
  
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "postgis";
  `);
  
  await db.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('citizen', 'government');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      privy_user_id VARCHAR(255) UNIQUE NOT NULL,
      wallet_address VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      profile_pic TEXT,
      role user_role NOT NULL DEFAULT 'citizen',
      rep INTEGER NOT NULL DEFAULT 100,
      issues_reported INTEGER NOT NULL DEFAULT 0,
      issues_resolved INTEGER NOT NULL DEFAULT 0,
      total_upvotes INTEGER NOT NULL DEFAULT 0,
      verifications_done INTEGER NOT NULL DEFAULT 0,
      badges TEXT[] DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
  `);
  
  console.log('Migration completed: 001_create_users_table');
}

async function down() {
  console.log('Rolling back migration: 001_create_users_table');
  
  await db.query(`DROP TABLE IF EXISTS users;`);
  await db.query(`DROP TYPE IF EXISTS user_role;`);
  
  console.log('Rollback completed: 001_create_users_table');
}

module.exports = { up, down };
