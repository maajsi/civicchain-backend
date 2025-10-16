const config = require('../config');
const db = require('../db');

// Calculate priority score based on the specified formula
async function calculatePriorityScore(issue) {
  try {
    // 1. Location Density (LD) - issues within 100m in last 30 days
    const densityResult = await db.query(`
      SELECT COUNT(*) as count
      FROM issues
      WHERE ST_DWithin(
        location,
        ST_MakePoint($1, $2)::geography,
        $3
      )
      AND created_at > NOW() - INTERVAL '${config.proximity.densityWindow} days'
      AND issue_id != $4
    `, [issue.lng, issue.lat, config.proximity.densityRadius, issue.issue_id || '00000000-0000-0000-0000-000000000000']);
    
    const locationDensity = Math.min(parseInt(densityResult.rows[0].count), 10);
    
    // 2. Reporter Reputation (RR)
    const reporterResult = await db.query(
      'SELECT rep FROM users WHERE user_id = $1',
      [issue.reporter_user_id]
    );
    const reporterRep = reporterResult.rows[0]?.rep || 100;
    const reporterReputation = Math.min(reporterRep / 10, 10);
    
    // 3. Upvote Reputation Sum (UR)
    const upvoteRepResult = await db.query(`
      SELECT COALESCE(SUM(u.rep), 0) as total_rep
      FROM votes v
      JOIN users u ON v.user_id = u.user_id
      WHERE v.issue_id = $1 AND v.vote_type = 'upvote'
    `, [issue.issue_id || '00000000-0000-0000-0000-000000000000']);
    
    const upvoteRepSum = Math.min(parseInt(upvoteRepResult.rows[0].total_rep) / 100, 10);
    
    // 4. Category Urgency (CU)
    const categoryUrgency = config.categoryUrgency[issue.category] || 5;
    
    // 5. Time Factor (TF) - days since creation
    const createdAt = issue.created_at ? new Date(issue.created_at) : new Date();
    const daysOpen = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const timeFactor = Math.min(daysOpen, 10);
    
    // Calculate final priority score
    const priorityScore = 
      (config.priorityWeights.locationDensity * locationDensity) +
      (config.priorityWeights.reporterReputation * reporterReputation) +
      (config.priorityWeights.upvoteReputationSum * upvoteRepSum) +
      (config.priorityWeights.categoryUrgency * categoryUrgency) +
      (config.priorityWeights.timeFactor * timeFactor);
    
    return Math.min(priorityScore, 100);
  } catch (error) {
    console.error('Error calculating priority score:', error);
    return 0;
  }
}

// Update priority score for an issue
async function updateIssuePriorityScore(issueId) {
  try {
    const issueResult = await db.query(`
      SELECT 
        issue_id,
        reporter_user_id,
        category,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        created_at
      FROM issues
      WHERE issue_id = $1
    `, [issueId]);
    
    if (issueResult.rows.length === 0) {
      return null;
    }
    
    const issue = issueResult.rows[0];
    const priorityScore = await calculatePriorityScore(issue);
    
    await db.query(
      'UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE issue_id = $2',
      [priorityScore, issueId]
    );
    
    return priorityScore;
  } catch (error) {
    console.error('Error updating priority score:', error);
    throw error;
  }
}

// Batch update priority scores for all open issues (for daily cron job)
async function batchUpdatePriorityScores() {
  try {
    const issues = await db.query(`
      SELECT 
        issue_id,
        reporter_user_id,
        category,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        created_at
      FROM issues
      WHERE status IN ('open', 'in_progress')
    `);
    
    console.log(`Updating priority scores for ${issues.rows.length} issues...`);
    
    for (const issue of issues.rows) {
      const priorityScore = await calculatePriorityScore(issue);
      await db.query(
        'UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE issue_id = $2',
        [priorityScore, issue.issue_id]
      );
    }
    
    console.log('Priority score batch update completed');
  } catch (error) {
    console.error('Error in batch priority update:', error);
    throw error;
  }
}

module.exports = {
  calculatePriorityScore,
  updateIssuePriorityScore,
  batchUpdatePriorityScores
};
