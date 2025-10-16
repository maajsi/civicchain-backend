# Example Request/Response Flows

This document provides example API request/response flows for common use cases.

## 1. User Registration and Login

### Request: New User Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen@example.com",
    "name": "John Citizen",
    "profile_pic": "https://example.com/photo.jpg"
  }'
```

### Response: New User
```json
{
  "success": true,
  "is_new": true,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "citizen@example.com",
    "name": "John Citizen",
    "profile_pic": "https://example.com/photo.jpg",
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
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwiZW1haWwiOiJjaXRpemVuQGV4YW1wbGUuY29tIiwicm9sZSI6ImNpdGl6ZW4iLCJ3YWxsZXRfYWRkcmVzcyI6Ijd4S1h0ZzJDVzg3ZDk3VFhKU0RwYkQ1akJraGVUcUE4M1RaUnVKb3NnQXNVIiwiaWF0IjoxNzA1MzE3MDAwLCJleHAiOjE3MDU5MjE4MDB9.dGVzdF9zaWduYXR1cmVfaGVyZQ"
}
```

## 2. Issue Reporting Flow

### Step 1: Upload and Classify Image
```bash
curl -X POST http://localhost:3000/issue/classify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/pothole.jpg"
```

### Response:
```json
{
  "success": true,
  "suggested_category": "pothole",
  "urgency_score": 8,
  "image_url": "/uploads/1705317000-abc123.jpg"
}
```

### Step 2: Submit Issue Report
```bash
curl -X POST http://localhost:3000/issue/report \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "/uploads/1705317000-abc123.jpg",
    "description": "Large pothole on Main Street near the intersection, causing traffic problems and vehicle damage",
    "category": "pothole",
    "lat": 17.385,
    "lng": 78.4867,
    "region": "Hyderabad - Jubilee Hills"
  }'
