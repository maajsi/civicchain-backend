const pool = require('../config/database');

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');

    // Enable PostGIS extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
    `);
    console.log('✅ PostGIS extension enabled');

    // Create ENUM types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('citizen', 'government');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE issue_category AS ENUM ('pothole', 'garbage', 'streetlight', 'water', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ ENUM types created');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        privy_user_id VARCHAR(255) UNIQUE,
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
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Users table created');

    // Create issues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        wallet_address VARCHAR(255) NOT NULL,
        image_url TEXT NOT NULL,
        description TEXT NOT NULL,
        category issue_category NOT NULL,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        region VARCHAR(255),
        status issue_status NOT NULL DEFAULT 'open',
        priority_score FLOAT NOT NULL DEFAULT 0,
        blockchain_tx_hash VARCHAR(255),
        upvotes INTEGER NOT NULL DEFAULT 0,
        downvotes INTEGER NOT NULL DEFAULT 0,
        admin_proof_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Issues table created');

    // Create index on location for proximity queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS issues_location_idx ON issues USING GIST(location);
    `);
    console.log('✅ Location index created');

    // Create votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
        vote_type vote_type NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, issue_id)
      );
    `);
    console.log('✅ Votes table created');

    // Create verifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
        verified_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, issue_id)
      );
    `);
    console.log('✅ Verifications table created');

    console.log('🎉 Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('Migration complete. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createTables };
