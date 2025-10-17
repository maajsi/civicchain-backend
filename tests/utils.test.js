// Test utility functions
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
});

describe('Environment Configuration', () => {
  test('should have required environment variables in example', () => {
    const fs = require('fs');
    const envExample = fs.readFileSync('.env.example', 'utf8');
    
    expect(envExample).toContain('DATABASE_URL');
    expect(envExample).toContain('JWT_SECRET');
    expect(envExample).toContain('SOLANA_RPC_URL');
    expect(envExample).toContain('AI_SERVICE_URL');
  });
});
