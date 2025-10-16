# Quick Start Guide

Get CivicChain backend running in 5 minutes!

## Prerequisites

- Node.js 16+ installed
- PostgreSQL 14+ with PostGIS installed
- Git installed

## 1. Clone and Install

```bash
git clone https://github.com/maajsi/civicchain-backend.git
cd civicchain-backend
npm install
```

## 2. Set Up Database

```bash
# Create database
createdb civicchain

# Enable PostGIS
psql -d civicchain -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

## 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your database password
```

Minimal `.env` configuration:
```env
DB_PASSWORD=your_password
JWT_SECRET=any_random_string_for_development
```

## 4. Run Migrations

```bash
npm run migrate
```

## 5. Start Server

```bash
npm run dev
```

You should see:
```
  ╔═══════════════════════════════════════════════╗
  ║     CivicChain Backend API Server            ║
  ╠═══════════════════════════════════════════════╣
  ║  Status: Running                              ║
  ║  Port: 3000                                   ║
  ╚═══════════════════════════════════════════════╝
```

## 6. Test It!

```bash
# Health check
curl http://localhost:3000/health

# Create a test user
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","profile_pic":""}'
```

## 7. Generate Sample Data (Optional)

```bash
npm run seed
```

## Next Steps

- Read [API_TESTING.md](API_TESTING.md) for API examples
- Read [SETUP.md](SETUP.md) for detailed setup
- Read [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for database info
- Start building your frontend!

## Common Issues

### "Cannot connect to database"
- Check PostgreSQL is running: `pg_isready`
- Check credentials in `.env`

### "PostGIS not found"
- Install: `sudo apt-get install postgresql-14-postgis-3`
- Enable: `psql -d civicchain -c "CREATE EXTENSION postgis;"`

### "Port 3000 already in use"
- Change `PORT` in `.env`
- Or stop the process using port 3000

## Useful Commands

```bash
npm start          # Start production server
npm run dev        # Start with auto-reload
npm run migrate    # Run database migrations
npm run seed       # Generate sample data
npm run check-env  # Check environment setup
```

## Project Structure

```
civicchain-backend/
├── src/
│   ├── config/       # Configuration files
│   ├── controllers/  # Route handlers
│   ├── db/           # Database & migrations
│   ├── middleware/   # Express middleware
│   ├── routes/       # API routes
│   ├── utils/        # Utility functions
│   └── server.js     # Main entry point
├── uploads/          # Uploaded images
└── scripts/          # Helper scripts
```

## API Endpoints

```
POST   /api/auth/login              Login
GET    /api/user/me                 Current user
GET    /api/user/:id                User by ID
POST   /api/issue/classify          Classify image
POST   /api/issue/report            Create issue
GET    /api/issues                  List issues
GET    /api/issue/:id               Get issue
POST   /api/issue/:id/upvote        Upvote
POST   /api/issue/:id/downvote      Downvote
POST   /api/issue/:id/verify        Verify
POST   /api/issue/:id/update-status Update status
GET    /api/admin/dashboard         Dashboard
GET    /api/admin/issues            Admin issues
```

## Need Help?

- Check [SETUP.md](SETUP.md) for detailed instructions
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Open an issue on GitHub
- Read the main [README.md](README.md)

---

Happy coding! 🚀
