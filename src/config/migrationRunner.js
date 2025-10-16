const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migrations...');

    // Create schema_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Ensured schema_migrations table exists');

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration file(s)`);

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      // Check if migration has already been applied
      const checkQuery = 'SELECT version FROM schema_migrations WHERE version = $1';
      const result = await client.query(checkQuery, [version]);
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`📝 Running migration: ${file}`);
      
      // Read and execute migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await client.query(migrationSQL);
      
      // Record the migration as applied
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      
      console.log(`✅ Successfully applied: ${file}`);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };
