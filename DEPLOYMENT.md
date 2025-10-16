# Deployment Guide for CivicChain Backend

This guide covers deploying the CivicChain backend to various hosting platforms.

## Prerequisites

- PostgreSQL database with PostGIS extension
- Node.js 16+ runtime environment
- Solana wallet with devnet SOL (for master wallet)

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=7d

# Solana
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
MASTER_WALLET_PRIVATE_KEY=[1,2,3,...] # Array of numbers

# AI Service
AI_SERVICE_URL=https://your-ai-service.com

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png

# CORS
FRONTEND_URL=https://your-frontend.com
```

## Deployment Options

### Option 1: Heroku

1. Install Heroku CLI:
```bash
npm install -g heroku
```

2. Login to Heroku:
```bash
heroku login
```

3. Create a new Heroku app:
```bash
heroku create civicchain-backend
```

4. Add PostgreSQL addon:
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

5. Enable PostGIS:
```bash
heroku pg:psql
CREATE EXTENSION postgis;
\q
```

6. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_here
heroku config:set SOLANA_NETWORK=devnet
# ... set other variables
```

7. Deploy:
```bash
git push heroku main
```

8. Run migrations:
```bash
heroku run npm run migrate
```

9. Check logs:
```bash
heroku logs --tail
```

### Option 2: Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login:
```bash
railway login
```

3. Initialize project:
```bash
railway init
```

4. Add PostgreSQL:
```bash
railway add postgresql
```

5. Set environment variables in Railway dashboard

6. Deploy:
```bash
railway up
```

### Option 3: DigitalOcean App Platform

1. Create a new app on DigitalOcean
2. Connect your GitHub repository
3. Configure build settings:
   - Build Command: `npm install`
   - Run Command: `npm start`
4. Add PostgreSQL database component
5. Set environment variables in the app settings
6. Deploy

### Option 4: AWS EC2

1. Launch an EC2 instance (Ubuntu 22.04 LTS)

2. SSH into the instance:
```bash
ssh -i your-key.pem ubuntu@your-instance-ip
```

3. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Install PostgreSQL and PostGIS:
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis
```

5. Configure PostgreSQL:
```bash
sudo -u postgres psql
CREATE DATABASE civicchain;
CREATE USER civicchain_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE civicchain TO civicchain_user;
\c civicchain
CREATE EXTENSION postgis;
\q
```

6. Clone repository:
```bash
git clone https://github.com/maajsi/civicchain-backend.git
cd civicchain-backend
npm install
```

7. Create .env file with production settings

8. Run migrations:
```bash
npm run migrate
```

9. Install PM2 for process management:
```bash
sudo npm install -g pm2
```

10. Start the application:
```bash
pm2 start src/server.js --name civicchain-backend
pm2 save
pm2 startup
```

11. Configure Nginx as reverse proxy:
```bash
sudo apt-get install -y nginx
```

Create Nginx config at `/etc/nginx/sites-available/civicchain`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/civicchain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

12. Set up SSL with Let's Encrypt:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 5: Docker

1. Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

2. Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: civicchain
      POSTGRES_USER: civicchain_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://civicchain_user:your_password@db:5432/civicchain
      NODE_ENV: production
      JWT_SECRET: your_secret_here
      # ... other env variables
    depends_on:
      - db

volumes:
  postgres_data:
```

3. Build and run:
```bash
docker-compose up -d
```

4. Run migrations:
```bash
docker-compose exec api npm run migrate
```

## Database Migration

After deploying, always run database migrations:

```bash
npm run migrate
```

For production databases, consider using a migration tool like:
- Flyway
- Liquibase
- node-pg-migrate

## Monitoring

### Health Check Endpoint

The API provides a health check endpoint at `/health`:

```bash
curl https://your-api.com/health
```

### Recommended Monitoring Tools

- **Application Monitoring**: New Relic, Datadog, or Sentry
- **Log Aggregation**: Papertrail, Loggly, or ELK Stack
- **Uptime Monitoring**: Pingdom, UptimeRobot, or StatusCake

### PM2 Monitoring (for EC2/VPS)

```bash
pm2 monit
pm2 logs civicchain-backend
```

## Backup Strategy

### Database Backups

1. Automated daily backups:
```bash
# Add to crontab
0 2 * * * pg_dump -U civicchain_user civicchain > /backups/civicchain_$(date +\%Y\%m\%d).sql
```

2. S3 backup script:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="civicchain_$DATE.sql"
pg_dump -U civicchain_user civicchain > /tmp/$BACKUP_FILE
gzip /tmp/$BACKUP_FILE
aws s3 cp /tmp/$BACKUP_FILE.gz s3://your-bucket/backups/
rm /tmp/$BACKUP_FILE.gz
```

### File Uploads Backup

Regularly backup the `uploads/` directory:
```bash
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
aws s3 cp uploads_backup_*.tar.gz s3://your-bucket/uploads-backups/
```

## Security Checklist

- [ ] Use HTTPS (SSL/TLS) in production
- [ ] Set strong JWT_SECRET
- [ ] Enable rate limiting (consider using express-rate-limit)
- [ ] Implement request validation
- [ ] Use helmet.js for security headers
- [ ] Restrict CORS to specific domains
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Enable PostgreSQL SSL connections
- [ ] Implement API authentication on all endpoints
- [ ] Set up database connection pooling
- [ ] Use prepared statements (already implemented)
- [ ] Configure proper file upload limits
- [ ] Implement logging and monitoring

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (AWS ALB, Nginx, etc.)
- Deploy multiple API instances
- Use Redis for session management (if needed)
- Consider microservices architecture

### Database Scaling

- Enable read replicas for PostgreSQL
- Implement connection pooling
- Add database indexes for frequently queried fields
- Consider database sharding for large datasets

### File Storage

- Move from local storage to S3/CloudFront
- Implement CDN for static assets
- Use image optimization service

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check PostGIS extension
psql $DATABASE_URL -c "SELECT PostGIS_version()"
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### High Memory Usage

- Monitor with `htop` or `pm2 monit`
- Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 src/server.js
```

## Performance Optimization

1. Enable gzip compression:
```bash
npm install compression
```

Add to server.js:
```javascript
const compression = require('compression');
app.use(compression());
```

2. Add response caching for static data

3. Optimize database queries with indexes

4. Use connection pooling (already configured)

5. Implement API response pagination

## Maintenance

### Regular Tasks

- Weekly dependency updates
- Monthly security audits
- Quarterly load testing
- Regular database optimization (VACUUM, ANALYZE)

### Update Procedure

```bash
# Backup database
npm run backup

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run migrate

# Restart application
pm2 restart civicchain-backend
```

---

For questions or issues, please open an issue on GitHub.
