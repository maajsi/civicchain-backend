# Contributing to CivicChain Backend

Thank you for your interest in contributing to CivicChain! This document provides guidelines and instructions for contributing to the backend repository.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/civicchain-backend.git
   cd civicchain-backend
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/maajsi/civicchain-backend.git
   ```
4. **Set up the development environment** following `SETUP.md`

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates

### 2. Make Your Changes

- Follow the existing code style
- Write clear, concise commit messages
- Add comments for complex logic
- Update documentation as needed

### 3. Test Your Changes

```bash
# Check environment
npm run check-env

# Run migrations if you modified the schema
npm run migrate

# Start the server
npm run dev

# Test your changes manually or with automated tests
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference to related issues
- Screenshots (if applicable)
- Test results

## Code Style Guidelines

### JavaScript/Node.js

```javascript
// Use meaningful variable names
const userRepository = new UserRepository();

// Use async/await over callbacks
async function getUserById(id) {
  try {
    const user = await db.query('SELECT * FROM users WHERE user_id = $1', [id]);
    return user.rows[0];
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

// Use destructuring
const { email, name, role } = req.body;

// Use template literals
console.log(`User ${name} logged in with role ${role}`);

// Handle errors properly
if (!user) {
  return res.status(404).json({
    success: false,
    error: 'User not found'
  });
}
```

### Database Queries

```javascript
// Always use parameterized queries
const result = await db.query(
  'SELECT * FROM issues WHERE status = $1 AND category = $2',
  [status, category]
);

// Use meaningful query comments for complex queries
const issues = await db.query(`
  -- Get issues with priority scores and reporter info
  SELECT 
    i.*,
    u.name as reporter_name,
    u.rep as reporter_rep
  FROM issues i
  JOIN users u ON i.reporter_user_id = u.user_id
  WHERE i.status = $1
  ORDER BY i.priority_score DESC
`, [status]);
```

### API Responses

All API responses should follow this format:

```javascript
// Success response
return res.json({
  success: true,
  data: result,
  message: 'Optional success message'
});

// Error response
return res.status(400).json({
  success: false,
  error: 'Error message',
  details: 'Optional detailed error info'
});
```

## Adding New Features

### Adding a New Endpoint

1. **Create controller function** in appropriate controller file:
   ```javascript
   // src/controllers/issueController.js
   async function newFunction(req, res) {
     try {
       // Implementation
       return res.json({ success: true, data: result });
     } catch (error) {
       console.error('Error:', error);
       return res.status(500).json({ success: false, error: 'Error message' });
     }
   }
   ```

2. **Add route** in appropriate route file:
   ```javascript
   // src/routes/issue.js
   router.get('/new-endpoint', authenticateToken, issueController.newFunction);
   ```

3. **Update API documentation** in `API_TESTING.md`

4. **Test the endpoint** thoroughly

### Adding Database Schema Changes

1. **Create new migration file**:
   ```javascript
   // src/db/migrations/005_add_new_table.js
   async function up() {
     await db.query(`
       CREATE TABLE new_table (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         ...
       );
     `);
   }
   
   async function down() {
     await db.query(`DROP TABLE IF EXISTS new_table;`);
   }
   ```

2. **Test migration**:
   ```bash
   npm run migrate
   ```

3. **Update `DATABASE_SCHEMA.md`**

### Adding Utility Functions

1. Create or update file in `src/utils/`
2. Export functions properly
3. Add JSDoc comments
4. Test thoroughly

## Testing Guidelines

### Manual Testing

1. Test happy path scenarios
2. Test error scenarios
3. Test edge cases
4. Test with different user roles
5. Verify database changes
6. Check blockchain interactions (if applicable)

### Testing Checklist

- [ ] Endpoint returns correct status codes
- [ ] Response format matches API spec
- [ ] Data is saved correctly to database
- [ ] Error handling works properly
- [ ] Authentication/authorization works
- [ ] No SQL injection vulnerabilities
- [ ] No sensitive data exposure
- [ ] Proper logging

## Database Guidelines

### Migrations

- Always create reversible migrations
- Test both `up()` and `down()` functions
- Use transactions for complex migrations
- Never modify existing migration files

### Queries

- Use parameterized queries (never string concatenation)
- Add appropriate indexes for new columns
- Use transactions for multi-step operations
- Consider performance for large datasets

### PostGIS

- Use `geography` type for coordinates
- Always specify SRID (4326 for WGS84)
- Use appropriate spatial indexes (GIST)
- Test distance calculations

## Security Guidelines

- Never commit secrets or credentials
- Always validate user input
- Use parameterized queries
- Implement proper authentication/authorization
- Rate limit sensitive endpoints
- Log security-relevant events
- Keep dependencies updated

## Documentation

- Update README.md for new features
- Update API_TESTING.md for new endpoints
- Update DATABASE_SCHEMA.md for schema changes
- Add inline comments for complex code
- Use JSDoc for function documentation

## Pull Request Process

1. **Update documentation** relevant to your changes
2. **Test thoroughly** on your local environment
3. **Update CHANGELOG.md** (if exists) with your changes
4. **Create pull request** with clear description
5. **Address review comments** promptly
6. **Ensure CI passes** (if configured)

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] Updated documentation

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
```

## Getting Help

- Check existing issues on GitHub
- Review documentation in the repository
- Ask questions in pull request comments
- Contact maintainers

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Project documentation
- Release notes

Thank you for contributing to CivicChain! 🎉
