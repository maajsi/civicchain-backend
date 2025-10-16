const db = require('../index');
const path = require('path');
const fs = require('fs');

async function runMigrations() {
  try {
    console.log('Starting database migrations...\n');
    
    // Get all migration files
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js') && file !== 'runMigrations.js')
      .sort();
    
    // Run each migration
    for (const file of files) {
      const migration = require(path.join(migrationsDir, file));
      await migration.up();
      console.log('');
    }
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
