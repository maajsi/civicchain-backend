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

    // First, ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Schema migrations table ready');

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found, skipping migrations');
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`Found ${migrationFiles.length} migration file(s)`);

    // Get already applied migrations
    const appliedResult = await client.query('SELECT version FROM schema_migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.version));

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      if (appliedMigrations.has(version)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`📝 Running migration: ${file}`);
      
      try {
        // Start a transaction for this migration
        await client.query('BEGIN');
        
        // Read and execute migration
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query(migrationSQL);
        
        // Record the migration as applied
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        
        // Commit the transaction
        await client.query('COMMIT');
        console.log(`✅ Successfully applied: ${file}`);
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`, error.message);
        throw error;
      }
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
      console.log('✓ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Migration script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };
