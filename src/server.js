require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initializeSolana } = require('./utils/solana');

// Initialize Solana connection
initializeSolana();

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.server.frontendUrl,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.uploadDir)));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const issueRoutes = require('./routes/issue');
const adminRoutes = require('./routes/admin');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CivicChain Backend API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/issue', issueRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to CivicChain Backend API',
    version: '1.0.0',
    documentation: 'See README.md for API documentation',
    endpoints: {
      auth: '/api/auth/*',
      user: '/api/user/*',
      issue: '/api/issue/*',
      admin: '/api/admin/*'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.server.env === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║     CivicChain Backend API Server            ║
  ╠═══════════════════════════════════════════════╣
  ║  Status: Running                              ║
  ║  Port: ${PORT}                                   ║
  ║  Environment: ${config.server.env.padEnd(27)} ║
  ║  Base URL: ${config.server.baseUrl.padEnd(27)} ║
  ╚═══════════════════════════════════════════════╝
  `);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/user/me');
  console.log('  GET  /api/user/:user_id');
  console.log('  POST /api/issue/classify');
  console.log('  POST /api/issue/report');
  console.log('  GET  /api/issues');
  console.log('  GET  /api/issue/:id');
  console.log('  POST /api/issue/:id/upvote');
  console.log('  POST /api/issue/:id/downvote');
  console.log('  POST /api/issue/:id/verify');
  console.log('  POST /api/issue/:id/update-status');
  console.log('  GET  /api/admin/dashboard');
  console.log('  GET  /api/admin/issues');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

module.exports = app;
