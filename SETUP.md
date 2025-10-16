# CivicChain Backend - Development Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v16 or higher
- **npm** or **yarn**
- **PostgreSQL** 14+ with **PostGIS** extension
- **Git**

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/maajsi/civicchain-backend.git
cd civicchain-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL Database

#### Option A: Using psql command line

```bash
# Login to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE civicchain;

# Connect to the database
\c civicchain

# Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

# Exit psql
\q
```

#### Option B: Using GUI tools (pgAdmin, DBeaver, etc.)

1. Create a new database named `civicchain`
2. Run this SQL command on the database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

### 4. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

**Important environment variables to configure:**

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=civicchain
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT
JWT_SECRET=your_secure_random_secret_here

# Solana (for development, leave as devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
# MASTER_WALLET_PRIVATE_KEY will be set up in step 6
```

### 5. Run Database Migrations

```bash
npm run migrate
```

You should see output like:
```
Running migration: 001_create_users_table
Migration completed: 001_create_users_table
...
All migrations completed successfully!
```

### 6. Set Up Solana Master Wallet (Optional but Recommended)

For testing wallet funding functionality:

1. **Install Solana CLI tools** (if not already installed):
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Generate a new keypair for the master wallet:**
   ```bash
   solana-keygen new --outfile master-wallet.json
   ```

3. **Set Solana to devnet:**
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

4. **Request airdrop for testing:**
   ```bash
   solana airdrop 2 master-wallet.json
   ```

5. **Convert the keypair to array format:**
   ```bash
   # Read the keypair file and format it
   cat master-wallet.json
   ```
   
   Copy the array (should be 64 numbers in brackets) and add it to your `.env`:
   ```env
   MASTER_WALLET_PRIVATE_KEY=[1,2,3,...,64]
   ```

**Security Note:** Never commit `master-wallet.json` or expose your private key in production!

### 7. Start the Development Server

```bash
# Start with auto-reload (recommended for development)
npm run dev

# Or start normally
npm start
```

You should see:
```
  ╔═══════════════════════════════════════════════╗
  ║     CivicChain Backend API Server            ║
  ╠═══════════════════════════════════════════════╣
  ║  Status: Running                              ║
  ║  Port: 3000                                   ║
  ║  Environment: development                     ║
  ║  Base URL: http://localhost:3000             ║
  ╚═══════════════════════════════════════════════╝
```

### 8. Verify Installation

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "CivicChain Backend API is running",
  "version": "1.0.0",
  "timestamp": "2024-..."
}
```

### 9. Create Test Users

#### Create a Citizen User:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen@test.com",
    "name": "Test Citizen",
    "profile_pic": ""
  }'
```

Save the `jwt_token` from the response!

#### Create a Government User:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gov.test.com",
    "name": "Government Admin",
    "profile_pic": ""
  }'
```

Then manually update the role in the database:
```sql
UPDATE users SET role = 'government' WHERE email = 'admin@gov.test.com';
```

### 10. Test API Endpoints

See `API_TESTING.md` for comprehensive testing examples.

Quick test:
```bash
# Get your user profile (replace TOKEN with your JWT)
curl -X GET http://localhost:3000/api/user/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Common Issues and Solutions

### Issue: "Connection refused" when connecting to PostgreSQL

**Solution:**
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Start PostgreSQL: `sudo systemctl start postgresql`
- Verify connection settings in `.env`

### Issue: "PostGIS extension not found"

**Solution:**
```bash
# Install PostGIS (Ubuntu/Debian)
sudo apt-get install postgresql-14-postgis-3

# Then enable in your database
psql -U postgres -d civicchain -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Issue: "Migration failed"

**Solution:**
- Drop and recreate the database:
  ```sql
  DROP DATABASE IF EXISTS civicchain;
  CREATE DATABASE civicchain;
  \c civicchain
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```
- Run migrations again: `npm run migrate`

### Issue: "Cannot find module" errors

**Solution:**
- Delete `node_modules` and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### Issue: Solana wallet funding not working

**Solution:**
- Ensure you've added the master wallet private key to `.env`
- Verify the wallet has funds on devnet:
  ```bash
  solana balance master-wallet.json
  ```
- Request airdrop if needed:
  ```bash
  solana airdrop 2 master-wallet.json
  ```

## Project Structure

```
civicchain-backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── db/              # Database connection and migrations
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── uploads/             # Uploaded images directory
├── .env                 # Environment variables (create from .env.example)
├── .env.example         # Example environment variables
├── .gitignore          # Git ignore rules
├── package.json        # Node.js dependencies
└── README.md           # Project documentation
```

## Development Workflow

1. **Make changes** to code
2. Server auto-reloads (if using `npm run dev`)
3. **Test endpoints** using curl or Postman
4. **Check logs** for errors
5. **Commit changes** when ready

## Next Steps

- Read `API_TESTING.md` for API endpoint examples
- Set up the frontend application
- Deploy the Solana smart contract
- Configure the AI service for image classification

## Getting Help

- Check the GitHub Issues for common problems
- Review the API documentation in README.md
- Refer to the technical specification in the GitHub issue

## Production Deployment

For production deployment:

1. Use a production PostgreSQL database
2. Set `NODE_ENV=production` in `.env`
3. Use a strong `JWT_SECRET`
4. Configure proper CORS settings
5. Set up HTTPS
6. Use a process manager like PM2
7. Configure proper logging
8. Set up database backups
9. Use Solana mainnet instead of devnet
10. Implement rate limiting and security best practices

See deployment documentation (to be created) for detailed production setup instructions.
