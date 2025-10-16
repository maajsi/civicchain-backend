# Database Schema Documentation

This document provides detailed information about the CivicChain PostgreSQL database schema.

## Database: `civicchain`

### Required Extensions
- `uuid-ossp` - For UUID generation
- `postgis` - For geographic data types and spatial queries

## Tables

### 1. `users` Table

Stores user account information, reputation, and statistics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | PRIMARY KEY | Unique user identifier (auto-generated) |
| `privy_user_id` | VARCHAR(255) | UNIQUE, NOT NULL | Privy authentication service user ID |
| `wallet_address` | VARCHAR(255) | UNIQUE, NOT NULL | Solana wallet address (public key) |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User's email address from OAuth |
| `name` | VARCHAR(255) | NOT NULL | User's full name from OAuth |
| `profile_pic` | TEXT | | URL to user's profile picture |
| `role` | ENUM(user_role) | NOT NULL, DEFAULT 'citizen' | User role: 'citizen' or 'government' |
| `rep` | INTEGER | NOT NULL, DEFAULT 100 | User's reputation score (min: 0) |
| `issues_reported` | INTEGER | NOT NULL, DEFAULT 0 | Total number of issues reported by user |
| `issues_resolved` | INTEGER | NOT NULL, DEFAULT 0 | Total number of issues resolved (for government users) |
| `total_upvotes` | INTEGER | NOT NULL, DEFAULT 0 | Total upvotes received on reported issues |
| `verifications_done` | INTEGER | NOT NULL, DEFAULT 0 | Total number of verifications performed |
| `badges` | TEXT[] | DEFAULT '{}' | Array of earned badge names |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_wallet_address` on `wallet_address`
- `idx_users_privy_user_id` on `privy_user_id`

**Business Rules:**
- New users start with 100 reputation points
- Reputation cannot go below 0
- Only one account per email address
- Wallet address must be unique

---

### 2. `issues` Table

Stores civic issue reports with location data and status tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `issue_id` | UUID | PRIMARY KEY | Unique issue identifier (auto-generated) |
| `reporter_user_id` | UUID | FOREIGN KEY → users(user_id) | User who reported the issue |
| `wallet_address` | VARCHAR(255) | NOT NULL | Reporter's wallet address (denormalized) |
| `image_url` | TEXT | NOT NULL | Path to uploaded issue image |
| `description` | TEXT | NOT NULL | Detailed description of the issue |
| `category` | ENUM(issue_category) | NOT NULL | Issue category (see below) |
| `location` | GEOGRAPHY(POINT, 4326) | NOT NULL | Geographic coordinates (lat, lng) |
| `region` | VARCHAR(255) | | Optional area/ward name |
| `status` | ENUM(issue_status) | DEFAULT 'open' | Current status (see below) |
| `priority_score` | FLOAT | DEFAULT 0 | Calculated priority score (0-100) |
| `blockchain_tx_hash` | VARCHAR(255) | | Solana transaction hash |
| `upvotes` | INTEGER | DEFAULT 0 | Number of upvotes |
| `downvotes` | INTEGER | DEFAULT 0 | Number of downvotes |
| `admin_proof_url` | TEXT | | Government-uploaded resolution proof image |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Issue creation timestamp |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Enums:**
- `issue_category`: 'pothole', 'garbage', 'streetlight', 'water', 'other'
- `issue_status`: 'open', 'in_progress', 'resolved', 'closed'

**Indexes:**
- `idx_issues_reporter` on `reporter_user_id`
- `idx_issues_status` on `status`
- `idx_issues_category` on `category`
- `idx_issues_priority_score` on `priority_score DESC`
- `idx_issues_location` (GIST) on `location` - for spatial queries
- `idx_issues_created_at` on `created_at DESC`

**Business Rules:**
- Category urgency scores: pothole=8, water=9, garbage=6, streetlight=4, other=5
- Priority score recalculated on: creation, upvote/downvote, daily batch
- Location uses WGS84 coordinate system (SRID 4326)
- CASCADE delete when reporter user is deleted

---

### 3. `votes` Table

Tracks user votes (upvotes and downvotes) on issues.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `vote_id` | UUID | PRIMARY KEY | Unique vote identifier (auto-generated) |
| `user_id` | UUID | FOREIGN KEY → users(user_id) | User who cast the vote |
| `issue_id` | UUID | FOREIGN KEY → issues(issue_id) | Issue being voted on |
| `vote_type` | ENUM(vote_type) | NOT NULL | 'upvote' or 'downvote' |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Vote timestamp |

**Unique Constraint:**
- `(user_id, issue_id)` - Each user can only vote once per issue

**Enums:**
- `vote_type`: 'upvote', 'downvote'

**Indexes:**
- `idx_votes_user` on `user_id`
- `idx_votes_issue` on `issue_id`

**Business Rules:**
- Users cannot vote on their own issues
- One vote per user per issue (no changing votes)
- Upvote: reporter gains +5 reputation
- Downvote: reporter loses -3 reputation
- CASCADE delete when user or issue is deleted

---

### 4. `verifications` Table

Tracks citizen verifications of resolved issues.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `verification_id` | UUID | PRIMARY KEY | Unique verification identifier |
| `user_id` | UUID | FOREIGN KEY → users(user_id) | User who verified |
| `issue_id` | UUID | FOREIGN KEY → issues(issue_id) | Issue being verified |
| `verified_at` | TIMESTAMP | DEFAULT NOW() | Verification timestamp |

**Unique Constraint:**
- `(user_id, issue_id)` - Each user can only verify once per issue

**Indexes:**
- `idx_verifications_user` on `user_id`
- `idx_verifications_issue` on `issue_id`

**Business Rules:**
- Only citizens can verify (not government users)
- Issue must be in 'resolved' status to verify
- Reporter gains +10 reputation per verification
- Verifier gains +5 reputation
- Auto-close issue after 3 verifications
- CASCADE delete when user or issue is deleted

---

## Relationships

```
users (1) ─────< (N) issues
  │                    │
  │                    │
  └──< (N) votes (N) >─┘
  │                    │
  │                    │
  └──< (N) verifications (N) >─┘
