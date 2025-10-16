const db = require('../index');

async function up() {
  console.log('Running migration: 003_create_votes_table');
  
  await db.query(`
    DO $$ BEGIN
      CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS votes (
      vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
      vote_type vote_type NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, issue_id)
    );
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
    CREATE INDEX IF NOT EXISTS idx_votes_issue ON votes(issue_id);
  `);
  
  console.log('Migration completed: 003_create_votes_table');
}

async function down() {
  console.log('Rolling back migration: 003_create_votes_table');
  
  await db.query(`DROP TABLE IF EXISTS votes;`);
  await db.query(`DROP TYPE IF EXISTS vote_type;`);
  
  console.log('Rollback completed: 003_create_votes_table');
}

module.exports = { up, down };
