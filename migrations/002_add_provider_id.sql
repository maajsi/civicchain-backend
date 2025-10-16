-- Migration: 002_add_provider_id.sql
-- Description: Add provider_id column to support OAuth provider IDs (Google, etc.)

-- Add provider_id column (nullable initially for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- Create unique index on provider_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_id_idx 
ON users(provider_id) 
WHERE provider_id IS NOT NULL;

-- Update existing users to have a provider_id based on privy_user_id if needed
-- This is safe because we're only setting NULL values
UPDATE users 
SET provider_id = privy_user_id 
WHERE provider_id IS NULL AND privy_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.provider_id IS 'OAuth provider user ID (e.g., Google sub, Facebook ID)';
