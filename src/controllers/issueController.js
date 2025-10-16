const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { calculatePriorityScore, updateIssuePriority, CATEGORY_URGENCY } = require('../utils/priority');
const { updateBadges, REPUTATION_CHANGES, calculateNewReputation } = require('../utils/reputation');
const { classifyImageWithAI } = require('../services/aiService');
const { createIssueOnChain } = require('../services/solanaService');
const path = require('path');
const fs = require('fs');

/**
 * POST /issue/classify
 * Upload image and get AI classification
 */
async function classifyIssue(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const imagePath = path.join(__dirname, '../../uploads', req.file.filename);

    // Call Roboflow AI service for classification
    const suggestedCategory = await classifyImageWithAI(imagePath);
    const urgencyScore = CATEGORY_URGENCY[suggestedCategory] || 5;

    return res.status(200).json({
      success: true,
      suggested_category: suggestedCategory,
      urgency_score: urgencyScore,
      image_url: imageUrl
    });

  } catch (error) {
    console.error('Image classification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Image classification failed'
    });
  }
}

/**
 * POST /issue/report
 * Submit final issue report
 */
async function reportIssue(req, res) {
  const client = await pool.connect();
  
  try {
    const { image_url, description, category, lat, lng, region } = req.body;
    const userId = req.user.user_id;

    // Validate required fields
    if (!image_url || !description || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate category
    const validCategories = ['pothole', 'garbage', 'streetlight', 'water', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    await client.query('BEGIN');

    // Get user details
    const userQuery = 'SELECT * FROM users WHERE user_id = $1';
    const userResult = await client.query(userQuery, [userId]);
    const user = userResult.rows[0];

    // Calculate initial priority score
    const priorityScore = await calculatePriorityScore({
      lat,
      lng,
      category,
      reporter_rep: user.rep,
      created_at: new Date()
    });

    // Create issue
    const issueId = uuidv4();
    const insertIssueQuery = `
      INSERT INTO issues (
        issue_id, reporter_user_id, wallet_address, image_url, 
        description, category, location, region, priority_score, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10, 'open')
      RETURNING *
    `;

    const issueResult = await client.query(insertIssueQuery, [
      issueId,
      userId,
      user.wallet_address,
      image_url,
      description,
      category,
      lng,
      lat,
      region || null,
      priorityScore
    ]);

    const issue = issueResult.rows[0];

    // Update user stats
    await client.query(
      'UPDATE users SET issues_reported = issues_reported + 1 WHERE user_id = $1',
      [userId]
    );

    // Update badges
    const updatedUser = await client.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const newBadges = updateBadges(updatedUser.rows[0]);
    await client.query('UPDATE users SET badges = $1 WHERE user_id = $2', [newBadges, userId]);

    // Create blockchain transaction
    const blockchainTxHash = await createIssueOnChain({
      issue_id: issueId,
      reporter_wallet: user.wallet_address,
      category,
      priority_score: priorityScore
    });
    await client.query(
      'UPDATE issues SET blockchain_tx_hash = $1 WHERE issue_id = $2',
      [blockchainTxHash, issueId]
    );

    await client.query('COMMIT');

    // Get the created issue with location
    const createdIssueQuery = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng
      FROM issues i
      WHERE i.issue_id = $1
    `;
    const createdIssueResult = await client.query(createdIssueQuery, [issueId]);
    const createdIssue = createdIssueResult.rows[0];

    return res.status(201).json({
      success: true,
      issue: {
        issue_id: createdIssue.issue_id,
        reporter_user_id: createdIssue.reporter_user_id,
        wallet_address: createdIssue.wallet_address,
        image_url: createdIssue.image_url,
        description: createdIssue.description,
        category: createdIssue.category,
        lat: createdIssue.lat,
        lng: createdIssue.lng,
        region: createdIssue.region,
        status: createdIssue.status,
        priority_score: createdIssue.priority_score,
        blockchain_tx_hash: createdIssue.blockchain_tx_hash,
        upvotes: createdIssue.upvotes,
        downvotes: createdIssue.downvotes,
        created_at: createdIssue.created_at,
        updated_at: createdIssue.updated_at
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Report issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create issue',
      details: error.message
    });
  } finally {
    client.release();
  }
}

/**
 * GET /issues
 * Fetch issues with filters
 */
async function getIssues(req, res) {
  const client = await pool.connect();
  
  try {
    const { lat, lng, radius, category, status } = req.query;

    let query = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        u.name as reporter_name,
        u.profile_pic as reporter_profile_pic
    `;

    // Add distance if lat/lng provided
    if (lat && lng) {
      query += `,
        ST_Distance(
          i.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance
      `;
    }

    query += `
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add proximity filter
    if (lat && lng) {
      paramCount += 2;
      const radiusMeters = radius || 5000; // Default 5km
      query += ` AND ST_DWithin(
        i.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $${paramCount + 1}
      )`;
      params.push(parseFloat(lng), parseFloat(lat), radiusMeters);
      paramCount++;
    }

    // Add category filter
    if (category) {
      paramCount++;
      query += ` AND i.category = $${paramCount}`;
      params.push(category);
    }

    // Add status filter
    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }

    // Sort by priority first, then distance (if available)
    if (lat && lng) {
      query += ` ORDER BY i.priority_score DESC, distance ASC`;
    } else {
      query += ` ORDER BY i.priority_score DESC, i.created_at DESC`;
    }

    const result = await client.query(query, params);

    const issues = result.rows.map(row => ({
      issue_id: row.issue_id,
      reporter_user_id: row.reporter_user_id,
      reporter_name: row.reporter_name,
      reporter_profile_pic: row.reporter_profile_pic,
      wallet_address: row.wallet_address,
      image_url: row.image_url,
      description: row.description,
      category: row.category,
      lat: row.lat,
      lng: row.lng,
      region: row.region,
      status: row.status,
      priority_score: row.priority_score,
      blockchain_tx_hash: row.blockchain_tx_hash,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      admin_proof_url: row.admin_proof_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      distance: row.distance || null
    }));

    return res.status(200).json({
      success: true,
      count: issues.length,
      issues
    });

  } catch (error) {
    console.error('Get issues error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issues'
    });
  } finally {
    client.release();
  }
}

/**
 * GET /issue/:id
 * Get detailed info about a single issue
 */
async function getIssueById(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        u.name as reporter_name,
        u.profile_pic as reporter_profile_pic,
        u.rep as reporter_rep,
        (SELECT COUNT(*) FROM verifications WHERE issue_id = i.issue_id) as verification_count
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE i.issue_id = $1
    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }

    const issue = result.rows[0];

    return res.status(200).json({
      success: true,
      issue: {
        issue_id: issue.issue_id,
        reporter_user_id: issue.reporter_user_id,
        reporter_name: issue.reporter_name,
        reporter_profile_pic: issue.reporter_profile_pic,
        reporter_rep: issue.reporter_rep,
        wallet_address: issue.wallet_address,
        image_url: issue.image_url,
        description: issue.description,
        category: issue.category,
        lat: issue.lat,
        lng: issue.lng,
        region: issue.region,
        status: issue.status,
        priority_score: issue.priority_score,
        blockchain_tx_hash: issue.blockchain_tx_hash,
        upvotes: issue.upvotes,
        downvotes: issue.downvotes,
        admin_proof_url: issue.admin_proof_url,
        verification_count: parseInt(issue.verification_count),
        created_at: issue.created_at,
        updated_at: issue.updated_at
      }
    });

  } catch (error) {
    console.error('Get issue by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issue'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  classifyIssue,
  reportIssue,
  getIssues,
  getIssueById
};
