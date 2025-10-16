#!/bin/bash

# CivicChain Backend - Environment Check Script
# This script checks if all required dependencies and configurations are in place

echo "╔═══════════════════════════════════════════════╗"
echo "║   CivicChain Backend - Environment Check     ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
ALL_CHECKS_PASSED=true

# Function to print check results
check_requirement() {
    local name=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
    else
        echo -e "${RED}✗${NC} $name"
        ALL_CHECKS_PASSED=false
    fi
}

echo "Checking System Requirements..."
echo "─────────────────────────────────────────────────"

# Check Node.js
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js ($NODE_VERSION)"
else
    echo -e "${RED}✗${NC} Node.js (not found)"
    ALL_CHECKS_PASSED=false
fi

# Check npm
if command -v npm > /dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm ($NPM_VERSION)"
else
    echo -e "${RED}✗${NC} npm (not found)"
    ALL_CHECKS_PASSED=false
fi

# Check PostgreSQL
if command -v psql > /dev/null 2>&1; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}✓${NC} PostgreSQL ($PSQL_VERSION)"
else
    echo -e "${YELLOW}!${NC} PostgreSQL client (psql not found in PATH)"
fi

# Check Git
check_requirement "Git" "command -v git"

# Check Solana CLI (optional)
if command -v solana > /dev/null 2>&1; then
    SOLANA_VERSION=$(solana --version | head -n1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Solana CLI ($SOLANA_VERSION)"
else
    echo -e "${YELLOW}!${NC} Solana CLI (optional, not found)"
fi

echo ""
echo "Checking Project Setup..."
echo "─────────────────────────────────────────────────"

# Check if .env file exists
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check key environment variables
    if grep -q "DB_PASSWORD=" .env && ! grep -q "DB_PASSWORD=$" .env; then
        echo -e "${GREEN}✓${NC} Database password configured"
    else
        echo -e "${YELLOW}!${NC} Database password not set in .env"
    fi
    
    if grep -q "JWT_SECRET=" .env && ! grep -q "JWT_SECRET=.*change.*production" .env; then
        echo -e "${GREEN}✓${NC} JWT secret configured"
    else
        echo -e "${YELLOW}!${NC} JWT secret using default value (change in production!)"
    fi
    
    if grep -q "MASTER_WALLET_PRIVATE_KEY=" .env && ! grep -q "MASTER_WALLET_PRIVATE_KEY=$" .env; then
        echo -e "${GREEN}✓${NC} Solana master wallet configured"
    else
        echo -e "${YELLOW}!${NC} Solana master wallet not configured (wallet funding won't work)"
    fi
else
    echo -e "${RED}✗${NC} .env file not found (copy from .env.example)"
    ALL_CHECKS_PASSED=false
fi

# Check if node_modules exists
if [ -d node_modules ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed (node_modules exists)"
else
    echo -e "${RED}✗${NC} Dependencies not installed (run: npm install)"
    ALL_CHECKS_PASSED=false
fi

# Check if uploads directory exists
if [ -d uploads ]; then
    echo -e "${GREEN}✓${NC} Uploads directory exists"
else
    echo -e "${YELLOW}!${NC} Uploads directory missing (will be created automatically)"
fi

echo ""
echo "Checking Database Connection..."
echo "─────────────────────────────────────────────────"

if [ -f .env ]; then
    # Source environment variables
    export $(grep -v '^#' .env | xargs)
    
    # Try to connect to database
    if command -v psql > /dev/null 2>&1; then
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Database connection successful"
            
            # Check if PostGIS is installed
            if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT PostGIS_version();" > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} PostGIS extension installed"
            else
                echo -e "${RED}✗${NC} PostGIS extension not installed"
                echo "    Run: CREATE EXTENSION IF NOT EXISTS postgis;"
                ALL_CHECKS_PASSED=false
            fi
            
            # Check if tables exist (migrations run)
            if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM users LIMIT 1;" > /dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} Database migrations completed"
            else
                echo -e "${YELLOW}!${NC} Database tables not found (run: npm run migrate)"
            fi
        else
            echo -e "${RED}✗${NC} Cannot connect to database"
            echo "    Check your database credentials in .env"
            ALL_CHECKS_PASSED=false
        fi
    else
        echo -e "${YELLOW}!${NC} Cannot test database connection (psql not available)"
    fi
else
    echo -e "${RED}✗${NC} Cannot check database (.env file missing)"
fi

echo ""
echo "═══════════════════════════════════════════════════"

if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "You can now start the server with:"
    echo "  npm start        (production mode)"
    echo "  npm run dev      (development mode with auto-reload)"
    echo ""
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above.${NC}"
    echo ""
    echo "Setup instructions:"
    echo "  1. Install missing dependencies"
    echo "  2. Copy .env.example to .env and configure"
    echo "  3. Run: npm install"
    echo "  4. Set up PostgreSQL database"
    echo "  5. Run: npm run migrate"
    echo ""
    echo "See SETUP.md for detailed instructions."
    exit 1
fi
