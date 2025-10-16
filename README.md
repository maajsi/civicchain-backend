# CivicChain Backend API

AI-powered, blockchain-backed civic issue management platform with transparent, trust-based governance.

## Features

- **User Authentication**: Google OAuth integration with JWT tokens
- **Issue Management**: Report, classify, and track civic issues
- **Blockchain Integration**: Solana smart contract for transparent auditability
- **Reputation System**: Community-driven reputation scoring
- **Geographic Queries**: PostGIS-powered location-based filtering
- **AI Classification**: Automatic issue categorization
- **Voting & Verification**: Community validation of issues
- **Admin Dashboard**: Government user analytics and heatmaps

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL with PostGIS extension
- **Blockchain**: Solana (Devnet)
- **Authentication**: JWT + Google OAuth
- **File Storage**: Local filesystem with Express static

## Prerequisites

- Node.js v16+
- PostgreSQL 14+ with PostGIS extension
- Solana CLI tools (for smart contract deployment)
- Master wallet with devnet SOL for user funding

## Installation

1. Clone the repository:
```bash
git clone https://github.com/maajsi/civicchain-backend.git
cd civicchain-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up PostgreSQL database:
```sql
CREATE DATABASE civicchain;
\c civicchain
CREATE EXTENSION postgis;
```

5. Run database migrations:
```bash
npm run migrate
```

6. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server will run on `http://localhost:3000` by default.

## Environment Variables

See `.env.example` for all required environment variables:
- Database connection settings
- JWT secret
- Solana RPC URL and master wallet private key
- AI service URL
- Port configuration

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints (except `/auth/login`) require JWT authentication:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth
- `POST /api/auth/login` - Google OAuth login

#### User
- `GET /api/user/me` - Get current user profile
- `GET /api/user/:user_id` - Get user by ID

#### Issues
- `POST /api/issue/classify` - Upload and classify image
- `POST /api/issue/report` - Submit issue report
- `GET /api/issues` - List issues with filters
- `GET /api/issue/:id` - Get issue details
- `POST /api/issue/:id/upvote` - Upvote an issue
- `POST /api/issue/:id/downvote` - Downvote an issue
- `POST /api/issue/:id/verify` - Verify resolved issue
- `POST /api/issue/:id/update-status` - Update issue status (admin only)

#### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/issues` - Get all issues with filters

For detailed API documentation, see the issue description in GitHub.

## Database Schema

### Tables
- `users` - User profiles and reputation
- `issues` - Civic issue reports
- `votes` - User votes on issues
- `verifications` - Issue verifications by citizens

See the issue description for complete schema details.

## Priority Score Algorithm

Priority score is calculated based on:
- Location density (issues in 100m radius)
- Reporter reputation
- Upvote reputation sum
- Category urgency (pothole=8, water=9, etc.)
- Time factor (days since creation)

Maximum score: 100

## Reputation System

| Action | Reporter Change | Voter/Verifier Change |
|--------|----------------|----------------------|
| Upvote received | +5 | 0 |
| Downvote received | -3 | 0 |
| Issue verified resolved | +10 | +5 |
| Issue marked spam/fake | -20 | 0 |

## Smart Contract

The Solana smart contract handles:
- User account initialization
- Issue creation on-chain
- Reputation updates
- Issue status updates

Contract source code: (TBD - to be deployed separately)

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## License

MIT

## Contributing

Please read the project specification in the GitHub issue for implementation guidelines.
