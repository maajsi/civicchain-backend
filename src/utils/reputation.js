const config = require('../config');
const db = require('../db');

// Update user reputation
async function updateReputation(userId, change, reason = '') {
  try {
    const result = await db.query(`
      UPDATE users 
      SET rep = GREATEST($1, rep + $2)
      WHERE user_id = $3
      RETURNING rep
    `, [config.reputation.minReputation, change, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const newRep = result.rows[0].rep;
    console.log(`Updated reputation for user ${userId}: ${change > 0 ? '+' : ''}${change} (${reason}). New rep: ${newRep}`);
    
    // Check for badges
    await checkAndAwardBadges(userId);
    
    return newRep;
  } catch (error) {
    console.error('Error updating reputation:', error);
    throw error;
  }
}

// Check and award badges based on user stats
async function checkAndAwardBadges(userId) {
  try {
    const userResult = await db.query(`
      SELECT rep, issues_reported, verifications_done, badges
      FROM users
      WHERE user_id = $1
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      return;
    }
    
    const user = userResult.rows[0];
    const currentBadges = user.badges || [];
    const newBadges = [...currentBadges];
    
    // First Reporter badge
    if (user.issues_reported >= 1 && !currentBadges.includes('First Reporter')) {
      newBadges.push('First Reporter');
    }
    
    // Top Reporter badge
    if (user.issues_reported >= 10 && !currentBadges.includes('Top Reporter')) {
      newBadges.push('Top Reporter');
    }
    
    // Civic Hero badge
    if (user.issues_reported >= 50 && !currentBadges.includes('Civic Hero')) {
      newBadges.push('Civic Hero');
    }
    
    // Verifier badge
    if (user.verifications_done >= 10 && !currentBadges.includes('Verifier')) {
      newBadges.push('Verifier');
    }
    
    // Trusted Voice badge
    if (user.rep >= 200 && !currentBadges.includes('Trusted Voice')) {
      newBadges.push('Trusted Voice');
    }
    
    // Update badges if new ones were earned
    if (newBadges.length > currentBadges.length) {
      await db.query(
        'UPDATE users SET badges = $1 WHERE user_id = $2',
        [newBadges, userId]
      );
      
      const earnedBadges = newBadges.filter(b => !currentBadges.includes(b));
      console.log(`User ${userId} earned new badges:`, earnedBadges);
    }
  } catch (error) {
    console.error('Error checking badges:', error);
  }
}

// Handle upvote reputation changes
async function handleUpvoteReputation(reporterId, voterId) {
  await updateReputation(reporterId, config.reputation.upvoteReceived, 'upvote received');
}

// Handle downvote reputation changes
async function handleDownvoteReputation(reporterId, voterId) {
  await updateReputation(reporterId, config.reputation.downvoteReceived, 'downvote received');
}

// Handle verification reputation rewards
async function handleVerificationReputation(reporterId, verifierId) {
  await updateReputation(reporterId, config.reputation.issueVerifiedResolved, 'issue verified resolved');
  await updateReputation(verifierId, config.reputation.verifierReward, 'verified issue');
}

// Mark issue as spam and penalize reporter
async function markIssueAsSpam(issueId, reporterId) {
  await updateReputation(reporterId, config.reputation.issueMarkedSpam, 'issue marked as spam');
}

module.exports = {
  updateReputation,
  checkAndAwardBadges,
  handleUpvoteReputation,
  handleDownvoteReputation,
  handleVerificationReputation,
  markIssueAsSpam
};
