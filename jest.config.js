module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!**/node_modules/**',
  ],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 10000,
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 15,
      lines: 5,
      statements: 5,
    },
  },
};
