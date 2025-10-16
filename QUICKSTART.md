# CivicChain Backend - Quick Start Guide

## Overview

CivicChain is a comprehensive civic issue management platform with blockchain integration. This guide will help you get started quickly.

## Prerequisites

- Node.js 16+
- PostgreSQL 14+ with PostGIS
- 5-10 minutes for setup

## Quick Setup (3 Steps)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database

**Option A: Automated (Linux/Mac)**
```bash
./setup-db.sh
```

**Option B: Manual**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Run migrations
npm run migrate
```

### 3. Start Server
```bash
npm run dev
```

The server will start at `http://localhost:3000`

## Verify Installation

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "CivicChain Backend API is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## First API Call

### 1. Login (Create User)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "profile_pic": "https://example.com/photo.jpg"
  }'
```

Save the `jwt_token` from the response.

### 2. Get Your Profile
```bash
curl -X GET http://localhost:3000/user/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Report an Issue

First, prepare an image and classify it:
```bash
curl -X POST http://localhost:3000/issue/classify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

Then, submit the issue:
```bash
curl -X POST http://localhost:3000/issue/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "/uploads/returned-from-classify.jpg",
    "description": "Test issue description",
    "category": "pothole",
    "lat": 17.385,
    "lng": 78.4867,
    "region": "Test Region"
  }'
```

## Project Structure

```
civicchain-backend/
├── src/
│   ├── config/          # Database, Solana config
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth, validation
│   ├── routes/          # API routes
│   ├── utils/           # Helpers
│   └── server.js        # Entry point
├── uploads/             # Image storage
├── .env                 # Configuration (create this)
├── .env.example         # Configuration template
└── package.json
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run migrate` - Run database migrations

## API Endpoints

### Authentication
- `POST /auth/login` - Login with Google OAuth

### Users
- `GET /user/me` - Get current user profile
- `GET /user/:user_id` - Get user profile by ID

### Issues
- `POST /issue/classify` - Upload and classify image
- `POST /issue/report` - Report new issue
- `GET /issues` - Get issues with filters
- `GET /issue/:id` - Get single issue
- `POST /issue/:id/upvote` - Upvote issue
- `POST /issue/:id/downvote` - Downvote issue
- `POST /issue/:id/verify` - Verify resolved issue

### Admin (Government Only)
- `GET /admin/dashboard` - Get statistics and heatmap
- `GET /admin/issues` - Get all issues with filters
- `POST /issue/:id/update-status` - Update issue status

## Configuration

### Required Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/civicchain
JWT_SECRET=your_secret_here
PORT=3000
```

### Optional Environment Variables

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_WALLET_PRIVATE_KEY=[]
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3001
```

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running: `sudo service postgresql status`
- Verify DATABASE_URL in .env
- Check PostGIS extension: `psql -d civicchain -c "SELECT PostGIS_version()"`

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

### JWT Token Error
- Ensure JWT_SECRET is set in .env
- Check token hasn't expired (default 7 days)
- Verify Authorization header format: `Bearer <token>`

## Testing

### Using curl (see above examples)

### Using Postman
Import the Postman collection: `postman_collection.json`

### Using Thunder Client (VS Code)
1. Install Thunder Client extension
2. Import collection
3. Set environment variables

## Next Steps

1. **Read Full Documentation**
   - [README.md](README.md) - Complete overview
   - [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Full API reference
   - [EXAMPLES.md](EXAMPLES.md) - Request/response examples

2. **Deploy to Production**
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide

3. **Contribute**
   - [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

4. **Implement Smart Contract**
   - [SMART_CONTRACT_SPEC.md](SMART_CONTRACT_SPEC.md) - Contract specification

## Database Schema

### Users
- Stores user profiles, reputation, badges
- Role: citizen or government

### Issues
- Stores civic issues with location (PostGIS)
- Priority scoring, voting counts

### Votes
- Tracks upvotes/downvotes per user per issue

### Verifications
- Tracks citizen verifications of resolved issues

## Key Features

✅ **Authentication**: JWT-based with Google OAuth
✅ **Location Services**: PostGIS for proximity search
✅ **Priority Algorithm**: Multi-factor scoring system
✅ **Reputation System**: Dynamic reputation based on actions
✅ **Blockchain Integration**: Solana devnet ready
✅ **Image Upload**: Local storage with static serving
✅ **Admin Dashboard**: Statistics and heatmap data
✅ **Verification System**: Citizen-driven issue verification

## Common Use Cases

### Citizen User Flow
1. Login → Get JWT token
2. Browse nearby issues → Filter by location/category
3. Report new issue → Upload image, add details
4. Vote on issues → Upvote/downvote
5. Verify resolved issues → Confirm fixes

### Government User Flow
1. Login → Get JWT token (role: government)
2. View dashboard → See statistics and heatmap
3. Review issues → Filter, sort, search
4. Update status → Mark as in_progress/resolved
5. Upload proof → Add proof image

## Performance Tips

- Use filters when fetching issues
- Implement pagination for large result sets
- Cache frequently accessed data
- Use indexes for common queries (already configured)
- Monitor database connection pool

## Security Notes

- Never commit .env file
- Use strong JWT_SECRET in production
- Enable HTTPS in production
- Restrict CORS to specific domains
- Keep dependencies updated
- Use prepared statements (already implemented)

## Support

- 📖 Documentation: See docs folder
- 🐛 Issues: Open on GitHub
- 💬 Discussions: GitHub Discussions
- 📧 Email: (Add your email)

## License

ISC License - See [LICENSE](LICENSE) file

---

**Ready to build transparent civic governance! 🚀**
