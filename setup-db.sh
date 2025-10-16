#!/bin/bash

# CivicChain Backend Database Setup Script
# This script helps set up PostgreSQL database with PostGIS for CivicChain

set -e

echo "🚀 CivicChain Database Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DB_NAME=${DB_NAME:-"civicchain"}
DB_USER=${DB_USER:-"civicchain_user"}
DB_PASSWORD=${DB_PASSWORD:-"civicchain_password"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

echo -e "${YELLOW}Configuration:${NC}"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Download from https://www.postgresql.org/download/"
    exit 1
fi

echo -e "${GREEN}✓${NC} PostgreSQL is installed"

# Check if PostGIS is available
if ! dpkg -l | grep -q postgis 2>/dev/null && ! brew list postgis &> /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC}  PostGIS may not be installed"
    echo "Install PostGIS:"
    echo "  Ubuntu/Debian: sudo apt-get install postgis"
    echo "  macOS: brew install postgis"
fi

echo ""
echo -e "${YELLOW}Creating database...${NC}"

# Create database and user
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo -e "${GREEN}✓${NC} Database created"

# Enable PostGIS extension
echo -e "${YELLOW}Enabling PostGIS extension...${NC}"
sudo -u postgres psql -d $DB_NAME << EOF
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();
EOF

echo -e "${GREEN}✓${NC} PostGIS extension enabled"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_WALLET_PRIVATE_KEY=[]

# Privy Configuration (if using)
PRIVY_APP_ID=
PRIVY_APP_SECRET=

# AI Service Configuration
AI_SERVICE_URL=http://localhost:8000

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001
EOF
    echo -e "${GREEN}✓${NC} .env file created with random JWT_SECRET"
else
    echo -e "${YELLOW}⚠${NC}  .env file already exists, skipping creation"
fi

echo ""
echo -e "${YELLOW}Running database migrations...${NC}"

# Run migrations
npm run migrate

echo ""
echo -e "${GREEN}✓${NC} Database setup completed successfully!"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review and update .env file with your configuration"
echo "  2. Add your Solana master wallet private key to .env"
echo "  3. Run 'npm run dev' to start the development server"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"