```

- One user can report many issues
- One user can cast many votes
- One issue can receive many votes
- One user can perform many verifications
- One issue can receive many verifications
- Each vote/verification belongs to one user and one issue

---

## Spatial Queries

### Find issues within radius
```sql
SELECT *
FROM issues
WHERE ST_DWithin(
  location,
  ST_MakePoint(:lng, :lat)::geography,
  :radius_in_meters
)
ORDER BY priority_score DESC;
```

### Calculate distance to issue
```sql
SELECT 
  *,
  ST_Distance(
    location,
    ST_MakePoint(:lng, :lat)::geography
  ) AS distance_meters
FROM issues
ORDER BY distance_meters ASC;
```

### Count issues in area (for density calculation)
```sql
SELECT COUNT(*) 
FROM issues
WHERE ST_DWithin(
  location,
  ST_MakePoint(:lng, :lat)::geography,
  100  -- 100 meters
)
AND created_at > NOW() - INTERVAL '30 days';
```

---

## Priority Score Calculation

The priority score (0-100) is calculated using:

**Formula:**
```
Priority = (2.5 × LD) + (2.0 × RR) + (2.0 × UR) + (2.5 × CU) + (1.0 × TF)
```

**Components:**
- **LD (Location Density)**: Issues within 100m in last 30 days (capped at 10)
- **RR (Reporter Reputation)**: Reporter's rep / 10 (capped at 10)
- **UR (Upvote Rep Sum)**: Sum of upvoters' rep / 100 (capped at 10)
- **CU (Category Urgency)**: Category score (4-9)
- **TF (Time Factor)**: Days since creation (capped at 10)

**Example Query:**
```sql
SELECT 
  i.*,
  (
    (2.5 * LEAST((
      SELECT COUNT(*) 
      FROM issues i2 
      WHERE ST_DWithin(i2.location, i.location, 100)
      AND i2.created_at > NOW() - INTERVAL '30 days'
    ), 10)) +
    (2.0 * LEAST(u.rep / 10.0, 10)) +
    (2.0 * LEAST(COALESCE((
      SELECT SUM(u2.rep) 
      FROM votes v 
      JOIN users u2 ON v.user_id = u2.user_id 
      WHERE v.issue_id = i.issue_id 
      AND v.vote_type = 'upvote'
    ), 0) / 100.0, 10)) +
    (2.5 * CASE i.category 
      WHEN 'water' THEN 9
      WHEN 'pothole' THEN 8
      WHEN 'garbage' THEN 6
      WHEN 'streetlight' THEN 4
      ELSE 5
    END) +
    (1.0 * LEAST(EXTRACT(DAY FROM NOW() - i.created_at), 10))
  ) AS calculated_priority
