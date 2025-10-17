-- Migration: 003_add_privy_wallet_id.sql
-- Description: Add privy_wallet_id column to users table to store Privy wallet ID

ALTER TABLE users ADD COLUMN IF NOT EXISTS privy_wallet_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS users_privy_wallet_id_idx ON users(privy_wallet_id);
