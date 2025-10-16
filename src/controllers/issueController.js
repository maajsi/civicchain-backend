const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { calculatePriorityScore, updateIssuePriorityScore } = require('../utils/priority');
const { 
  handleUpvoteReputation, 
  handleDownvoteReputation, 
  handleVerificationReputation,
  updateReputation
} = require('../utils/reputation');
const {
  createIssueOnChain,
  updateIssueStatusOnChain,
  updateReputationOnChain
} = require('../utils/solana');

async function classifyImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }
    
    const imageUrl = `/${config.upload.uploadDir}/${req.file.filename}`;
    
    // Call AI service for classification
    try {
      const aiResponse = await axios.post(
        `${config.ai.serviceUrl}/classify`,
        {
          image_path: path.join(process.cwd(), imageUrl)
        },
        { timeout: 10000 }
      );
      
      const category = aiResponse.data.category || 'other';
      const urgencyScore = config.categoryUrgency[category] || 5;
      
      return res.json({
        success: true,
        suggested_category: category,
        urgency_score: urgencyScore,
        image_url: imageUrl
      });
    } catch (aiError) {
      console.error('AI service error:', aiError.message);
      
      // Fallback: return default classification
      return res.json({
        success: true,
        suggested_category: 'other',
        urgency_score: 5,
        image_url: imageUrl,
        note: 'AI service unavailable, using default classification'
      });
    }
  } catch (error) {
    console.error('Image classification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Image classification failed'
    });
  }
}

