-- Migration: Remove Privy fields and add server-side private key storage
-- Date: 2025-10-17
-- Description: Remove Privy integration, store keypairs server-side

-- Remove Privy-related columns
ALTER TABLE users DROP COLUMN IF EXISTS privy_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS privy_wallet_id;

-- Add encrypted private key storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS private_key_encrypted TEXT;

-- Ensure wallet_address is NOT NULL and UNIQUE
ALTER TABLE users ALTER COLUMN wallet_address SET NOT NULL;
ALTER TABLE users ALTER COLUMN wallet_address SET DEFAULT '';

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_wallet_address_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_wallet_address_key UNIQUE (wallet_address);
    END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Add comments
COMMENT ON COLUMN users.private_key_encrypted IS 'Encrypted Solana keypair private key (server-side storage)';
COMMENT ON COLUMN users.wallet_address IS 'Solana public address derived from keypair';

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
