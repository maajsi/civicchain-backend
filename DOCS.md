# CivicChain Backend - Complete Documentation

## Table of Contents
1. [Quick Start](#quick-start)
2. [API Reference](#api-reference)
3. [Database Schema](#database-schema)
4. [Smart Contract](#smart-contract)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Development Guide](#development-guide)

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ with PostGIS
- Docker and Docker Compose (recommended)

### Using Docker (Recommended)
```bash
# Clone repository
git clone https://github.com/maajsi/civicchain-backend.git
cd civicchain-backend

# Configure environment
cp .env.example .env
# Edit .env with your configurations

# Start all services
docker-compose up -d

# Services will be available at:
# - Backend API: http://localhost:3000
# - Database: localhost:5432
# - AI Service: http://localhost:9001
```

### Manual Setup
```bash
# Install dependencies
npm install

# Setup database
./setup-db.sh
# Or manually: createdb civicchain && psql civicchain < migrations/001_initial_schema.sql

# Run migrations
npm run migrate

# Start Roboflow AI service (in separate terminal)
docker run -p 9001:9001 roboflow/roboflow-inference-server-cpu:latest

# Start backend
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

---

## API Reference

### Base URL
```
http://localhost:3000
```

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### 1. Authentication

**POST /auth/login**
- Description: Verify JWT from NextAuth, create or retrieve user
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- Response:
```json
{
  "success": true,
  "is_new": false,
  "user": {
    "user_id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "wallet_address": "7xKXtg2...",
    "role": "citizen",
    "rep": 100,
    "badges": []
  }
}
```

#### 2. User Endpoints

**GET /user/me**
- Description: Get current user profile
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "user": { /* user object */ }
}
```

**GET /user/:user_id**
- Description: Get public user profile
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "user": { /* user object */ }
}
```

#### 3. Issue Endpoints

**POST /issue/classify**
- Description: Upload image and get AI classification
- Headers: `Authorization: Bearer <jwt_token>`, `Content-Type: multipart/form-data`
- Body: `image: [binary file]`
- Response:
```json
{
  "success": true,
  "suggested_category": "pothole",
  "urgency_score": 8,
  "image_url": "/uploads/filename.jpg"
}
```

**POST /issue/report**
- Description: Submit new issue (triggers blockchain transaction)
- Headers: `Authorization: Bearer <jwt_token>`, `Content-Type: application/json`
- Body:
```json
{
  "image_url": "/uploads/filename.jpg",
  "description": "Large pothole on main street",
  "category": "pothole",
  "lat": 17.38,
  "lng": 78.48,
  "region": "Hyderabad"
}
```
- Response:
```json
{
  "success": true,
  "issue": {
    "issue_id": "uuid",
    "category": "pothole",
    "status": "open",
    "priority_score": 45.5,
    "blockchain_tx_hash": "..."
  }
}
```

**GET /issues**
- Description: List issues with filters
- Headers: `Authorization: Bearer <jwt_token>`
- Query Parameters:
  - `lat` (required): Latitude
  - `lng` (required): Longitude
  - `radius` (optional): Search radius in meters (default: 5000)
  - `category` (optional): Filter by category
  - `status` (optional): Filter by status
- Response:
```json
{
  "success": true,
  "count": 10,
  "issues": [ /* array of issues */ ]
}
```

**GET /issue/:id**
- Description: Get detailed issue information
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "issue": { /* issue object */ }
}
```

**POST /issue/:id/upvote**
- Description: Upvote an issue
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "message": "Issue upvoted successfully",
  "issue": { /* updated issue */ },
  "reporter_rep_change": 5,
  "blockchain_tx_hash": "..."
}
```

**POST /issue/:id/downvote**
- Description: Downvote an issue
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "message": "Issue downvoted successfully",
  "issue": { /* updated issue */ },
  "reporter_rep_change": -3,
  "blockchain_tx_hash": "..."
}
```

**POST /issue/:id/verify**
- Description: Verify resolved issue (citizens only)
- Headers: `Authorization: Bearer <jwt_token>`, `Content-Type: application/json`
- Body: `{ "verified": true }`
- Response:
```json
{
  "success": true,
  "message": "Issue verified successfully",
  "issue": { /* updated issue */ },
  "rep_rewards": {
    "reporter_change": 10,
    "verifier_change": 5
  },
  "blockchain_tx_hash": "..."
}
```

**POST /issue/:id/update-status**
- Description: Update issue status (government only)
- Headers: `Authorization: Bearer <jwt_token>`, `Content-Type: multipart/form-data`
- Body: `status`, `proof_image` (optional)
- Response:
```json
{
  "success": true,
  "message": "Issue status updated successfully",
  "issue": { /* updated issue */ },
  "blockchain_tx_hash": "..."
}
```

#### 4. Admin Endpoints

**GET /admin/dashboard**
- Description: Get dashboard statistics (government only)
- Headers: `Authorization: Bearer <jwt_token>`
- Response:
```json
{
  "success": true,
  "stats": {
    "total_issues": 150,
    "open_issues": 45,
    "resolved_issues": 100,
    "total_users": 500
  },
  "heatmap_data": [ /* array of location data */ ],
  "top_priority_issues": [ /* top 10 issues */ ]
}
```

**GET /admin/issues**
- Description: Get all issues with advanced filters (government only)
- Headers: `Authorization: Bearer <jwt_token>`
- Query Parameters:
  - `status`, `category`, `date_from`, `date_to`, `sort_by`, `page`, `limit`
- Response:
```json
{
  "success": true,
  "pagination": { /* pagination info */ },
  "issues": [ /* array of issues */ ]
}
```

---

## Database Schema

### Tables

#### users
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| user_id | UUID | PRIMARY KEY | |
| privy_user_id | VARCHAR(255) | UNIQUE, NOT NULL | |
| wallet_address | VARCHAR(255) | UNIQUE, NOT NULL | |
| email | VARCHAR(255) | UNIQUE, NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| profile_pic | TEXT | | |
| role | ENUM | NOT NULL | citizen, government |
| rep | INT | DEFAULT 100 | |
| issues_reported | INT | DEFAULT 0 | |
| issues_resolved | INT | DEFAULT 0 | |
| total_upvotes | INT | DEFAULT 0 | |
| verifications_done | INT | DEFAULT 0 | |
| badges | TEXT[] | DEFAULT '{}' | |
| created_at | TIMESTAMP | DEFAULT NOW() | |

#### issues
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| issue_id | UUID | PRIMARY KEY | |
| reporter_user_id | UUID | FOREIGN KEY | References users(user_id) |
| wallet_address | VARCHAR(255) | NOT NULL | |
| image_url | TEXT | NOT NULL | |
| description | TEXT | NOT NULL | |
| category | ENUM | NOT NULL | pothole, garbage, streetlight, water, other |
| location | GEOGRAPHY | NOT NULL | PostGIS point |
| region | VARCHAR(255) | | |
| status | ENUM | DEFAULT 'open' | open, in_progress, resolved, closed |
| priority_score | FLOAT | DEFAULT 0 | |
| blockchain_tx_hash | VARCHAR(255) | | |
| upvotes | INT | DEFAULT 0 | |
| downvotes | INT | DEFAULT 0 | |
| admin_proof_url | TEXT | | |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### votes
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| vote_id | UUID | PRIMARY KEY | |
| user_id | UUID | FOREIGN KEY | References users(user_id) |
| issue_id | UUID | FOREIGN KEY | References issues(issue_id) |
| vote_type | ENUM | NOT NULL | upvote, downvote |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| UNIQUE(user_id, issue_id) | | | |

#### verifications
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| verification_id | UUID | PRIMARY KEY | |
| user_id | UUID | FOREIGN KEY | References users(user_id) |
| issue_id | UUID | FOREIGN KEY | References issues(issue_id) |
| verified_at | TIMESTAMP | DEFAULT NOW() | |
| UNIQUE(user_id, issue_id) | | | |

### Indexes
- `issues_location_idx` (GIST on location)
- `issues_status_idx` (on status)
- `issues_category_idx` (on category)
- `issues_priority_idx` (on priority_score DESC)
- `votes_issue_idx` (on issue_id)
- `votes_user_idx` (on user_id)
- `verifications_issue_idx` (on issue_id)
- `verifications_user_idx` (on user_id)

---

## Smart Contract

### Solana Smart Contract (Anchor)

Location: `solana-contract/programs/civicchain/src/lib.rs`

#### Instructions

1. **initialize_user** - Create user account
2. **create_issue** - Record issue on-chain
3. **record_vote** - Track votes
4. **record_verification** - Record verifications
5. **update_issue_status** - Update status (government only)
6. **update_reputation** - Update user reputation

#### Deployment

```bash
cd solana-contract

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0
avm use 0.29.0

# Configure Solana
solana config set --url devnet
solana airdrop 2

# Build and deploy
anchor build
anchor deploy

# Update .env with program ID
SOLANA_PROGRAM_ID=<your_program_id>
```

See `solana-contract/README.md` for detailed instructions.

---

## Testing

### Test Structure

```
tests/
├── auth.test.js           # Authentication tests
├── issues.test.js         # Issue management tests
├── votes.test.js          # Voting tests
└── users.test.js          # User profile tests
```

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run specific test file
npx jest tests/auth.test.js

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

### Test Coverage

Target coverage: 70%+ for all metrics (branches, functions, lines, statements)

### Writing Tests

Example test structure:

```javascript
describe('Endpoint Name', () => {
  it('should handle valid request', async () => {
    const response = await request(app)
      .post('/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'value' })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should handle error case', async () => {
    const response = await request(app)
      .post('/endpoint')
      .send({ invalid: 'data' })
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});
```

---

## Deployment

### Docker Compose (Recommended)

```bash
# Production deployment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Services
1. **PostgreSQL + PostGIS** - Port 5432
2. **Roboflow AI Service** - Port 9001
3. **Backend API** - Port 3000

### Manual Deployment

#### Heroku
```bash
heroku create civicchain-backend
heroku addons:create heroku-postgresql:hobby-dev
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-apt
echo "postgis" > Aptfile
git push heroku main
```

#### Railway
```bash
railway init
railway add --plugin postgresql
railway up
```

#### DigitalOcean
Use App Platform with:
- Database: Managed PostgreSQL with PostGIS
- App: Node.js app from GitHub
- Environment variables from .env.example

#### AWS EC2
```bash
# Install Node.js, PostgreSQL, PostGIS
# Clone repository
# Configure .env
# Setup Nginx reverse proxy
# Use PM2 for process management
pm2 start src/server.js --name civicchain
pm2 save
pm2 startup
```

---

## Development Guide

### Environment Variables

Required variables (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/civicchain

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Solana
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=
MASTER_WALLET_PRIVATE_KEY=[]

# AI Service
AI_SERVICE_URL=http://localhost:9001
ROBOFLOW_ENDPOINT=/civic-issue-yljwt/2

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png

# CORS
FRONTEND_URL=http://localhost:3001
```

### Project Structure

```
civicchain-backend/
├── src/
│   ├── config/          # Database, migrations
│   ├── controllers/     # Business logic
│   ├── middleware/      # Authentication
│   ├── routes/          # API routes
│   ├── services/        # AI & Solana services
│   ├── utils/           # Helper functions
│   └── server.js        # Entry point
├── tests/               # Test files
├── migrations/          # Database migrations
├── solana-contract/     # Smart contract
├── uploads/             # Image storage
└── docker-compose.yml   # Container orchestration
```

### Code Standards

- Use ESLint for linting
- Follow async/await pattern
- Use try-catch for error handling
- Add JSDoc comments for functions
- Use parameterized queries for database
- Return consistent JSON responses

### Priority Scoring Formula

```
Priority = (2.5 × Location Density) + 
           (2.0 × Reporter Rep) + 
           (2.0 × Upvote Rep Sum) + 
           (2.5 × Category Urgency) + 
           (1.0 × Time Factor)

Max Score: 100
```

### Reputation System

- Upvote received: +5
- Downvote received: -3
- Issue verified: +10 (reporter), +5 (verifier)
- Minimum: 0 (no negative)

### Badge Criteria

- "First Reporter": 1st issue
- "Top Reporter": 10+ issues
- "Civic Hero": 50+ issues
- "Verifier": 10+ verifications
- "Trusted Voice": 200+ reputation

---

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes and add tests
4. Run tests (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Testing Requirements

- All new features must have tests
- Maintain 70%+ code coverage
- All tests must pass before merging
- CI/CD pipeline must pass

---

## License

ISC License
