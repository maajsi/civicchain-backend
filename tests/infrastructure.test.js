// Test database configuration and migrations
const fs = require('fs');
const path = require('path');

describe('Database Configuration', () => {
  test('should have migration file', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  test('migration should contain required tables', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS issues');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS votes');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS verifications');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
  });

  test('migration should enable PostGIS extension', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    expect(migrationContent).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
  });

  test('migration should create spatial index', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS issues_location_idx');
    expect(migrationContent).toContain('USING GIST(location)');
  });

  test('migration should create ENUM types', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    expect(migrationContent).toContain('user_role');
    expect(migrationContent).toContain('issue_category');
    expect(migrationContent).toContain('issue_status');
    expect(migrationContent).toContain('vote_type');
  });

  test('migration should create proper indexes', () => {
    const migrationPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS issues_status_idx');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS issues_category_idx');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS issues_priority_idx');
    expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS users_wallet_address');
  });
});

describe('Smart Contract', () => {
  test('should have Solana contract file', () => {
    const contractPath = path.join(__dirname, '../solana-contract/programs/civicchain/src/lib.rs');
    expect(fs.existsSync(contractPath)).toBe(true);
  });

  test('should have IDL file', () => {
    const idlPath = path.join(__dirname, '../solana-contract/target/idl/idl.json');
    expect(fs.existsSync(idlPath)).toBe(true);
  });

  test('should have Anchor.toml configuration', () => {
    const anchorTomlPath = path.join(__dirname, '../solana-contract/Anchor.toml');
    expect(fs.existsSync(anchorTomlPath)).toBe(true);
  });

  test('should have Cargo.toml for the program', () => {
    const cargoTomlPath = path.join(__dirname, '../solana-contract/programs/civicchain/Cargo.toml');
    expect(fs.existsSync(cargoTomlPath)).toBe(true);
  });

  test('contract should contain required instructions', () => {
    const contractPath = path.join(__dirname, '../solana-contract/programs/civicchain/src/lib.rs');
    const contractContent = fs.readFileSync(contractPath, 'utf8');
    
    expect(contractContent).toContain('initialize_user');
    expect(contractContent).toContain('create_issue');
    expect(contractContent).toContain('record_vote');
    expect(contractContent).toContain('record_verification');
    expect(contractContent).toContain('update_issue_status');
    expect(contractContent).toContain('update_reputation');
  });

  test('contract should have account structures', () => {
    const contractPath = path.join(__dirname, '../solana-contract/programs/civicchain/src/lib.rs');
    const contractContent = fs.readFileSync(contractPath, 'utf8');
    
    expect(contractContent).toContain('UserAccount');
    expect(contractContent).toContain('IssueAccount');
  });
});

describe('Docker Configuration', () => {
  test('should have docker-compose.yml', () => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  test('docker-compose should define required services', () => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    
    expect(dockerComposeContent).toContain('db:');
    expect(dockerComposeContent).toContain('ai-service:');
    expect(dockerComposeContent).toContain('backend:');
    expect(dockerComposeContent).toContain('postgis/postgis:15-3.3');
    expect(dockerComposeContent).toContain('roboflow/roboflow-inference-server-cpu:latest');
  });

  test('docker-compose should have proper networking', () => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    
    expect(dockerComposeContent).toContain('civicchain-network');
    expect(dockerComposeContent).toContain('networks:');
    expect(dockerComposeContent).toContain('driver: bridge');
  });

  test('docker-compose should have health checks', () => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    
    expect(dockerComposeContent).toContain('healthcheck:');
    expect(dockerComposeContent).toContain('pg_isready');
  });

  test('should have Dockerfile', () => {
    const dockerfilePath = path.join(__dirname, '../Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
  });

  test('should have proper environment configuration', () => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    
    expect(dockerComposeContent).toContain('env_file:');
    expect(dockerComposeContent).toContain('.env');
    expect(dockerComposeContent).toContain('POSTGRES_DB: civicchain');
  });
});
