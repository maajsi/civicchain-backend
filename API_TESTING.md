# API Testing Guide

This document provides examples for testing all CivicChain Backend API endpoints using `curl` or other HTTP clients.

## Prerequisites

1. Server running: `npm start` or `npm run dev`
2. Database set up and migrations run: `npm run migrate`
3. Valid JWT token (obtain from `/api/auth/login`)

## Base URL
```
http://localhost:3000
```

## 1. Health Check

**No authentication required**

```bash
curl -X GET http://localhost:3000/health
```

## 2. Authentication

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "name": "John Doe",
    "profile_pic": "https://lh3.googleusercontent.com/a/default-user"
  }'
```

**Response:**
```json
{
  "success": true,
  "is_new": true,
  "user": {
    "user_id": "...",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "wallet_address": "...",
    "role": "citizen",
    "rep": 100,
    ...
  },
  "jwt_token": "eyJhbGciOiJIUzI1..."
}
```

**Save the JWT token for subsequent requests!**

## 3. User Endpoints

### Get Current User Profile
```bash
curl -X GET http://localhost:3000/api/user/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get User by ID
```bash
curl -X GET http://localhost:3000/api/user/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 4. Issue Endpoints

### Classify Image
```bash
curl -X POST http://localhost:3000/api/issue/classify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

**Response:**
```json
{
  "success": true,
  "suggested_category": "pothole",
  "urgency_score": 8,
  "image_url": "/uploads/1234567890-uuid.jpg"
}
```

### Report Issue
```bash
curl -X POST http://localhost:3000/api/issue/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "/uploads/1234567890-uuid.jpg",
    "description": "Large pothole on Main Street causing traffic issues",
    "category": "pothole",
    "lat": 17.385044,
    "lng": 78.486671,
    "region": "Hyderabad"
  }'
```

### Get Issues with Filters
```bash
# Get all issues near a location
curl -X GET "http://localhost:3000/api/issues?lat=17.385044&lng=78.486671&radius=5000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by category
curl -X GET "http://localhost:3000/api/issues?category=pothole" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by status
curl -X GET "http://localhost:3000/api/issues?status=open" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Combined filters
curl -X GET "http://localhost:3000/api/issues?lat=17.385044&lng=78.486671&radius=10000&category=pothole&status=open" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Issue by ID
```bash
curl -X GET http://localhost:3000/api/issue/ISSUE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Upvote Issue
```bash
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/upvote \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Downvote Issue
```bash
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/downvote \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Verify Issue (Citizen only)
```bash
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'
```

### Update Issue Status (Government only)
```bash
# With status only
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/update-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "status=resolved"

# With status and proof image
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/update-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "status=resolved" \
  -F "proof_image=@/path/to/proof.jpg"
```

## 5. Admin Endpoints (Government users only)

### Get Dashboard Statistics
```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "open_issues": 45,
    "in_progress_issues": 12,
    "resolved_issues": 78,
    "closed_issues": 120,
    "total_issues": 255,
    "avg_priority_score": 42.5,
    "category_breakdown": [...],
    "recent_activity": {...}
  },
  "heatmap_data": [...],
  "top_priority_issues": [...]
}
```

### Get All Issues (with filters)
```bash
# Basic request
curl -X GET http://localhost:3000/api/admin/issues \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# With filters
curl -X GET "http://localhost:3000/api/admin/issues?status=open&category=pothole&page=1&limit=20&sort_by=priority_score" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Date range filter
curl -X GET "http://localhost:3000/api/admin/issues?date_from=2024-01-01&date_to=2024-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Testing Flow Example

### Complete User Journey

1. **Login as a citizen:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen@example.com",
    "name": "Test Citizen",
    "profile_pic": ""
  }' | jq -r '.jwt_token')

echo "Token: $TOKEN"
```

2. **Upload and classify an image:**
```bash
curl -X POST http://localhost:3000/api/issue/classify \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@./test-images/pothole.jpg"
```

3. **Report the issue:**
```bash
curl -X POST http://localhost:3000/api/issue/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "/uploads/IMAGE_NAME.jpg",
    "description": "Dangerous pothole needs immediate attention",
    "category": "pothole",
    "lat": 17.385044,
    "lng": 78.486671
  }'
```

4. **Get nearby issues:**
```bash
curl -X GET "http://localhost:3000/api/issues?lat=17.385044&lng=78.486671&radius=5000" \
  -H "Authorization: Bearer $TOKEN"
```

5. **Upvote an issue (as another user):**
```bash
# Login as another user first
TOKEN2=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen2@example.com",
    "name": "Test Citizen 2",
    "profile_pic": ""
  }' | jq -r '.jwt_token')

curl -X POST http://localhost:3000/api/issue/ISSUE_ID/upvote \
  -H "Authorization: Bearer $TOKEN2"
```

6. **Government user updates status:**
```bash
# Login as government user
GOV_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gov.example.com",
    "name": "Government Admin",
    "profile_pic": ""
  }' | jq -r '.jwt_token')

# Note: You'll need to manually set role to 'government' in database
# UPDATE users SET role = 'government' WHERE email = 'admin@gov.example.com';

curl -X POST http://localhost:3000/api/issue/ISSUE_ID/update-status \
  -H "Authorization: Bearer $GOV_TOKEN" \
  -F "status=resolved" \
  -F "proof_image=@./test-images/resolved.jpg"
```

7. **Citizen verifies resolution:**
```bash
curl -X POST http://localhost:3000/api/issue/ISSUE_ID/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Notes

- JWT tokens expire after 7 days (configurable in `.env`)
- File uploads are limited to 10MB by default
- Accepted image formats: JPEG, PNG, WebP
- All coordinates use WGS84 (SRID 4326)
- Distances are in meters
- Priority scores range from 0-100
- Reputation cannot go below 0
