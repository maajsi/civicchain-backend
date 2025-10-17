const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { updateIssuePriority } = require('../utils/priority');
const { REPUTATION_CHANGES, calculateNewReputation, updateBadges } = require('../utils/reputation');
const { recordVoteOnChain, updateReputationOnChain } = require('../services/solanaService');

/**
 * POST /issue/:id/upvote
 * Upvote an issue
 */
async function upvoteIssue(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = (req.user && req.user.user_id) ? req.user.user_id : req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: missing user context'
      });
    }

    await client.query('BEGIN');

    // Check if issue exists
    const issueQuery = 'SELECT * FROM issues WHERE issue_id = $1';
    const issueResult = await client.query(issueQuery, [id]);

    if (issueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }

    const issue = issueResult.rows[0];

    const voterResult = await client.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const voter = voterResult.rows[0];
    if (!voter) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already voted
    const existingVoteQuery = 'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2';
    const existingVoteResult = await client.query(existingVoteQuery, [userId, id]);

    if (existingVoteResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this issue'
      });
    }

    // Prevent voting on own issue
    if (issue.reporter_user_id === userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You cannot vote on your own issue'
      });
    }

    // Record vote
    const voteId = uuidv4();
    await client.query(
      'INSERT INTO votes (vote_id, user_id, issue_id, vote_type) VALUES ($1, $2, $3, $4)',
      [voteId, userId, id, 'upvote']
    );

    // Update issue upvote count
    await client.query(
      'UPDATE issues SET upvotes = upvotes + 1, updated_at = NOW() WHERE issue_id = $1',
      [id]
    );

    // Update reporter reputation
    const reporterQuery = 'SELECT * FROM users WHERE user_id = $1';
    const reporterResult = await client.query(reporterQuery, [issue.reporter_user_id]);
    const reporter = reporterResult.rows[0];

    const newRep = calculateNewReputation(reporter.rep, REPUTATION_CHANGES.UPVOTE_RECEIVED);
    await client.query(
      'UPDATE users SET rep = $1, total_upvotes = total_upvotes + 1 WHERE user_id = $2',
      [newRep, issue.reporter_user_id]
    );

    // Update badges
    const updatedReporter = await client.query('SELECT * FROM users WHERE user_id = $1', [issue.reporter_user_id]);
    const newBadges = updateBadges(updatedReporter.rows[0]);
    await client.query('UPDATE users SET badges = $1 WHERE user_id = $2', [newBadges, issue.reporter_user_id]);

    // Record vote on blockchain
    const blockchainTxHash = await recordVoteOnChain(
      voter.wallet_address,
      voter.private_key,
      issue.issue_id,
      reporter.wallet_address,
      'upvote'
    );

    // Update reputation on blockchain
    await updateReputationOnChain(reporter.wallet_address, newRep);

    await client.query('COMMIT');

    // Recalculate priority score after vote
    const newPriority = await updateIssuePriority(id);

    // Get updated issue
    const updatedIssueQuery = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng
      FROM issues i
      WHERE i.issue_id = $1
    `;
    const updatedIssueResult = await client.query(updatedIssueQuery, [id]);
    const updatedIssue = updatedIssueResult.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Issue upvoted successfully',
      issue: {
        issue_id: updatedIssue.issue_id,
        upvotes: updatedIssue.upvotes,
        downvotes: updatedIssue.downvotes,
        priority_score: updatedIssue.priority_score,
        status: updatedIssue.status
      },
      reporter_rep_change: REPUTATION_CHANGES.UPVOTE_RECEIVED,
      blockchain_tx_hash: blockchainTxHash
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upvote error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upvote issue'
    });
  } finally {
    client.release();
  }
}

/**
 * POST /issue/:id/downvote
 * Downvote an issue
 */
async function downvoteIssue(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = (req.user && req.user.user_id) ? req.user.user_id : req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: missing user context'
      });
    }

    await client.query('BEGIN');

    // Check if issue exists
    const issueQuery = 'SELECT * FROM issues WHERE issue_id = $1';
    const issueResult = await client.query(issueQuery, [id]);

    if (issueResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Issue not found'
      });
    }

    const issue = issueResult.rows[0];

    const voterResult = await client.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const voter = voterResult.rows[0];
    if (!voter) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user already voted
    const existingVoteQuery = 'SELECT * FROM votes WHERE user_id = $1 AND issue_id = $2';
    const existingVoteResult = await client.query(existingVoteQuery, [userId, id]);

    if (existingVoteResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this issue'
      });
    }

    // Prevent voting on own issue
    if (issue.reporter_user_id === userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You cannot vote on your own issue'
      });
    }

    // Record vote
    const voteId = uuidv4();
    await client.query(
      'INSERT INTO votes (vote_id, user_id, issue_id, vote_type) VALUES ($1, $2, $3, $4)',
      [voteId, userId, id, 'downvote']
    );

    // Update issue downvote count
    await client.query(
      'UPDATE issues SET downvotes = downvotes + 1, updated_at = NOW() WHERE issue_id = $1',
      [id]
    );

    // Update reporter reputation
    const reporterQuery = 'SELECT * FROM users WHERE user_id = $1';
    const reporterResult = await client.query(reporterQuery, [issue.reporter_user_id]);
    const reporter = reporterResult.rows[0];

    const newRep = calculateNewReputation(reporter.rep, REPUTATION_CHANGES.DOWNVOTE_RECEIVED);
    await client.query(
      'UPDATE users SET rep = $1 WHERE user_id = $2',
      [newRep, issue.reporter_user_id]
    );

    // Update badges (in case rep dropped below threshold)
    const updatedReporter = await client.query('SELECT * FROM users WHERE user_id = $1', [issue.reporter_user_id]);
    const newBadges = updateBadges(updatedReporter.rows[0]);
    await client.query('UPDATE users SET badges = $1 WHERE user_id = $2', [newBadges, issue.reporter_user_id]);

    // Record vote on blockchain (downvote)
    const blockchainTxHash = await recordVoteOnChain(
      voter.wallet_address,
      voter.private_key,
      issue.issue_id,
      reporter.wallet_address,
      'downvote'
    );

    // Update reputation on blockchain
    await updateReputationOnChain(reporter.wallet_address, newRep);

    await client.query('COMMIT');

    // Recalculate priority score after vote
    const newPriority = await updateIssuePriority(id);

    // Get updated issue
    const updatedIssueQuery = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng
      FROM issues i
      WHERE i.issue_id = $1
    `;
    const updatedIssueResult = await client.query(updatedIssueQuery, [id]);
    const updatedIssue = updatedIssueResult.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Issue downvoted successfully',
      issue: {
        issue_id: updatedIssue.issue_id,
        upvotes: updatedIssue.upvotes,
        downvotes: updatedIssue.downvotes,
        priority_score: updatedIssue.priority_score,
        status: updatedIssue.status
      },
      reporter_rep_change: REPUTATION_CHANGES.DOWNVOTE_RECEIVED,
      blockchain_tx_hash: blockchainTxHash
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Downvote error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to downvote issue'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  upvoteIssue,
  downvoteIssue
};
