const { normalizeCategory } = require('../../src/services/aiService');

describe('AI normalizeCategory', () => {
  test('normalizes various inputs to expected categories', () => {
    expect(normalizeCategory('Pothole')).toBe('pothole');
    expect(normalizeCategory('GARBAGE')).toBe('garbage');
    expect(normalizeCategory('Street Light')).toBe('streetlight');
    expect(normalizeCategory('Water Issue')).toBe('water');
    expect(normalizeCategory('some unknown label')).toBe('other');
  });
});
