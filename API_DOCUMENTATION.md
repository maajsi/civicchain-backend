# CivicChain API Complete Reference

## Table of Contents
1. [Authentication](#authentication)
2. [User Endpoints](#user-endpoints)
3. [Issue Endpoints](#issue-endpoints)
4. [Voting Endpoints](#voting-endpoints)
5. [Verification Endpoints](#verification-endpoints)
6. [Admin Endpoints](#admin-endpoints)
7. [Error Handling](#error-handling)
8. [Response Formats](#response-formats)

---

## Authentication

All endpoints except `/auth/login` and `/health` require JWT authentication.

### Headers
```
Authorization: Bearer <jwt_token>
```

---

## Auth Endpoints

### POST /auth/login

Handle Google OAuth login, create or retrieve user, return JWT.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "profile_pic": "https://lh3.googleusercontent.com/..."
}
```

**Response (200 OK - New User):**
```json
{
  "success": true,
  "is_new": true,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "profile_pic": "https://lh3.googleusercontent.com/...",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "role": "citizen",
    "rep": 100,
    "issues_reported": 0,
    "issues_resolved": 0,
    "total_upvotes": 0,
    "verifications_done": 0,
    "badges": [],
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK - Existing User):**
```json
{
  "success": true,
  "is_new": false,
  "user": { ... },
  "jwt_token": "..."
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Authentication failed"
}
```

---

## User Endpoints

### GET /user/me

Get current authenticated user's profile.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "profile_pic": "https://...",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "role": "citizen",
    "rep": 150,
    "issues_reported": 5,
    "issues_resolved": 2,
    "total_upvotes": 15,
    "verifications_done": 8,
    "badges": ["First Reporter", "Verifier"],
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /user/:user_id

Get public profile of any user.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "user_id": "...",
    "name": "John Doe",
    "profile_pic": "...",
    "wallet_address": "...",
    "role": "citizen",
    "rep": 150,
    "issues_reported": 5,
    "issues_resolved": 2,
    "total_upvotes": 15,
    "verifications_done": 8,
    "badges": ["First Reporter", "Verifier"],
    "created_at": "..."
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

---

## Issue Endpoints

### POST /issue/classify

Upload image and get AI classification.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
image: [binary file]
```

**Response (200 OK):**
```json
{
  "success": true,
  "suggested_category": "pothole",
  "urgency_score": 8,
  "image_url": "/uploads/1234567890-xyz.jpg"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "No image file provided"
}
```

### POST /issue/report

Submit final issue report (triggers blockchain transaction).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "image_url": "/uploads/1234567890-xyz.jpg",
  "description": "Large pothole on Main Street causing traffic issues",
  "category": "pothole",
  "lat": 17.38,
  "lng": 78.48,
  "region": "Downtown"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "issue": {
    "issue_id": "abc123...",
    "reporter_user_id": "...",
    "wallet_address": "...",
    "image_url": "/uploads/1234567890-xyz.jpg",
    "description": "Large pothole on Main Street...",
    "category": "pothole",
    "lat": 17.38,
    "lng": 78.48,
    "region": "Downtown",
    "status": "open",
    "priority_score": 45.5,
    "blockchain_tx_hash": "5xKL...",
    "upvotes": 0,
    "downvotes": 0,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /issues

Fetch issues with filters (sorted by priority, then proximity).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `lat` (optional): Latitude for proximity search
- `lng` (optional): Longitude for proximity search
- `radius` (optional): Search radius in meters (default: 5000)
- `category` (optional): Filter by category
- `status` (optional): Filter by status

**Example:**
```
GET /issues?lat=17.38&lng=78.48&radius=3000&category=pothole&status=open
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "issues": [
    {
      "issue_id": "...",
      "reporter_user_id": "...",
      "reporter_name": "John Doe",
      "reporter_profile_pic": "...",
      "wallet_address": "...",
      "image_url": "/uploads/...",
      "description": "...",
      "category": "pothole",
      "lat": 17.38,
      "lng": 78.48,
      "region": "Downtown",
      "status": "open",
      "priority_score": 65.2,
      "blockchain_tx_hash": "...",
      "upvotes": 10,
      "downvotes": 1,
      "admin_proof_url": null,
      "created_at": "...",
      "updated_at": "...",
      "distance": 245.5
    }
  ]
}
```

### GET /issue/:id

Get detailed info about a single issue.

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "issue": {
    "issue_id": "...",
    "reporter_user_id": "...",
    "reporter_name": "John Doe",
    "reporter_profile_pic": "...",
    "reporter_rep": 150,
    "wallet_address": "...",
    "image_url": "/uploads/...",
    "description": "...",
    "category": "pothole",
    "lat": 17.38,
    "lng": 78.48,
    "region": "Downtown",
    "status": "open",
    "priority_score": 65.2,
    "blockchain_tx_hash": "...",
    "upvotes": 10,
    "downvotes": 1,
    "admin_proof_url": null,
    "verification_count": 0,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

## Voting Endpoints

### POST /issue/:id/upvote

Upvote an issue (updates reporter reputation, blockchain tx).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Issue upvoted successfully",
  "issue": {
    "issue_id": "...",
    "upvotes": 11,
    "downvotes": 1,
    "priority_score": 67.3,
    "status": "open"
  },
  "reporter_rep_change": 5,
  "blockchain_tx_hash": "..."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "You have already voted on this issue"
}
```

### POST /issue/:id/downvote

Downvote an issue (updates reporter reputation, blockchain tx).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Issue downvoted successfully",
  "issue": {
    "issue_id": "...",
    "upvotes": 11,
    "downvotes": 2,
    "priority_score": 65.8,
    "status": "open"
  },
  "reporter_rep_change": -3,
  "blockchain_tx_hash": "..."
}
```

---

## Verification Endpoints

### POST /issue/:id/verify

Verify that a resolved issue is actually fixed (citizen only).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "verified": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Issue verified successfully",
  "auto_closed": false,
  "issue": {
    "issue_id": "...",
    "status": "resolved",
    "verification_count": 2
  },
  "rep_rewards": {
    "verifier": 5,
    "reporter": 10
  },
  "blockchain_tx_hash": "..."
}
```

**Response (200 OK - Auto-closed at threshold):**
```json
{
  "success": true,
  "message": "Issue verified and auto-closed (3 verifications reached)",
  "auto_closed": true,
  "issue": {
    "issue_id": "...",
    "status": "closed",
    "verification_count": 3
  },
  "rep_rewards": {
    "verifier": 5,
    "reporter": 10
  },
  "blockchain_tx_hash": "..."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Issue must be in 'resolved' status to verify"
}
```

---

## Admin Endpoints

### GET /admin/dashboard

Get dashboard statistics and heatmap data (government only).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "total_issues": 1250,
    "open_issues": 450,
    "in_progress_issues": 200,
    "resolved_issues": 500,
    "closed_issues": 100,
    "total_citizens": 5000,
    "avg_priority": "52.30",
    "category_breakdown": [
      { "category": "pothole", "count": 500 },
      { "category": "garbage", "count": 350 },
      { "category": "streetlight", "count": 200 },
      { "category": "water", "count": 150 },
      { "category": "other", "count": 50 }
    ]
  },
  "heatmap_data": [
    {
      "issue_id": "...",
      "lat": 17.38,
      "lng": 78.48,
      "priority_score": 65.2,
      "status": "open",
      "category": "pothole"
    }
  ],
  "top_priority_issues": [
    {
      "issue_id": "...",
      "reporter_user_id": "...",
      "reporter_name": "John Doe",
      "reporter_profile_pic": "...",
      "image_url": "/uploads/...",
      "description": "...",
      "category": "water",
      "lat": 17.38,
      "lng": 78.48,
      "region": "Downtown",
      "status": "open",
      "priority_score": 85.5,
      "upvotes": 25,
      "downvotes": 0,
      "created_at": "..."
    }
  ]
}
```

### GET /admin/issues

Get all issues with advanced filters (government only).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status
- `category` (optional): Filter by category
- `date_from` (optional): Filter by creation date (ISO 8601)
- `date_to` (optional): Filter by creation date (ISO 8601)
- `sort_by` (optional): Sort field (priority, date_newest, date_oldest, upvotes)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Example:**
```
GET /admin/issues?status=open&category=pothole&sort_by=priority&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "total_pages": 5
  },
  "issues": [
    {
      "issue_id": "...",
      "reporter_user_id": "...",
      "reporter_name": "John Doe",
      "reporter_profile_pic": "...",
      "reporter_email": "user@example.com",
      "wallet_address": "...",
      "image_url": "/uploads/...",
      "description": "...",
      "category": "pothole",
      "lat": 17.38,
      "lng": 78.48,
      "region": "Downtown",
      "status": "open",
      "priority_score": 65.2,
      "blockchain_tx_hash": "...",
      "upvotes": 10,
      "downvotes": 1,
      "admin_proof_url": null,
      "verification_count": 0,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### POST /issue/:id/update-status

Update issue status (government users only).

**Request Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
status: in_progress | resolved | closed
proof_image: [binary file] (optional)
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Issue status updated successfully",
  "issue": {
    "issue_id": "...",
    "status": "resolved",
    "admin_proof_url": "/uploads/proof-123.jpg",
    "updated_at": "2024-01-15T15:30:00.000Z"
  },
  "blockchain_tx_hash": "..."
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Only government users can update issue status"
}
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "No token provided"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Access denied. Government role required."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Endpoint not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Response Formats

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. This should be added in production.

## Versioning

API version: v1 (implicit in all endpoints)

---

Built with ❤️ for transparent civic governance
