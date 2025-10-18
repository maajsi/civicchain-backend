// Test controllers
const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Mock the database and services
jest.mock('../src/config/database');
jest.mock('../src/services/aiService');
jest.mock('../src/services/solanaService');

const pool = require('../src/config/database');
const { classifyImageWithAI } = require('../src/services/aiService');
const { createIssueOnChain } = require('../src/services/solanaService');

// Import controllers
const { classifyIssue, reportIssue, getIssues, getIssueById } = require('../src/controllers/issueController');
const { getCurrentUser, getUserById } = require('../src/controllers/userController');
const { login } = require('../src/controllers/authController');

// Create test app
const app = express();
app.use(express.json());

// Mock multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Mock routes
app.post('/issue/classify', upload.single('image'), classifyIssue);
app.post('/issue/report', reportIssue);
app.get('/issues', getIssues);
app.get('/issue/:id', getIssueById);
app.get('/user/me', getCurrentUser);
app.get('/user/:user_id', getUserById);
app.post('/auth/login', login);

describe('Issue Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyIssue', () => {
    test('should classify image successfully', async () => {
      const mockFile = {
        filename: 'test-image.jpg',
        path: '/uploads/test-image.jpg'
      };

      classifyImageWithAI.mockResolvedValueOnce('pothole');

      const response = await request(app)
        .post('/issue/classify')
        .attach('image', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.suggested_category).toBe('pothole');
    });

    test('should return error when no image provided', async () => {
      const response = await request(app)
        .post('/issue/classify');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No image file provided');
    });

    test('should handle AI service errors', async () => {
      const mockFile = {
        filename: 'test-image.jpg',
        path: '/uploads/test-image.jpg'
      };

      classifyImageWithAI.mockRejectedValueOnce(new Error('AI service error'));

      const response = await request(app)
        .post('/issue/classify')
        .attach('image', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('reportIssue', () => {
    beforeEach(() => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);
    });

    test('should report issue successfully', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      // Mock user query
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-user-id',
          wallet_address: 'test-wallet',
          rep: 100,
          issues_reported: 0
        }]
      });

      // Mock issue creation
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          issue_id: 'test-issue-id',
          reporter_user_id: 'test-user-id',
          wallet_address: 'test-wallet',
          image_url: '/uploads/test.jpg',
          description: 'Test issue',
          category: 'pothole',
          lat: 17.4362,
          lng: 78.3669,
          region: 'Test Region',
          status: 'open',
          priority_score: 50,
          created_at: new Date()
        }]
      });

      // Mock user update
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      createIssueOnChain.mockResolvedValueOnce('mock-tx-hash');

      const response = await request(app)
        .post('/issue/report')
        .send({
          user_id: 'test-user-id',
          image_url: '/uploads/test.jpg',
          description: 'Test issue',
          category: 'pothole',
          lat: 17.4362,
          lng: 78.3669,
          region: 'Test Region'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.issue.issue_id).toBe('test-issue-id');
    });

    test('should return error for missing required fields', async () => {
      const response = await request(app)
        .post('/issue/report')
        .send({
          user_id: 'test-user-id',
          description: 'Test issue'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });

    test('should return error for invalid category', async () => {
      const response = await request(app)
        .post('/issue/report')
        .send({
          user_id: 'test-user-id',
          image_url: '/uploads/test.jpg',
          description: 'Test issue',
          category: 'invalid-category',
          lat: 17.4362,
          lng: 78.3669
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid category');
    });
  });

  describe('getIssues', () => {
    beforeEach(() => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);
    });

    test('should get issues with filters', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          issue_id: 'test-issue-id',
          reporter_user_id: 'test-user-id',
          reporter_name: 'Test User',
          reporter_profile_pic: 'test-pic.jpg',
          wallet_address: 'test-wallet',
          image_url: '/uploads/test.jpg',
          description: 'Test issue',
          category: 'pothole',
          lat: 17.4362,
          lng: 78.3669,
          region: 'Test Region',
          status: 'open',
          priority_score: 50,
          blockchain_tx_hash: 'mock-tx-hash',
          upvotes: 0,
          downvotes: 0,
          admin_proof_url: null,
          created_at: new Date(),
          updated_at: new Date(),
          distance: 1000
        }]
      });

      const response = await request(app)
        .get('/issues')
        .query({
          lat: 17.4362,
          lng: 78.3669,
          radius: 5000,
          status: 'open'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.issues).toHaveLength(1);
      expect(response.body.issues[0].issue_id).toBe('test-issue-id');
    });

    test('should get issues without filters', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/issues');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.issues).toHaveLength(0);
    });
  });

  describe('getIssueById', () => {
    beforeEach(() => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);
    });

    test('should get issue by ID', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          issue_id: 'test-issue-id',
          reporter_user_id: 'test-user-id',
          reporter_name: 'Test User',
          reporter_profile_pic: 'test-pic.jpg',
          wallet_address: 'test-wallet',
          image_url: '/uploads/test.jpg',
          description: 'Test issue',
          category: 'pothole',
          lat: 17.4362,
          lng: 78.3669,
          region: 'Test Region',
          status: 'open',
          priority_score: 50,
          blockchain_tx_hash: 'mock-tx-hash',
          upvotes: 0,
          downvotes: 0,
          admin_proof_url: null,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/issue/test-issue-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.issue.issue_id).toBe('test-issue-id');
    });

    test('should return 404 for non-existent issue', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/issue/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Issue not found');
    });
  });
});

describe('User Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    test('should get current user profile', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-user-id',
          provider_id: 'test-provider-id',
          email: 'test@example.com',
          name: 'Test User',
          profile_pic: 'test-pic.jpg',
          wallet_address: 'test-wallet',
          role: 'citizen',
          rep: 100,
          issues_reported: 5,
          issues_resolved: 0,
          total_upvotes: 10,
          verifications_done: 2,
          badges: ['First Reporter'],
          created_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/user/me')
        .set('Authorization', 'Bearer mock-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.user_id).toBe('test-user-id');
    });

    test('should return 404 for non-existent user', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/user/me')
        .set('Authorization', 'Bearer mock-jwt-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('getUserById', () => {
    test('should get user by ID', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-user-id',
          provider_id: 'test-provider-id',
          name: 'Test User',
          profile_pic: 'test-pic.jpg',
          wallet_address: 'test-wallet',
          role: 'citizen',
          rep: 100,
          issues_reported: 5,
          issues_resolved: 0,
          total_upvotes: 10,
          verifications_done: 2,
          badges: ['First Reporter'],
          created_at: new Date()
        }]
      });

      const response = await request(app)
        .get('/user/test-user-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.user_id).toBe('test-user-id');
    });

    test('should return 404 for non-existent user', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/user/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });
});

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('should login with valid credentials', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      // Mock user lookup
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          profile_pic: 'test-pic.jpg',
          wallet_address: 'test-wallet',
          role: 'citizen',
          rep: 100,
          issues_reported: 5,
          issues_resolved: 0,
          total_upvotes: 10,
          verifications_done: 2,
          badges: ['First Reporter'],
          created_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          profile_pic: 'test-pic.jpg',
          provider_id: 'test-provider-id'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
    });

    test('should return error for missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          name: 'Test User',
          profile_pic: 'test-pic.jpg'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email is required');
    });
  });
});
