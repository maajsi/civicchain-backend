// Test services
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Mock the services
jest.mock('../src/services/aiService');
jest.mock('../src/services/solanaService');

const { classifyImageWithAI, normalizeCategory } = require('../src/services/aiService');
const { 
  createUserOnChain, 
  createIssueOnChain, 
  recordVoteOnChain, 
  recordVerificationOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain 
} = require('../src/services/solanaService');

describe('AI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should classify image with valid response', async () => {
    const mockResponse = {
      data: {
        predictions: [
          { class: 'pothole', confidence: 0.95 }
        ]
      }
    };

    axios.mockResolvedValueOnce(mockResponse);
    classifyImageWithAI.mockResolvedValueOnce('pothole');

    const result = await classifyImageWithAI('/path/to/image.jpg');
    expect(result).toBe('pothole');
  });

  test('should handle empty predictions', async () => {
    const mockResponse = {
      data: {
        predictions: []
      }
    };

    axios.mockResolvedValueOnce(mockResponse);
    classifyImageWithAI.mockResolvedValueOnce('other');

    const result = await classifyImageWithAI('/path/to/image.jpg');
    expect(result).toBe('other');
  });

  test('should handle multiple predictions', async () => {
    const mockResponse = {
      data: {
        predictions: [
          { class: 'pothole', confidence: 0.8 },
          { class: 'garbage', confidence: 0.9 }
        ]
      }
    };

    axios.mockResolvedValueOnce(mockResponse);
    classifyImageWithAI.mockResolvedValueOnce('garbage');

    const result = await classifyImageWithAI('/path/to/image.jpg');
    expect(result).toBe('garbage');
  });

  test('should normalize category correctly', () => {
    expect(normalizeCategory('Pothole')).toBe('pothole');
    expect(normalizeCategory('GARBAGE')).toBe('garbage');
    expect(normalizeCategory('Street Light')).toBe('streetlight');
    expect(normalizeCategory('Water Issue')).toBe('water');
    expect(normalizeCategory('Unknown')).toBe('other');
  });

  test('should handle AI service errors gracefully', async () => {
    axios.mockRejectedValueOnce(new Error('AI service unavailable'));
    classifyImageWithAI.mockRejectedValueOnce(new Error('AI service unavailable'));

    await expect(classifyImageWithAI('/path/to/image.jpg')).rejects.toThrow('AI service unavailable');
  });
});

describe('Solana Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create user on chain', async () => {
    const mockTxHash = 'mock-transaction-hash';
    createUserOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await createUserOnChain('publicKey', 100, 'citizen', 'privateKey');
    expect(result).toBe(mockTxHash);
    expect(createUserOnChain).toHaveBeenCalledWith('publicKey', 100, 'citizen', 'privateKey');
  });

  test('should create issue on chain', async () => {
    const mockTxHash = 'mock-issue-tx-hash';
    createIssueOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await createIssueOnChain('privateKey', 'issueId', 'pothole', 75);
    expect(result).toBe(mockTxHash);
    expect(createIssueOnChain).toHaveBeenCalledWith('privateKey', 'issueId', 'pothole', 75);
  });

  test('should record vote on chain', async () => {
    const mockTxHash = 'mock-vote-tx-hash';
    recordVoteOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await recordVoteOnChain('voterPublicKey', 'voterPrivateKey', 'issueId', 'reporterPublicKey', 'upvote');
    expect(result).toBe(mockTxHash);
    expect(recordVoteOnChain).toHaveBeenCalledWith('voterPublicKey', 'voterPrivateKey', 'issueId', 'reporterPublicKey', 'upvote');
  });

  test('should record verification on chain', async () => {
    const mockTxHash = 'mock-verification-tx-hash';
    recordVerificationOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await recordVerificationOnChain('verifierPublicKey', 'verifierPrivateKey', 'issueId', 'reporterPublicKey');
    expect(result).toBe(mockTxHash);
    expect(recordVerificationOnChain).toHaveBeenCalledWith('verifierPublicKey', 'verifierPrivateKey', 'issueId', 'reporterPublicKey');
  });

  test('should update issue status on chain', async () => {
    const mockTxHash = 'mock-status-tx-hash';
    updateIssueStatusOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await updateIssueStatusOnChain('governmentPublicKey', 'governmentPrivateKey', 'issueId', 'resolved');
    expect(result).toBe(mockTxHash);
    expect(updateIssueStatusOnChain).toHaveBeenCalledWith('governmentPublicKey', 'governmentPrivateKey', 'issueId', 'resolved');
  });

  test('should update reputation on chain', async () => {
    const mockTxHash = 'mock-reputation-tx-hash';
    updateReputationOnChain.mockResolvedValueOnce(mockTxHash);

    const result = await updateReputationOnChain('walletAddress', 250);
    expect(result).toBe(mockTxHash);
    expect(updateReputationOnChain).toHaveBeenCalledWith('walletAddress', 250);
  });

  test('should handle blockchain errors gracefully', async () => {
    const error = new Error('Blockchain transaction failed');
    createUserOnChain.mockRejectedValueOnce(error);

    await expect(createUserOnChain('publicKey', 100, 'citizen', 'privateKey')).rejects.toThrow('Blockchain transaction failed');
  });

  test('should handle missing blockchain configuration', async () => {
    createIssueOnChain.mockResolvedValueOnce(null);

    const result = await createIssueOnChain('privateKey', 'issueId', 'pothole', 75);
    expect(result).toBeNull();
  });
});

describe('Service Integration', () => {
  test('should handle service dependencies correctly', async () => {
    // Test that services can work together
    const mockImagePath = '/path/to/image.jpg';
    const mockIssueId = 'test-issue-id';
    const mockPrivateKey = 'test-private-key';

    // Mock AI service
    classifyImageWithAI.mockResolvedValueOnce('pothole');
    
    // Mock Solana service
    createIssueOnChain.mockResolvedValueOnce('mock-tx-hash');

    // Test the flow
    const category = await classifyImageWithAI(mockImagePath);
    expect(category).toBe('pothole');

    const txHash = await createIssueOnChain(mockPrivateKey, mockIssueId, category, 75);
    expect(txHash).toBe('mock-tx-hash');
  });

  test('should handle service failures gracefully', async () => {
    // Test that one service failure doesn't break the entire flow
    classifyImageWithAI.mockRejectedValueOnce(new Error('AI service down'));
    createIssueOnChain.mockResolvedValueOnce('mock-tx-hash');

    // AI service fails but Solana service still works
    await expect(classifyImageWithAI('/path/to/image.jpg')).rejects.toThrow('AI service down');
    
    const txHash = await createIssueOnChain('privateKey', 'issueId', 'pothole', 75);
    expect(txHash).toBe('mock-tx-hash');
  });
});