# CivicChain Backend API

CivicChain is an AI-powered, blockchain-backed civic issue management platform designed for transparent, trust-based governance. This repository contains the backend API system built with Node.js, Express, PostgreSQL with PostGIS, and Solana blockchain integration.

## 🚀 Features

- **User Authentication**: Google OAuth integration with JWT-based authentication
- **Issue Management**: Report, track, and manage civic issues with AI-powered classification
- **Voting System**: Community-driven upvoting and downvoting of issues
- **Verification System**: Citizen verification of resolved issues
- **Reputation System**: Dynamic reputation scoring for users
- **Badge System**: Achievement badges for active contributors
- **Priority Scoring**: Intelligent priority calculation based on multiple factors
- **Proximity Search**: PostGIS-powered location-based issue filtering
- **Admin Dashboard**: Government user dashboard with statistics and heatmaps
- **Blockchain Integration**: Solana devnet for transparent audit trails

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v14 or higher) with PostGIS extension
- Solana CLI (optional, for blockchain operations)

## 🛠️ Installation

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
```

Edit `.env` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `MASTER_WALLET_PRIVATE_KEY`: Solana wallet private key (array format)
- Other configuration as needed

4. Set up the database:
```bash
npm run migrate
```

This will:
- Enable PostGIS extension
- Create all required tables (users, issues, votes, verifications)
- Set up indexes and constraints

## 🚦 Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## 📚 API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication

All endpoints except `/auth/login` and `/health` require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth Endpoints

**POST /auth/login**
- Description: Google OAuth login
- Body: `{ email, name, profile_pic }`
- Returns: User info and JWT token

#### User Endpoints

**GET /user/me**
- Description: Get current user profile
- Auth: Required

**GET /user/:user_id**
- Description: Get any user's public profile
- Auth: Required

#### Issue Endpoints

**POST /issue/classify**
- Description: Upload image for AI classification
- Auth: Required
- Body: `multipart/form-data` with `image` field
- Returns: Suggested category and urgency score

**POST /issue/report**
- Description: Submit a new issue report
- Auth: Required
- Body: `{ image_url, description, category, lat, lng, region? }`
- Returns: Created issue with blockchain transaction hash

**GET /issues**
- Description: Get issues with filters
- Auth: Required
- Query params: `lat`, `lng`, `radius`, `category`, `status`
- Returns: Array of issues sorted by priority and distance

**GET /issue/:id**
- Description: Get single issue details
- Auth: Required
- Returns: Detailed issue information

**POST /issue/:id/upvote**
- Description: Upvote an issue
- Auth: Required
- Returns: Updated issue and reputation changes

**POST /issue/:id/downvote**
- Description: Downvote an issue
- Auth: Required
- Returns: Updated issue and reputation changes

**POST /issue/:id/verify**
- Description: Verify a resolved issue (citizens only)
- Auth: Required
- Body: `{ verified: true }`
- Returns: Verification result and reputation rewards

**POST /issue/:id/update-status**
- Description: Update issue status (government only)
- Auth: Required (Government role)
- Body: `multipart/form-data` with `status` and optional `proof_image`
- Returns: Updated issue with blockchain transaction hash

#### Admin Endpoints (Government Only)

**GET /admin/dashboard**
- Description: Get dashboard statistics and heatmap data
- Auth: Required (Government role)
- Returns: Statistics, heatmap data, top priority issues

**GET /admin/issues**
- Description: Get all issues with advanced filters
- Auth: Required (Government role)
- Query params: `status`, `category`, `date_from`, `date_to`, `sort_by`, `page`, `limit`
- Returns: Paginated issues with metadata

### Health Check

**GET /health**
- Description: API health check
- Auth: Not required
- Returns: Server status

## 🗄️ Database Schema

### Users Table
- `user_id`: UUID (Primary Key)
- `privy_user_id`: VARCHAR(255)
- `wallet_address`: VARCHAR(255)
- `email`: VARCHAR(255)
- `name`: VARCHAR(255)
- `profile_pic`: TEXT
- `role`: ENUM (citizen, government)
- `rep`: INTEGER (reputation score)
- `issues_reported`: INTEGER
- `issues_resolved`: INTEGER
- `total_upvotes`: INTEGER
- `verifications_done`: INTEGER
- `badges`: TEXT[]
- `created_at`: TIMESTAMP

### Issues Table
- `issue_id`: UUID (Primary Key)
- `reporter_user_id`: UUID (Foreign Key)
- `wallet_address`: VARCHAR(255)
- `image_url`: TEXT
- `description`: TEXT
- `category`: ENUM (pothole, garbage, streetlight, water, other)
- `location`: GEOGRAPHY (PostGIS Point)
- `region`: VARCHAR(255)
- `status`: ENUM (open, in_progress, resolved, closed)
- `priority_score`: FLOAT
- `blockchain_tx_hash`: VARCHAR(255)
- `upvotes`: INTEGER
- `downvotes`: INTEGER
- `admin_proof_url`: TEXT
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### Votes Table
- `vote_id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `issue_id`: UUID (Foreign Key)
- `vote_type`: ENUM (upvote, downvote)
- `created_at`: TIMESTAMP
- UNIQUE constraint on (user_id, issue_id)

### Verifications Table
- `verification_id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `issue_id`: UUID (Foreign Key)
- `verified_at`: TIMESTAMP
- UNIQUE constraint on (user_id, issue_id)

## 🎯 Priority Scoring Algorithm

Priority score is calculated using the formula:

```
Priority = (2.5 × LD) + (2.0 × RR) + (2.0 × UR) + (2.5 × CU) + (1.0 × TF)
```

Where:
- **LD (Location Density)**: Number of issues within 100m in last 30 days (max 10)
- **RR (Reporter Reputation)**: min(reporter_rep / 10, 10)
- **UR (Upvote Reputation Sum)**: min(sum_upvoter_rep / 100, 10)
- **CU (Category Urgency)**: Category-based urgency (4-9)
  - Water: 9
  - Pothole: 8
  - Garbage: 6
  - Other: 5
  - Streetlight: 4
- **TF (Time Factor)**: Days since issue reported (max 10)

Maximum Score: 100

## 🏆 Reputation System

### Initial Reputation
- New users start with 100 reputation points

### Reputation Changes
| Action | Reporter Change | Voter/Verifier Change |
|--------|----------------|----------------------|
| Upvote received | +5 | 0 |
| Downvote received | -3 | 0 |
| Issue verified resolved | +10 | +5 (per verifier) |
| Issue marked spam/fake | -20 | 0 |

### Badges
- **First Reporter**: Report 1st issue
- **Top Reporter**: Report 10+ issues
- **Civic Hero**: Report 50+ issues
- **Verifier**: Complete 10+ verifications
- **Trusted Voice**: Reach 200+ reputation

## 🔗 Blockchain Integration

The system integrates with Solana devnet for transparent audit trails:

- **User Creation**: New wallets are funded with 0.05 SOL
- **Issue Creation**: On-chain record created
- **Voting**: Blockchain transaction recorded
- **Status Updates**: Government actions recorded on-chain

## 🧪 Testing

```bash
npm test
```

## 📝 Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/civicchain
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_WALLET_PRIVATE_KEY=[]
AI_SERVICE_URL=http://localhost:8000
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png
FRONTEND_URL=http://localhost:3001
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC License

## 🔒 Security

- All sensitive data is stored securely
- JWT tokens for authentication
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- File upload restrictions

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for transparent civic governance
