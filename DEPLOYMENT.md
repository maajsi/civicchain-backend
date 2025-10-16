# Deployment Guide

This guide covers deploying the CivicChain backend to various platforms.

## Prerequisites

- Git repository access
- Domain name (optional but recommended)
- SSL certificate (for HTTPS)
- Production database (PostgreSQL with PostGIS)
- Solana mainnet wallet with funds

## Platform-Specific Guides

### Option 1: Deploy to Railway

Railway provides easy deployment with PostgreSQL and automatic HTTPS.

1. **Create Railway account** at https://railway.app

2. **Create new project** from GitHub repository

3. **Add PostgreSQL database**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will provision a database automatically

4. **Add PostGIS extension**:
   ```sql
   -- Connect to Railway database using provided connection string
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

5. **Configure environment variables** in Railway dashboard:
   ```
   DATABASE_URL=postgresql://...  (provided by Railway)
   NODE_ENV=production
   JWT_SECRET=your_secure_random_secret
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   SOLANA_NETWORK=mainnet-beta
   MASTER_WALLET_PRIVATE_KEY=[...]
   AI_SERVICE_URL=https://your-ai-service.com
   FRONTEND_URL=https://your-frontend.com
   ```

6. **Deploy**:
   - Railway auto-deploys on push to main branch
   - Or manually trigger deployment from dashboard

7. **Run migrations**:
   ```bash
   # In Railway dashboard, open terminal and run:
   npm run migrate
   ```

### Option 2: Deploy to Heroku

1. **Install Heroku CLI**:
   ```bash
   npm install -g heroku
   ```

2. **Login and create app**:
   ```bash
   heroku login
   heroku create civicchain-backend
   ```

3. **Add PostgreSQL addon**:
   ```bash
   heroku addons:create heroku-postgresql:standard-0
   ```

4. **Enable PostGIS**:
   ```bash
   heroku pg:psql
   CREATE EXTENSION postgis;
   \q
   ```

5. **Set environment variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_secure_secret
   heroku config:set SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   heroku config:set MASTER_WALLET_PRIVATE_KEY='[1,2,3,...]'
   # Add other variables...
   ```

6. **Deploy**:
   ```bash
   git push heroku main
   ```

7. **Run migrations**:
   ```bash
   heroku run npm run migrate
   ```

### Option 3: Deploy to DigitalOcean/AWS/GCP

