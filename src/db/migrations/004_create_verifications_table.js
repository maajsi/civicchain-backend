const db = require('../index');

async function up() {
  console.log('Running migration: 004_create_verifications_table');
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS verifications (
      verification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
      verified_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, issue_id)
    );
  `);
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_issue ON verifications(issue_id);
  `);
  
  console.log('Migration completed: 004_create_verifications_table');
}

async function down() {
  console.log('Rolling back migration: 004_create_verifications_table');
  
  await db.query(`DROP TABLE IF EXISTS verifications;`);
  
  console.log('Rollback completed: 004_create_verifications_table');
}

module.exports = { up, down };