async function reportIssue(req, res) {
  try {
    const { image_url, description, category, lat, lng, region } = req.body;
    const userId = req.user.user_id;
    
    // Validation
    if (!image_url || !description || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: image_url, description, category, lat, lng'
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
    
    // Get user's wallet address
    const userResult = await db.query(
      'SELECT wallet_address FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const wallet_address = userResult.rows[0].wallet_address;
    const issue_id = uuidv4();
    
    // Calculate initial priority score
    const tempIssue = {
      issue_id,
      reporter_user_id: userId,
      category,
      lat,
      lng,
      created_at: new Date()
    };
    const priorityScore = await calculatePriorityScore(tempIssue);
    
    // Insert issue into database
    const issueResult = await db.query(`
      INSERT INTO issues (
        issue_id, reporter_user_id, wallet_address, image_url, description, 
        category, location, region, status, priority_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, 'open', $10
      )
      RETURNING 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
    `, [issue_id, userId, wallet_address, image_url, description, category, lng, lat, region || null, priorityScore]);
    
    const newIssue = issueResult.rows[0];
    
    // Create issue on blockchain (async)
    const issueHash = `issue_${issue_id}`;
    createIssueOnChain(wallet_address, issueHash, new Date().toISOString())
      .then(async (txHash) => {
        await db.query(
          'UPDATE issues SET blockchain_tx_hash = $1 WHERE issue_id = $2',
          [txHash, issue_id]
        );
        console.log(`Issue ${issue_id} created on-chain. Tx: ${txHash}`);
      })
      .catch(error => {
        console.error('Failed to create issue on-chain:', error.message);
      });
    
    // Update user stats
    await db.query(
      'UPDATE users SET issues_reported = issues_reported + 1 WHERE user_id = $1',
      [userId]
    );
    
    return res.status(201).json({
      success: true,
      issue: {
        ...newIssue,
        location: { lat: newIssue.lat, lng: newIssue.lng }
      }
    });
  } catch (error) {
    console.error('Report issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create issue',
      details: error.message
    });
  }
}

async function getIssues(req, res) {
  try {
    const { lat, lng, radius, category, status } = req.query;
    
    let query = `
      SELECT 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
    `;
    
    const conditions = [];
    const params = [];
    let paramCount = 0;
    
    // Distance calculation if lat/lng provided
    if (lat && lng) {
      query += `, ST_Distance(location, ST_MakePoint($${++paramCount}, $${++paramCount})::geography) AS distance `;
      params.push(parseFloat(lng), parseFloat(lat));
    }
    
    query += ' FROM issues WHERE 1=1 ';
    
    // Proximity filter
    if (lat && lng) {
      const searchRadius = radius ? parseInt(radius) : config.proximity.defaultRadius;
      query += ` AND ST_DWithin(location, ST_MakePoint($${params.length - 1}, $${params.length})::geography, $${++paramCount})`;
      params.push(searchRadius);
    }
    
    // Category filter
    if (category) {
      query += ` AND category = $${++paramCount}`;
      params.push(category);
    }
    
    // Status filter
    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    // Order by priority and distance
    if (lat && lng) {
      query += ' ORDER BY priority_score DESC, distance ASC';
    } else {
      query += ' ORDER BY priority_score DESC, created_at DESC';
    }
    
    const result = await db.query(query, params);
    
    const issues = result.rows.map(issue => ({
      ...issue,
      location: { lat: issue.lat, lng: issue.lng },
      distance: issue.distance || null
    }));
    
    return res.json({
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
  }
}

async function getIssueById(req, res) {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        i.issue_id, i.reporter_user_id, i.wallet_address, i.image_url, i.description, 
        i.category, ST_Y(i.location::geometry) as lat, ST_X(i.location::geometry) as lng,
        i.region, i.status, i.priority_score, i.blockchain_tx_hash, i.upvotes, i.downvotes,
        i.admin_proof_url, i.created_at, i.updated_at,
        u.name as reporter_name, u.profile_pic as reporter_pic, u.rep as reporter_rep
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE i.issue_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
    
    const issue = result.rows[0];
    
    return res.json({
      success: true,
      issue: {
        ...issue,
        location: { lat: issue.lat, lng: issue.lng },
        reporter: {
          user_id: issue.reporter_user_id,
          name: issue.reporter_name,
          profile_pic: issue.reporter_pic,
          rep: issue.reporter_rep
        }
      }
    });
  } catch (error) {
    console.error('Get issue by ID error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issue'
    });
  }
}

async function upvoteIssue(req, res) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check if issue exists
    const issueResult = await client.query(
      'SELECT * FROM issues WHERE issue_id = $1',
      [id]
    );
    
    if (issueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
    
    const issue = issueResult.rows[0];
    const reporterId = issue.reporter_user_id;
    
    // Check if user already voted
    const existingVote = await client.query(
      'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2',
      [userId, id]
    );
    
    if (existingVote.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this issue'
      });
    }
    
    // Insert vote
    await client.query(
      'INSERT INTO votes (vote_id, user_id, issue_id, vote_type) VALUES ($1, $2, $3, $4)',
      [uuidv4(), userId, id, 'upvote']
    );
    
    // Update issue upvote count
    await client.query(
      'UPDATE issues SET upvotes = upvotes + 1, updated_at = NOW() WHERE issue_id = $1',
      [id]
    );
    
    // Update reporter's total upvotes
    await client.query(
      'UPDATE users SET total_upvotes = total_upvotes + 1 WHERE user_id = $1',
      [reporterId]
    );
    
    await client.query('COMMIT');
    
    // Update reputation (outside transaction)
    await handleUpvoteReputation(reporterId, userId);
    
    // Update priority score
    await updateIssuePriorityScore(id);
    
    // Get updated issue
    const updatedIssueResult = await db.query(`
      SELECT 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
      FROM issues WHERE issue_id = $1
    `, [id]);
    
    const updatedIssue = updatedIssueResult.rows[0];
    
    // Get reporter wallet for blockchain update
    const reporterResult = await db.query(
      'SELECT wallet_address, rep FROM users WHERE user_id = $1',
      [reporterId]
    );
    const reporterWallet = reporterResult.rows[0].wallet_address;
    const newRep = reporterResult.rows[0].rep;
    
    // Update reputation on-chain (async)
    let blockchainTxHash = null;
    try {
      blockchainTxHash = await updateReputationOnChain(reporterWallet, newRep);
    } catch (error) {
      console.error('Failed to update reputation on-chain:', error.message);
    }
    
    return res.json({
      success: true,
      message: 'Issue upvoted successfully',
      issue: {
        ...updatedIssue,
        location: { lat: updatedIssue.lat, lng: updatedIssue.lng }
      },
      reporter_rep_change: config.reputation.upvoteReceived,
      blockchain_tx_hash: blockchainTxHash
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upvote issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upvote issue'
    });
  } finally {
    client.release();
  }
}

