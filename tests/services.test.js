// Test AI service functionality
const { normalizeCategory } = require('../src/services/aiService');

describe('AI Service', () => {
  describe('Category Normalization', () => {
    test('should normalize pothole variations', () => {
      expect(normalizeCategory('pothole')).toBe('pothole');
      expect(normalizeCategory('potholes')).toBe('pothole');
      expect(normalizeCategory('POTHOLE')).toBe('pothole');
    });

    test('should normalize garbage variations', () => {
      expect(normalizeCategory('garbage')).toBe('garbage');
      expect(normalizeCategory('trash')).toBe('garbage');
      expect(normalizeCategory('waste')).toBe('garbage');
    });

    test('should normalize streetlight variations', () => {
      expect(normalizeCategory('streetlight')).toBe('streetlight');
      expect(normalizeCategory('street_light')).toBe('streetlight');
      expect(normalizeCategory('light')).toBe('streetlight');
    });

    test('should normalize water variations', () => {
      expect(normalizeCategory('water')).toBe('water');
      expect(normalizeCategory('water_leak')).toBe('water');
      expect(normalizeCategory('water_main')).toBe('water');
    });

    test('should return other for unknown categories', () => {
      expect(normalizeCategory('unknown')).toBe('other');
      expect(normalizeCategory('random')).toBe('other');
      expect(normalizeCategory('')).toBe('other');
    });
  });
});

describe('Solana Service', () => {
  const solanaService = require('../src/services/solanaService');

  test('should export required functions', () => {
    expect(typeof solanaService.createUserOnChain).toBe('function');
    expect(typeof solanaService.createIssueOnChain).toBe('function');
    expect(typeof solanaService.recordVoteOnChain).toBe('function');
    expect(typeof solanaService.recordVerificationOnChain).toBe('function');
    expect(typeof solanaService.updateIssueStatusOnChain).toBe('function');
    expect(typeof solanaService.updateReputationOnChain).toBe('function');
    expect(typeof solanaService.fundWallet).toBe('function');
    expect(typeof solanaService.getBalance).toBe('function');
  });

  test('should return mock transaction when program not deployed', async () => {
    const mockTx = await solanaService.createUserOnChain('test_wallet', 100, 'citizen');
    expect(mockTx).toBeDefined();
    expect(typeof mockTx).toBe('string');
  });
});