FROM issues i
JOIN users u ON i.reporter_user_id = u.user_id;
```

---

## Reputation System

### Reputation Changes

| Event | Reporter Change | Voter/Verifier Change |
|-------|----------------|----------------------|
| Upvote received | +5 | 0 |
| Downvote received | -3 | 0 |
| Issue verified (resolved) | +10 per verification | +5 per verification |
| Issue marked spam/fake | -20 | 0 |

### Badge Requirements

| Badge | Requirement |
|-------|-------------|
| "First Reporter" | 1+ issues reported |
| "Top Reporter" | 10+ issues reported |
| "Civic Hero" | 50+ issues reported |
| "Verifier" | 10+ verifications done |
| "Trusted Voice" | Reputation ≥ 200 |

---

## Maintenance Queries

### Daily Priority Score Update
```sql
-- Should be run as a cron job
UPDATE issues
SET priority_score = [calculated_priority]
WHERE status IN ('open', 'in_progress');
```

### Clean Old Issues
```sql
-- Archive or delete very old closed issues
DELETE FROM issues
WHERE status = 'closed'
AND updated_at < NOW() - INTERVAL '2 years';
```

### User Statistics Update
```sql
-- Verify user statistics are correct
UPDATE users u
SET 
  issues_reported = (SELECT COUNT(*) FROM issues WHERE reporter_user_id = u.user_id),
  total_upvotes = (SELECT COALESCE(SUM(upvotes), 0) FROM issues WHERE reporter_user_id = u.user_id),
  verifications_done = (SELECT COUNT(*) FROM verifications WHERE user_id = u.user_id);
```

---

## Backup and Restore

### Backup
```bash
pg_dump -U postgres -d civicchain -F c -b -v -f civicchain_backup.dump
```

### Restore
```bash
pg_restore -U postgres -d civicchain -v civicchain_backup.dump
```

---

## Performance Considerations

1. **Spatial Indexes**: GIST index on `location` enables fast proximity queries
2. **Partial Indexes**: Consider adding partial indexes for active issues:
   ```sql
   CREATE INDEX idx_active_issues ON issues(priority_score DESC) 
   WHERE status IN ('open', 'in_progress');
   ```
3. **Materialized Views**: For dashboard statistics:
   ```sql
   CREATE MATERIALIZED VIEW issue_stats AS
   SELECT 
     category,
     status,
     COUNT(*) as count,
     AVG(priority_score) as avg_priority
   FROM issues
   GROUP BY category, status;
   ```
4. **Connection Pooling**: Max 20 connections configured in application
5. **Query Optimization**: Use EXPLAIN ANALYZE to optimize slow queries

---

## Security Considerations

1. **SQL Injection**: All queries use parameterized statements
2. **Row-Level Security**: Consider enabling for multi-tenancy
3. **Encryption**: Use SSL for database connections in production
4. **Backup Encryption**: Encrypt backup files
5. **Access Control**: Limit database user permissions