async function downvoteIssue(req, res) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check if issue exists
    const issueResult = await client.query(
      'SELECT * FROM issues WHERE issue_id = $1',
      [id]
    );
    
    if (issueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
    
    const issue = issueResult.rows[0];
    const reporterId = issue.reporter_user_id;
    
    // Check if user already voted
    const existingVote = await client.query(
      'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2',
      [userId, id]
    );
    
    if (existingVote.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this issue'
      });
    }
    
    // Insert vote
    await client.query(
      'INSERT INTO votes (vote_id, user_id, issue_id, vote_type) VALUES ($1, $2, $3, $4)',
      [uuidv4(), userId, id, 'downvote']
    );
    
    // Update issue downvote count
    await client.query(
      'UPDATE issues SET downvotes = downvotes + 1, updated_at = NOW() WHERE issue_id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    // Update reputation (outside transaction)
    await handleDownvoteReputation(reporterId, userId);
    
    // Update priority score
    await updateIssuePriorityScore(id);
    
    // Get updated issue
    const updatedIssueResult = await db.query(`
      SELECT 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
      FROM issues WHERE issue_id = $1
    `, [id]);
    
    const updatedIssue = updatedIssueResult.rows[0];
    
    // Get reporter wallet for blockchain update
    const reporterResult = await db.query(
      'SELECT wallet_address, rep FROM users WHERE user_id = $1',
      [reporterId]
    );
    const reporterWallet = reporterResult.rows[0].wallet_address;
    const newRep = reporterResult.rows[0].rep;
    
    // Update reputation on-chain (async)
    let blockchainTxHash = null;
    try {
      blockchainTxHash = await updateReputationOnChain(reporterWallet, newRep);
    } catch (error) {
      console.error('Failed to update reputation on-chain:', error.message);
    }
    
    return res.json({
      success: true,
      message: 'Issue downvoted successfully',
      issue: {
        ...updatedIssue,
        location: { lat: updatedIssue.lat, lng: updatedIssue.lng }
      },
      reporter_rep_change: config.reputation.downvoteReceived,
      blockchain_tx_hash: blockchainTxHash
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Downvote issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to downvote issue'
    });
  } finally {
    client.release();
  }
}

