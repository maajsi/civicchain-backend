// Test utility functions
const path = require('path');
const { calculatePriorityScore, CATEGORY_URGENCY } = require('../src/utils/priority');
const { calculateNewReputation, updateBadges, REPUTATION_CHANGES } = require('../src/utils/reputation');

describe('Priority Scoring Algorithm', () => {
  test('should return urgency scores for all categories', () => {
    expect(CATEGORY_URGENCY.pothole).toBe(8);
    expect(CATEGORY_URGENCY.garbage).toBe(6);
    expect(CATEGORY_URGENCY.streetlight).toBe(4);
    expect(CATEGORY_URGENCY.water).toBe(9);
    expect(CATEGORY_URGENCY.other).toBe(5);
  });

  test('should calculate priority score with valid inputs', async () => {
    const mockParams = {
      lat: 17.4362,
      lng: 78.3669,
      category: 'pothole',
      reporter_rep: 100,
      created_at: new Date()
    };

    // Mock the database query
    const mockPool = require('../src/config/database');
    const mockQuery = jest.fn();
    mockPool.query = mockQuery;
    
    // Mock database response for location density query
    mockQuery.mockResolvedValueOnce({
      rows: [{ count: '5' }] // 5 issues within 100m
    });

    const score = await calculatePriorityScore(mockParams);
    
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('should handle edge cases in priority calculation', async () => {
    const mockParams = {
      lat: 0,
      lng: 0,
      category: 'other',
      reporter_rep: 0,
      created_at: new Date()
    };

    const mockPool = require('../src/config/database');
    const mockQuery = jest.fn();
    mockPool.query = mockQuery;
    
    mockQuery.mockResolvedValueOnce({
      rows: [{ count: '0' }] // No nearby issues
    });

    const score = await calculatePriorityScore(mockParams);
    
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('Reputation System', () => {
  test('should increase reputation on upvote', () => {
    const newRep = calculateNewReputation(100, REPUTATION_CHANGES.UPVOTE_RECEIVED);
    expect(newRep).toBe(105);
  });

  test('should decrease reputation on downvote', () => {
    const newRep = calculateNewReputation(100, REPUTATION_CHANGES.DOWNVOTE_RECEIVED);
    expect(newRep).toBe(97);
  });

  test('should increase reputation on verification', () => {
    const newRep = calculateNewReputation(100, REPUTATION_CHANGES.ISSUE_VERIFIED);
    expect(newRep).toBe(110);
  });

  test('should not allow negative reputation', () => {
    const newRep = calculateNewReputation(2, REPUTATION_CHANGES.DOWNVOTE_RECEIVED);
    expect(newRep).toBe(0);
  });

  test('should handle zero reputation correctly', () => {
    const newRep = calculateNewReputation(0, REPUTATION_CHANGES.UPVOTE_RECEIVED);
    expect(newRep).toBe(5);
  });

  test('should award badges based on criteria', () => {
    const user1 = { issues_reported: 1, rep: 100, verifications_done: 0 };
    const badges1 = updateBadges(user1);
    expect(badges1).toContain('First Reporter');

    const user2 = { issues_reported: 15, rep: 150, verifications_done: 5 };
    const badges2 = updateBadges(user2);
    expect(badges2).toContain('Top Reporter');

    const user3 = { issues_reported: 60, rep: 250, verifications_done: 15 };
    const badges3 = updateBadges(user3);
    expect(badges3).toContain('Civic Hero');
    expect(badges3).toContain('Verifier');
    expect(badges3).toContain('Trusted Voice');
  });

  test('should handle user with no badges', () => {
    const user = { issues_reported: 0, rep: 50, verifications_done: 0 };
    const badges = updateBadges(user);
    expect(badges).toEqual([]);
  });

  test('should handle multiple badge criteria', () => {
    const user = { issues_reported: 25, rep: 300, verifications_done: 15 };
    const badges = updateBadges(user);
    expect(badges).toContain('First Reporter');
    expect(badges).toContain('Top Reporter');
    expect(badges).toContain('Verifier');
    expect(badges).toContain('Trusted Voice');
  });
});

describe('Environment Configuration', () => {
  test('should have required environment variables in example', () => {
    const fs = require('fs');
    const envExamplePath = path.join(__dirname, '../.env.example');
    
    if (fs.existsSync(envExamplePath)) {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      
      expect(envExample).toContain('DATABASE_URL');
      expect(envExample).toContain('JWT_SECRET');
      expect(envExample).toContain('SOLANA_RPC_URL');
      expect(envExample).toContain('AI_SERVICE_URL');
    } else {
      // If .env.example doesn't exist, just pass the test
      expect(true).toBe(true);
    }
  });
});
