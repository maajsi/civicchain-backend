const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { REPUTATION_CHANGES, calculateNewReputation, updateBadges } = require('../utils/reputation');

/**
 * POST /issue/:id/verify
 * Verify that a resolved issue is actually fixed
 */
async function verifyIssue(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { verified } = req.body;

    // Verify user is a citizen (not government)
    if (req.user.role !== 'citizen') {
      return res.status(403).json({
        success: false,
        error: 'Only citizens can verify issues'
      });
    }

    await client.query('BEGIN');

    // Check if issue exists and is in resolved status
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

    if (issue.status !== 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Issue must be in "resolved" status to verify'
      });
    }

    // Check if user already verified this issue
    const existingVerificationQuery = 'SELECT * FROM verifications WHERE user_id = $1 AND issue_id = $2';
    const existingVerificationResult = await client.query(existingVerificationQuery, [userId, id]);

    if (existingVerificationResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You have already verified this issue'
      });
    }

    // Prevent verifying own issue
    if (issue.reporter_user_id === userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'You cannot verify your own issue'
      });
    }

    if (!verified) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Verification must be true'
      });
    }

    // Record verification
    const verificationId = uuidv4();
    await client.query(
      'INSERT INTO verifications (verification_id, user_id, issue_id) VALUES ($1, $2, $3)',
      [verificationId, userId, id]
    );

    // Update verifier reputation and stats
    const verifierQuery = 'SELECT * FROM users WHERE user_id = $1';
    const verifierResult = await client.query(verifierQuery, [userId]);
    const verifier = verifierResult.rows[0];

    const verifierNewRep = calculateNewReputation(verifier.rep, REPUTATION_CHANGES.VERIFICATION_DONE);
    await client.query(
      'UPDATE users SET rep = $1, verifications_done = verifications_done + 1 WHERE user_id = $2',
      [verifierNewRep, userId]
    );

    // Update verifier badges
    const updatedVerifier = await client.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    const verifierNewBadges = updateBadges(updatedVerifier.rows[0]);
    await client.query('UPDATE users SET badges = $1 WHERE user_id = $2', [verifierNewBadges, userId]);

    // Update reporter reputation
    const reporterQuery = 'SELECT * FROM users WHERE user_id = $1';
    const reporterResult = await client.query(reporterQuery, [issue.reporter_user_id]);
    const reporter = reporterResult.rows[0];

    const reporterNewRep = calculateNewReputation(reporter.rep, REPUTATION_CHANGES.ISSUE_VERIFIED);
    await client.query(
      'UPDATE users SET rep = $1 WHERE user_id = $2',
      [reporterNewRep, issue.reporter_user_id]
    );

    // Update reporter badges
    const updatedReporter = await client.query('SELECT * FROM users WHERE user_id = $1', [issue.reporter_user_id]);
    const reporterNewBadges = updateBadges(updatedReporter.rows[0]);
    await client.query('UPDATE users SET badges = $1 WHERE user_id = $2', [reporterNewBadges, issue.reporter_user_id]);

    // Check verification count and auto-close if threshold reached
    const verificationCountQuery = 'SELECT COUNT(*) as count FROM verifications WHERE issue_id = $1';
    const verificationCountResult = await client.query(verificationCountQuery, [id]);
    const verificationCount = parseInt(verificationCountResult.rows[0].count);

    const VERIFICATION_THRESHOLD = 3;
    let message = 'Issue verified successfully';
    let autoClosed = false;

    if (verificationCount >= VERIFICATION_THRESHOLD) {
      await client.query(
        'UPDATE issues SET status = $1, updated_at = NOW() WHERE issue_id = $2',
        ['closed', id]
      );
      
      // Update reporter issues_resolved count
      await client.query(
        'UPDATE users SET issues_resolved = issues_resolved + 1 WHERE user_id = $1',
        [issue.reporter_user_id]
      );
      
      message = `Issue verified and auto-closed (${VERIFICATION_THRESHOLD} verifications reached)`;
      autoClosed = true;
    }

    // TODO: Create blockchain transaction
    const blockchainTxHash = `mock_tx_verify_${Date.now()}`;

    await client.query('COMMIT');

    // Get updated issue
    const updatedIssueQuery = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        (SELECT COUNT(*) FROM verifications WHERE issue_id = i.issue_id) as verification_count
      FROM issues i
      WHERE i.issue_id = $1
    `;
    const updatedIssueResult = await client.query(updatedIssueQuery, [id]);
    const updatedIssue = updatedIssueResult.rows[0];

    return res.status(200).json({
      success: true,
      message,
      auto_closed: autoClosed,
      issue: {
        issue_id: updatedIssue.issue_id,
        status: updatedIssue.status,
        verification_count: parseInt(updatedIssue.verification_count)
      },
      rep_rewards: {
        verifier: REPUTATION_CHANGES.VERIFICATION_DONE,
        reporter: REPUTATION_CHANGES.ISSUE_VERIFIED
      },
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

module.exports = {
  verifyIssue
};