```

### Response:
```json
{
  "success": true,
  "issue": {
    "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "reporter_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "image_url": "/uploads/1705317000-abc123.jpg",
    "description": "Large pothole on Main Street...",
    "category": "pothole",
    "lat": 17.385,
    "lng": 78.4867,
    "region": "Hyderabad - Jubilee Hills",
    "status": "open",
    "priority_score": 45.5,
    "blockchain_tx_hash": "5xKLpzR8...",
    "upvotes": 0,
    "downvotes": 0,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## 3. Browsing Issues

### Request: Get Nearby Issues
```bash
curl -X GET "http://localhost:3000/issues?lat=17.385&lng=78.4867&radius=5000&status=open" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response:
```json
{
  "success": true,
  "count": 2,
  "issues": [
    {
      "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
      "reporter_user_id": "550e8400-e29b-41d4-a716-446655440000",
      "reporter_name": "John Citizen",
      "reporter_profile_pic": "https://example.com/photo.jpg",
      "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "image_url": "/uploads/1705317000-abc123.jpg",
      "description": "Large pothole on Main Street...",
      "category": "pothole",
      "lat": 17.385,
      "lng": 78.4867,
      "region": "Hyderabad - Jubilee Hills",
      "status": "open",
      "priority_score": 65.2,
      "blockchain_tx_hash": "5xKLpzR8...",
      "upvotes": 10,
      "downvotes": 1,
      "admin_proof_url": null,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T11:45:00.000Z",
      "distance": 245.5
    },
    {
      "issue_id": "xyz98765-uvw4-3210-abcd-efghijklmnop",
      "reporter_name": "Jane Smith",
      "description": "Overflowing garbage bins...",
      "category": "garbage",
      "lat": 17.387,
      "lng": 78.489,
      "status": "open",
      "priority_score": 52.8,
      "upvotes": 5,
      "downvotes": 0,
      "distance": 1420.3
    }
  ]
}
```

## 4. Voting on Issues

### Request: Upvote Issue
```bash
curl -X POST http://localhost:3000/issue/abc12345-def6-7890-ghij-klmnopqrstuv/upvote \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response:
```json
{
  "success": true,
  "message": "Issue upvoted successfully",
  "issue": {
    "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "upvotes": 11,
    "downvotes": 1,
    "priority_score": 67.3,
    "status": "open"
  },
  "reporter_rep_change": 5,
  "blockchain_tx_hash": "6yLMqzS9..."
}
```

## 5. Government Actions

### Request: Update Issue Status
```bash
curl -X POST http://localhost:3000/issue/abc12345-def6-7890-ghij-klmnopqrstuv/update-status \
  -H "Authorization: Bearer GOVERNMENT_JWT_TOKEN" \
  -F "status=resolved" \
  -F "proof_image=@/path/to/fixed-pothole.jpg"
```

### Response:
```json
{
  "success": true,
  "message": "Issue status updated successfully",
  "issue": {
    "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "status": "resolved",
    "admin_proof_url": "/uploads/1705320600-proof123.jpg",
    "updated_at": "2024-01-15T15:30:00.000Z"
  },
  "blockchain_tx_hash": "7zNOrAt0..."
}
```

### Request: Get Dashboard
```bash
curl -X GET http://localhost:3000/admin/dashboard \
  -H "Authorization: Bearer GOVERNMENT_JWT_TOKEN"
```

### Response:
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
      "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
      "lat": 17.385,
      "lng": 78.4867,
      "priority_score": 65.2,
      "status": "open",
      "category": "pothole"
    }
  ],
  "top_priority_issues": [
    {
      "issue_id": "xyz98765-uvw4-3210-abcd-efghijklmnop",
      "reporter_name": "Jane Smith",
      "description": "Water main break...",
      "category": "water",
      "priority_score": 85.5,
      "upvotes": 25,
      "created_at": "2024-01-14T08:00:00.000Z"
    }
  ]
}
```

## 6. Issue Verification

### Request: Verify Resolved Issue
```bash
curl -X POST http://localhost:3000/issue/abc12345-def6-7890-ghij-klmnopqrstuv/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"verified": true}'
```

### Response (First Verification):
```json
{
  "success": true,
  "message": "Issue verified successfully",
  "auto_closed": false,
  "issue": {
    "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "status": "resolved",
    "verification_count": 1
  },
  "rep_rewards": {
    "verifier": 5,
    "reporter": 10
  },
  "blockchain_tx_hash": "8aPbsVu1..."
}
```

### Response (Third Verification - Auto-Close):
```json
{
  "success": true,
  "message": "Issue verified and auto-closed (3 verifications reached)",
  "auto_closed": true,
  "issue": {
    "issue_id": "abc12345-def6-7890-ghij-klmnopqrstuv",
    "status": "closed",
    "verification_count": 3
  },
  "rep_rewards": {
    "verifier": 5,
    "reporter": 10
  },
  "blockchain_tx_hash": "9bQctWv2..."
}
```

## 7. User Profile

### Request: Get Own Profile
```bash
curl -X GET http://localhost:3000/user/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response:
```json
{
  "success": true,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "citizen@example.com",
    "name": "John Citizen",
    "profile_pic": "https://example.com/photo.jpg",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "role": "citizen",
    "rep": 155,
    "issues_reported": 5,
    "issues_resolved": 2,
    "total_upvotes": 23,
    "verifications_done": 8,
    "badges": ["First Reporter", "Verifier"],
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

## 8. Error Responses

### 401 Unauthorized (Missing Token):
```json
{
  "success": false,
  "error": "No token provided"
}
```

### 403 Forbidden (Wrong Role):
```json
{
  "success": false,
  "error": "Access denied. Government role required."
}
```

### 400 Bad Request (Already Voted):
```json
{
  "success": false,
  "error": "You have already voted on this issue"
}
```

### 404 Not Found:
```json
{
  "success": false,
  "error": "Issue not found"
}
```

---

These examples demonstrate the complete flow of the CivicChain platform, from user registration to issue reporting, voting, government actions, and verification.
