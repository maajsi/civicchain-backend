const db = require('../index');

async function up() {
  console.log('Running migration: 002_create_issues_table');
  
  await db.query(`
    DO $$ BEGIN
      CREATE TYPE issue_category AS ENUM ('pothole', 'garbage', 'streetlight', 'water', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.query(`
    DO $$ BEGIN
      CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS issues (
      issue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_reporter ON issues(reporter_user_id);
    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
    CREATE INDEX IF NOT EXISTS idx_issues_priority_score ON issues(priority_score DESC);
    CREATE INDEX IF NOT EXISTS idx_issues_location ON issues USING GIST(location);
    CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
  `);
  
  console.log('Migration completed: 002_create_issues_table');
}

async function down() {
  console.log('Rolling back migration: 002_create_issues_table');
  
  await db.query(`DROP TABLE IF EXISTS issues;`);
  await db.query(`DROP TYPE IF EXISTS issue_category;`);
  await db.query(`DROP TYPE IF EXISTS issue_status;`);
  
  console.log('Rollback completed: 002_create_issues_table');
}

module.exports = { up, down };