#### Using Docker (Recommended)

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**:
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       env_file:
         - .env.production
       depends_on:
         - db
     
     db:
       image: postgis/postgis:14-3.3
       environment:
         POSTGRES_DB: civicchain
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: ${DB_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       ports:
         - "5432:5432"
   
   volumes:
     postgres_data:
   ```

3. **Deploy with Docker**:
   ```bash
   docker-compose up -d
   docker-compose exec app npm run migrate
   ```

#### Using PM2 (Node.js Process Manager)

1. **Install PM2**:
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem.config.js**:
   ```javascript
   module.exports = {
     apps: [{
       name: 'civicchain-backend',
       script: './src/server.js',
       instances: 2,
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true
     }]
   };
   ```

3. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## Database Setup

### PostgreSQL with PostGIS

1. **Install PostgreSQL and PostGIS**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-14 postgresql-14-postgis-3
   
   # Start PostgreSQL
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Create database and user**:
   ```bash
   sudo -u postgres psql
   ```
   ```sql
   CREATE DATABASE civicchain;
   CREATE USER civicchain_user WITH ENCRYPTED PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE civicchain TO civicchain_user;
   \c civicchain
   CREATE EXTENSION postgis;
   \q
   ```

3. **Configure connection**:
   - Update firewall rules to allow database connections
   - Configure PostgreSQL to accept remote connections (if needed)
   - Use SSL for database connections in production

## Solana Setup

### Mainnet Wallet

1. **Generate production wallet** (do this on a secure machine):
   ```bash
   solana-keygen new --outfile production-wallet.json
   ```

2. **Fund the wallet** with SOL for user funding

3. **Convert to array format** and add to environment variables

4. **Secure the private key**:
   - Never commit to version control
   - Store in secure secrets management (AWS Secrets Manager, etc.)
   - Use environment variables in production

## HTTPS/SSL Setup

### Using Let's Encrypt with Nginx

1. **Install Nginx and Certbot**:
   ```bash
   sudo apt-get install nginx certbot python3-certbot-nginx
   ```

2. **Configure Nginx** (`/etc/nginx/sites-available/civicchain`):
   ```nginx
   server {
       listen 80;
       server_name api.civicchain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Enable site and get SSL certificate**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/civicchain /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   sudo certbot --nginx -d api.civicchain.com
   ```

## Environment Variables

### Production .env Template

```env
# Server
NODE_ENV=production
PORT=3000
BASE_URL=https://api.civicchain.com
FRONTEND_URL=https://civicchain.com

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=civicchain
DB_USER=civicchain_user
DB_PASSWORD=secure_production_password

# JWT
JWT_SECRET=very_secure_random_string_change_this
JWT_EXPIRES_IN=7d

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
MASTER_WALLET_PRIVATE_KEY=[secure_key_array]

# AI Service
AI_SERVICE_URL=https://ai.civicchain.com

# File Upload
MAX_FILE_SIZE=10485760
```

## Post-Deployment Steps

1. **Run migrations**:
   ```bash
   npm run migrate
   ```

2. **Test all endpoints**:
   - Use API_TESTING.md as reference
   - Test authentication
   - Test issue creation
   - Test voting and verification
   - Test admin endpoints

3. **Set up monitoring**:
   - Application monitoring (e.g., New Relic, Datadog)
   - Error tracking (e.g., Sentry)
   - Uptime monitoring (e.g., UptimeRobot)
   - Log aggregation (e.g., Papertrail, Loggly)

4. **Configure backups**:
   - Database backups (daily)
   - Uploaded images backup
   - Configuration backups

5. **Set up CI/CD** (optional):
   - GitHub Actions
   - GitLab CI
   - Jenkins

## Monitoring and Maintenance

### Health Checks

Set up monitoring for:
- `/health` endpoint (should return 200)
- Database connectivity
- Solana RPC connectivity
- Disk space for uploads
- Memory usage
- CPU usage

### Logging

Consider adding production logging:

```javascript
// Install winston
npm install winston

// src/config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### Database Maintenance

```sql
-- Run weekly
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('civicchain'));

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] Database connections encrypted
- [ ] JWT secret is strong and unique
- [ ] Solana private key securely stored
- [ ] Rate limiting implemented
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection
- [ ] Regular security updates
- [ ] Firewall configured
- [ ] Non-root user for application
- [ ] Environment variables not committed to git
- [ ] Error messages don't expose sensitive info
- [ ] File upload validation and limits
- [ ] API authentication on all protected routes

## Troubleshooting

### Common Issues

1. **Database connection fails**:
   - Check database credentials
   - Verify database is running
   - Check firewall rules
   - Verify PostGIS extension is installed

2. **Migrations fail**:
   - Check database user permissions
   - Ensure database exists
   - Check for syntax errors in migrations

3. **Solana transactions fail**:
   - Verify RPC URL is correct
   - Check wallet has sufficient funds
   - Verify network (devnet vs mainnet)

4. **High memory usage**:
   - Check for memory leaks
   - Optimize database queries
   - Consider using PM2 cluster mode
   - Increase server resources

5. **Slow response times**:
   - Check database query performance
   - Add database indexes
   - Enable caching
   - Use CDN for static files
   - Consider load balancing

## Scaling Considerations

As your application grows:

1. **Database**: 
   - Use read replicas
   - Implement connection pooling
   - Consider database sharding

2. **Application**:
   - Use PM2 cluster mode
   - Deploy multiple instances
   - Use load balancer

3. **Storage**:
   - Move uploads to S3/Cloud Storage
   - Use CDN for images

4. **Caching**:
   - Add Redis for session/data caching
   - Implement HTTP caching headers

## Rollback Strategy

If deployment fails:

1. **Database**: Keep database backups before migrations
2. **Code**: Use git tags for releases
3. **Quick rollback**:
   ```bash
   git revert <commit-hash>
   git push
   # Or roll back to previous release
   git checkout <previous-release-tag>
   ```

## Support

For deployment issues:
- Check logs: `pm2 logs` or `heroku logs --tail`
- Review error messages
- Consult platform-specific documentation
- Open GitHub issue for help

---

**Remember**: Always test deployments in a staging environment before deploying to production!
