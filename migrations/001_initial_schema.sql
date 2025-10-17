-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema with PostGIS

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create ENUM types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('citizen', 'government');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_category AS ENUM ('pothole', 'garbage', 'streetlight', 'water', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vote_type AS ENUM ('upvote', 'downvote');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(255) UNIQUE NOT NULL,
  private_key_encrypted TEXT,
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
  provider_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
-- Add unique index on provider_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_id_idx 
ON users(provider_id) 
WHERE provider_id IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Add comments
COMMENT ON COLUMN users.private_key_encrypted IS 'Encrypted Solana keypair private key (server-side storage)';
COMMENT ON COLUMN users.wallet_address IS 'Solana public address derived from keypair';
COMMENT ON COLUMN users.provider_id IS 'OAuth provider user ID (e.g., Google sub, Facebook ID)';

-- Create issues table
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

-- Create spatial index on location
CREATE INDEX IF NOT EXISTS issues_location_idx ON issues USING GIST(location);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues(status);

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS issues_category_idx ON issues(category);

-- Create index on priority_score for sorting
CREATE INDEX IF NOT EXISTS issues_priority_idx ON issues(priority_score DESC);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  vote_type vote_type NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, issue_id)
);

-- Create index on votes for querying
CREATE INDEX IF NOT EXISTS votes_issue_idx ON votes(issue_id);
CREATE INDEX IF NOT EXISTS votes_user_idx ON votes(user_id);

-- Create verifications table
CREATE TABLE IF NOT EXISTS verifications (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  verified_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, issue_id)
);

-- Create index on verifications for querying
CREATE INDEX IF NOT EXISTS verifications_issue_idx ON verifications(issue_id);
CREATE INDEX IF NOT EXISTS verifications_user_idx ON verifications(user_id);

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);
