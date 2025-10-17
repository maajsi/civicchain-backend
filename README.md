# CivicChain Backend

AI-powered, blockchain-backed civic issue management platform for transparent, trust-based governance.

[![CI/CD](https://github.com/maajsi/civicchain-backend/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/maajsi/civicchain-backend/actions/workflows/ci-cd.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

## 🚀 Quick Start

```bash
# Using Docker (Recommended)
docker-compose up -d

# Manual Setup
npm install
npm run migrate
npm run dev
```

**📖 [Complete Documentation](DOCS.md)** | **🔌 [API Reference](API_DOCUMENTATION.md)** | **📋 [Deployment Guide](DEPLOYMENT.md)**

## ✨ Features

- **🔐 Authentication**: NextAuth JWT integration with Solana wallet creation
- **🤖 AI Classification**: Roboflow-powered automatic civic issue detection
- **⛓️ Blockchain**: Solana smart contract for transparent, immutable records
- **📍 Geospatial**: PostGIS-powered proximity search and location-based queries
- **🏆 Gamification**: Reputation system with badges and community rewards
- **🐳 Containerized**: Docker Compose with PostgreSQL, AI service, and backend

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: PostgreSQL 15 + PostGIS
- **Blockchain**: Solana (Anchor framework)
- **AI**: Roboflow inference server
- **Testing**: Jest, Supertest
- **CI/CD**: GitHub Actions

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | JWT verification and user creation |
| `/user/me` | GET | Current user profile |
| `/issue/classify` | POST | AI-powered image classification |
| `/issue/report` | POST | Submit new civic issue |
| `/issues` | GET | List issues with filters |
| `/issue/:id/upvote` | POST | Upvote an issue |
| `/issue/:id/verify` | POST | Verify resolved issue |
| `/admin/dashboard` | GET | Government dashboard |

**See [DOCS.md](DOCS.md#api-reference) for complete API documentation.**

## 🧪 Testing

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Watch mode
npm run test:ci       # CI mode
```

Test coverage target: 70%+ across all metrics.

## 🚢 Deployment

### Docker (Recommended)
```bash
docker-compose up -d
```

### Platforms Supported
- Docker Compose
- Heroku
- Railway
- DigitalOcean App Platform
- AWS EC2

**See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.**

## 📂 Project Structure

```
civicchain-backend/
├── src/
│   ├── controllers/     # Business logic
│   ├── routes/          # API routes
│   ├── services/        # AI & Solana services
│   └── server.js        # Entry point
├── tests/               # Test suites
├── migrations/          # Database migrations
├── solana-contract/     # Smart contract
└── docker-compose.yml   # Container orchestration
```

## 🔗 Smart Contract

Deploy the Solana smart contract:

```bash
cd solana-contract
anchor build
anchor deploy
```

See [solana-contract/README.md](solana-contract/README.md) for details.

## 📄 License

ISC License

## 🤝 Contributing

See [DOCS.md](DOCS.md#contributing) for contribution guidelines.

---

**Built with ❤️ for transparent governance**
