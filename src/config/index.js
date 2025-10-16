require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001'
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'civicchain',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change_this_secret_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network: process.env.SOLANA_NETWORK || 'devnet',
    masterWalletPrivateKey: process.env.MASTER_WALLET_PRIVATE_KEY
  },
  
  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000'
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    uploadDir: 'uploads',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
  },
  
  reputation: {
    initial: 100,
    upvoteReceived: 5,
    downvoteReceived: -3,
    issueVerifiedResolved: 10,
    verifierReward: 5,
    issueMarkedSpam: -20,
    minReputation: 0
  },
  
  verification: {
    autoCloseThreshold: 3 // Auto-close issue after 3 verifications
  },
  
  proximity: {
    defaultRadius: 5000, // 5km in meters
    densityRadius: 100, // 100m for location density calculation
    densityWindow: 30 // days for location density
  },
  
  priorityWeights: {
    locationDensity: 2.5,
    reporterReputation: 2.0,
    upvoteReputationSum: 2.0,
    categoryUrgency: 2.5,
    timeFactor: 1.0
  },
  
  categoryUrgency: {
    pothole: 8,
    garbage: 6,
    streetlight: 4,
    water: 9,
    other: 5
  },
  
  wallet: {
    fundingAmount: 50000000, // 0.05 SOL in lamports
    refillThreshold: 10000000, // 0.01 SOL in lamports
    refillAmount: 50000000 // 0.05 SOL in lamports
  }
};
