# Contributing to CivicChain Backend

Thank you for your interest in contributing to CivicChain! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on collaboration and learning
- Help maintain a positive environment

## Getting Started

### Prerequisites

- Node.js 16+
- PostgreSQL 14+ with PostGIS
- Git
- Basic knowledge of Express.js and PostgreSQL

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/civicchain-backend.git
cd civicchain-backend
```

3. Install dependencies:
```bash
npm install
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your local configuration
```

5. Set up the database:
```bash
npm run migrate
```

6. Start the development server:
```bash
npm run dev
```

## Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions or modifications

Example: `feature/add-email-notifications`

### Commit Message Guidelines

Use conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add two-factor authentication

fix(issues): resolve priority calculation bug

docs(api): update endpoint documentation
```

### Making Changes

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following the coding standards

3. Test your changes thoroughly

4. Commit your changes:
```bash
git add .
git commit -m "feat(scope): description"
```

5. Push to your fork:
```bash
git push origin feature/your-feature-name
```

6. Create a Pull Request

## Coding Standards

### JavaScript Style Guide

- Use camelCase for variables and functions
- Use PascalCase for classes
- Use UPPER_SNAKE_CASE for constants
- Use 2 spaces for indentation
- Always use semicolons
- Use single quotes for strings
- Add JSDoc comments for functions

Example:
```javascript
/**
 * Calculate priority score for an issue
 * @param {Object} params - Issue parameters
 * @returns {Promise<number>} Priority score
 */
async function calculatePriorityScore(params) {
  const { lat, lng, category } = params;
  // Implementation
  return priorityScore;
}
```

### Database Queries

- Always use parameterized queries to prevent SQL injection
- Use transactions for operations that modify multiple tables
- Handle errors properly with try-catch blocks
- Always release database connections

Example:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Your queries here
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Error Handling

- Always handle errors gracefully
- Return appropriate HTTP status codes
- Provide meaningful error messages
- Log errors for debugging

Example:
```javascript
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error);
  return res.status(500).json({
    success: false,
    error: 'Operation failed',
    details: error.message
  });
}
```

### API Response Format

All responses should follow this structure:

Success:
```javascript
{
  success: true,
  data: { ... }
}
```

Error:
```javascript
{
  success: false,
  error: "Error message"
}
```

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Test edge cases and error conditions
- Aim for >80% code coverage

Example test structure (when tests are implemented):
```javascript
describe('Priority Calculation', () => {
  it('should calculate correct priority score', async () => {
    const score = await calculatePriorityScore({
      lat: 17.38,
      lng: 78.48,
      category: 'pothole',
      reporter_rep: 100
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

## Pull Request Process

1. **Before Creating PR**:
   - Ensure all tests pass
   - Update documentation if needed
   - Rebase on the latest main branch
   - Check for merge conflicts

2. **PR Description Template**:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
```

3. **Review Process**:
   - At least one maintainer approval required
   - Address review comments
   - Keep PR focused and small
   - Respond to feedback promptly

## Areas for Contribution

### High Priority

- [ ] Integration with actual AI classification service
- [ ] Solana smart contract implementation
- [ ] Unit and integration tests
- [ ] Rate limiting implementation
- [ ] Email notification system
- [ ] WebSocket support for real-time updates

### Medium Priority

- [ ] API documentation improvements
- [ ] Performance optimization
- [ ] Caching layer (Redis)
- [ ] Advanced search and filtering
- [ ] Analytics and reporting features

### Good First Issues

- [ ] Add input validation improvements
- [ ] Improve error messages
- [ ] Add more detailed logging
- [ ] Write additional tests
- [ ] Documentation improvements

## Project Structure

```
civicchain-backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js
│   │   ├── migrations.js
│   │   └── solana.js
│   ├── controllers/     # Request handlers
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── issueController.js
│   │   ├── voteController.js
│   │   ├── verificationController.js
│   │   └── adminController.js
│   ├── middleware/      # Express middleware
│   │   └── auth.js
│   ├── routes/          # API routes
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── issueRoutes.js
│   │   └── adminRoutes.js
│   ├── services/        # Business logic (future)
│   ├── utils/           # Utility functions
│   │   ├── priority.js
│   │   └── reputation.js
│   └── server.js        # Entry point
├── uploads/             # File uploads
├── .env.example         # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Database Schema Updates

When modifying the database schema:

1. Update `src/config/migrations.js`
2. Test migrations on a clean database
3. Document schema changes in PR description
4. Update API documentation if affected

## Documentation

- Keep README.md up to date
- Update API_DOCUMENTATION.md for endpoint changes
- Add JSDoc comments to new functions
- Update deployment guide if needed

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for general questions
- Check existing issues and documentation first

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to CivicChain! 🎉
