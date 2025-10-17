const pool = require('../config/database');

/**
 * Category to urgency score mapping
 */
const CATEGORY_URGENCY = {
  pothole: 8,
  garbage: 6,
  streetlight: 4,
  water: 9,
  other: 5
};

/**
 * Calculate priority score for an issue
 * 
 * Priority = (2.5 × LD) + (2.0 × RR) + (2.0 × UR) + (2.5 × CU) + (1.0 × TF)
 * 
 * Where:
 * - LD (Location Density): Number of issues within 100m in last 30 days (max 10)
 * - RR (Reporter Reputation): min(reporter_rep / 10, 10)
 * - UR (Upvote Reputation Sum): min(sum_upvoter_rep / 100, 10)
 * - CU (Category Urgency): From category mapping (4-9)
 * - TF (Time Factor): Days since issue reported (max 10)
 * 
 * @param {Object} params - Issue parameters
 * @returns {Promise<number>} Priority score (0-100)
 */
async function calculatePriorityScore({
  issue_id,
  lat,
  lng,
  category,
  reporter_rep,
  created_at
}) {
  const client = await pool.connect();
  
  try {
    // 1. Location Density (LD) - issues within 100m in last 30 days
    const densityQuery = `
      SELECT COUNT(*) as count
      FROM issues
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        100
      )
      AND created_at > NOW() - INTERVAL '30 days'
      ${issue_id ? 'AND issue_id != $3' : ''}
    `;
    
    const densityParams = issue_id ? [lng, lat, issue_id] : [lng, lat];
    const densityResult = await client.query(densityQuery, densityParams);
    const LD = Math.min(parseInt(densityResult.rows[0].count), 10);

    // 2. Reporter Reputation (RR)
    const RR = Math.min(reporter_rep / 10, 10);

    // 3. Upvote Reputation Sum (UR)
    let UR = 0;
    if (issue_id) {
      const upvoteQuery = `
        SELECT COALESCE(SUM(u.rep), 0) as total_rep
        FROM votes v
        JOIN users u ON v.user_id = u.user_id
        WHERE v.issue_id = $1 AND v.vote_type = 'upvote'
      `;
      const upvoteResult = await client.query(upvoteQuery, [issue_id]);
      UR = Math.min(parseInt(upvoteResult.rows[0].total_rep) / 100, 10);
    }

    // 4. Category Urgency (CU)
    const CU = CATEGORY_URGENCY[category] || 5;

    // 5. Time Factor (TF)
    const issueDate = created_at ? new Date(created_at) : new Date();
    const daysSinceCreation = Math.floor((Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
    const TF = Math.min(daysSinceCreation, 10);

    // Calculate final priority
    const priority = (2.5 * LD) + (2.0 * RR) + (2.0 * UR) + (2.5 * CU) + (1.0 * TF);

    return Math.min(priority, 100);
  } finally {
    client.release();
  }
}

/**
 * Update priority score for an issue
 * @param {string} issue_id - Issue ID
 * @returns {Promise<number>} New priority score
 */
async function updateIssuePriority(issue_id) {
  const client = await pool.connect();
  
  try {
    // Get issue details
    const issueQuery = `
      SELECT 
        i.issue_id,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        i.category,
        i.created_at,
        u.rep as reporter_rep
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE i.issue_id = $1
    `;
    
    const issueResult = await client.query(issueQuery, [issue_id]);
    
    if (issueResult.rows.length === 0) {
      throw new Error('Issue not found');
    }
    
    const issue = issueResult.rows[0];
    
    // Calculate new priority
    const newPriority = await calculatePriorityScore({
      issue_id: issue.issue_id,
      lat: issue.lat,
      lng: issue.lng,
      category: issue.category,
      reporter_rep: issue.reporter_rep,
      created_at: issue.created_at
    });
    
    // Update in database
    await client.query(
      'UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE issue_id = $2',
      [newPriority, issue_id]
    );
    
    return newPriority;
  } finally {
    client.release();
  }
}

module.exports = {
  CATEGORY_URGENCY,
  calculatePriorityScore,
  updateIssuePriority
};