async function verifyIssue(req, res) {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = req.user.user_id;
    const { verified } = req.body;
    
    // Check user role (only citizens can verify)
    if (req.user.role !== 'citizen') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'Only citizen users can verify issues'
      });
    }
    
    // Check if issue exists and is in resolved status
    const issueResult = await client.query(
      'SELECT * FROM issues WHERE issue_id = $1',
      [id]
    );
    
    if (issueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
    
    const issue = issueResult.rows[0];
    
    if (issue.status !== 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Issue must be in "resolved" status to verify'
      });
    }
    
    const reporterId = issue.reporter_user_id;
    
    // Check if user already verified
    const existingVerification = await client.query(
      'SELECT * FROM verifications WHERE user_id = $1 AND issue_id = $2',
      [userId, id]
    );
    
    if (existingVerification.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already verified this issue'
      });
    }
    
    // Insert verification
    await client.query(
      'INSERT INTO verifications (verification_id, user_id, issue_id) VALUES ($1, $2, $3)',
      [uuidv4(), userId, id]
    );
    
    // Update verifier stats
    await client.query(
      'UPDATE users SET verifications_done = verifications_done + 1 WHERE user_id = $1',
      [userId]
    );
    
    // Check if threshold reached for auto-close
    const verificationCount = await client.query(
      'SELECT COUNT(*) as count FROM verifications WHERE issue_id = $1',
      [id]
    );
    
    const count = parseInt(verificationCount.rows[0].count);
    let message = 'Issue verified successfully';
    let autoClosedIssue = false;
    
    if (count >= config.verification.autoCloseThreshold) {
      // Auto-close the issue
      await client.query(
        'UPDATE issues SET status = $1, updated_at = NOW() WHERE issue_id = $2',
        ['closed', id]
      );
      
      // Update reporter's issues_resolved count
      await client.query(
        'UPDATE users SET issues_resolved = issues_resolved + 1 WHERE user_id = $1',
        [reporterId]
      );
      
      message = `Issue verified and auto-closed (${config.verification.autoCloseThreshold} verifications reached)`;
      autoClosedIssue = true;
    }
    
    await client.query('COMMIT');
    
    // Update reputations (outside transaction)
    await handleVerificationReputation(reporterId, userId);
    
    // Get updated issue
    const updatedIssueResult = await db.query(`
      SELECT 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
      FROM issues WHERE issue_id = $1
    `, [id]);
    
    const updatedIssue = updatedIssueResult.rows[0];
    
    // Get reputation changes
    const reporterResult = await db.query(
      'SELECT wallet_address, rep FROM users WHERE user_id = $1',
      [reporterId]
    );
    const verifierResult = await db.query(
      'SELECT wallet_address, rep FROM users WHERE user_id = $1',
      [userId]
    );
    
    // Update blockchain status if auto-closed
    let blockchainTxHash = null;
    if (autoClosedIssue) {
      try {
        const issueHash = `issue_${id}`;
        blockchainTxHash = await updateIssueStatusOnChain(issueHash, 'closed');
        await db.query(
          'UPDATE issues SET blockchain_tx_hash = $1 WHERE issue_id = $2',
          [blockchainTxHash, id]
        );
      } catch (error) {
        console.error('Failed to update issue status on-chain:', error.message);
      }
    }
    
    return res.json({
      success: true,
      message,
      issue: {
        ...updatedIssue,
        location: { lat: updatedIssue.lat, lng: updatedIssue.lng }
      },
      rep_rewards: {
        reporter: config.reputation.issueVerifiedResolved,
        verifier: config.reputation.verifierReward
      },
      verification_count: count,
      auto_closed: autoClosedIssue,
      blockchain_tx_hash: blockchainTxHash
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Verify issue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify issue'
    });
  } finally {
    client.release();
  }
}

async function updateIssueStatus(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check user role (only government users can update status)
    if (req.user.role !== 'government') {
      return res.status(403).json({
        success: false,
        error: 'Only government users can update issue status'
      });
    }
    
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    // Check if issue exists
    const issueResult = await db.query(
      'SELECT * FROM issues WHERE issue_id = $1',
      [id]
    );
    
    if (issueResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }
    
    const issue = issueResult.rows[0];
    
    // Handle proof image if provided
    let proofUrl = issue.admin_proof_url;
    if (req.file) {
      proofUrl = `/${config.upload.uploadDir}/${req.file.filename}`;
    }
    
    // Update issue
    await db.query(
      'UPDATE issues SET status = $1, admin_proof_url = $2, updated_at = NOW() WHERE issue_id = $3',
      [status, proofUrl, id]
    );
    
    // Get updated issue
    const updatedIssueResult = await db.query(`
      SELECT 
        issue_id, reporter_user_id, wallet_address, image_url, description, category,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
        region, status, priority_score, blockchain_tx_hash, upvotes, downvotes,
        admin_proof_url, created_at, updated_at
      FROM issues WHERE issue_id = $1
    `, [id]);
    
    const updatedIssue = updatedIssueResult.rows[0];
    
    // Update issue status on-chain (async)
    let blockchainTxHash = null;
    try {
      const issueHash = `issue_${id}`;
      blockchainTxHash = await updateIssueStatusOnChain(issueHash, status);
      await db.query(
        'UPDATE issues SET blockchain_tx_hash = $1 WHERE issue_id = $2',
        [blockchainTxHash, id]
      );
    } catch (error) {
      console.error('Failed to update issue status on-chain:', error.message);
    }
    
    return res.json({
      success: true,
      message: 'Issue status updated successfully',
      issue: {
        ...updatedIssue,
        location: { lat: updatedIssue.lat, lng: updatedIssue.lng }
      },
      blockchain_tx_hash: blockchainTxHash
    });
    
  } catch (error) {
    console.error('Update issue status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update issue status'
    });
  }
}

module.exports = {
  classifyImage,
  reportIssue,
  getIssues,
  getIssueById,
  upvoteIssue,
  downvoteIssue,
  verifyIssue,
  updateIssueStatus
};
