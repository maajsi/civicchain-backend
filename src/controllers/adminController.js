const pool = require('../config/database');
const { updateIssueStatusOnChain } = require('../services/solanaService');

/**
 * GET /admin/dashboard
 * Get dashboard statistics and heatmap data
 */
async function getDashboard(req, res) {
  const client = await pool.connect();
  
  try {
    // Get overall statistics
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM issues) as total_issues,
        (SELECT COUNT(*) FROM issues WHERE status = 'open') as open_issues,
        (SELECT COUNT(*) FROM issues WHERE status = 'in_progress') as in_progress_issues,
        (SELECT COUNT(*) FROM issues WHERE status = 'resolved') as resolved_issues,
        (SELECT COUNT(*) FROM issues WHERE status = 'closed') as closed_issues,
        (SELECT COUNT(*) FROM users WHERE role = 'citizen') as total_citizens,
        (SELECT AVG(priority_score) FROM issues WHERE status IN ('open', 'in_progress')) as avg_priority
    `;
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get category breakdown
    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM issues
      GROUP BY category
      ORDER BY count DESC
    `;
    const categoryResult = await client.query(categoryQuery);

    // Get heatmap data (all issues with locations)
    const heatmapQuery = `
      SELECT 
        issue_id,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        priority_score,
        status,
        category
      FROM issues
      WHERE status IN ('open', 'in_progress')
    `;
    const heatmapResult = await client.query(heatmapQuery);

    // Get top priority issues
    const topPriorityQuery = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        u.name as reporter_name,
        u.profile_pic as reporter_profile_pic
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE i.status IN ('open', 'in_progress')
      ORDER BY i.priority_score DESC
      LIMIT 10
    `;
    const topPriorityResult = await client.query(topPriorityQuery);

    return res.status(200).json({
      success: true,
      stats: {
        total_issues: parseInt(stats.total_issues),
        open_issues: parseInt(stats.open_issues),
        in_progress_issues: parseInt(stats.in_progress_issues),
        resolved_issues: parseInt(stats.resolved_issues),
        closed_issues: parseInt(stats.closed_issues),
        total_citizens: parseInt(stats.total_citizens),
        avg_priority: parseFloat(stats.avg_priority || 0).toFixed(2),
        category_breakdown: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count)
        }))
      },
      heatmap_data: heatmapResult.rows.map(row => ({
        issue_id: row.issue_id,
        lat: row.lat,
        lng: row.lng,
        priority_score: row.priority_score,
        status: row.status,
        category: row.category
      })),
      top_priority_issues: topPriorityResult.rows.map(row => ({
        issue_id: row.issue_id,
        reporter_user_id: row.reporter_user_id,
        reporter_name: row.reporter_name,
        reporter_profile_pic: row.reporter_profile_pic,
        image_url: row.image_url,
        description: row.description,
        category: row.category,
        lat: row.lat,
        lng: row.lng,
        region: row.region,
        status: row.status,
        priority_score: row.priority_score,
        upvotes: row.upvotes,
        downvotes: row.downvotes,
        created_at: row.created_at
      }))
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  } finally {
    client.release();
  }
}

/**
 * GET /admin/issues
 * Get all issues with advanced filters
 */
async function getAdminIssues(req, res) {
  const client = await pool.connect();
  
  try {
    const { status, category, date_from, date_to, sort_by, page, limit } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        i.*,
        ST_Y(i.location::geometry) as lat,
        ST_X(i.location::geometry) as lng,
        u.name as reporter_name,
        u.profile_pic as reporter_profile_pic,
        u.email as reporter_email,
        (SELECT COUNT(*) FROM verifications WHERE issue_id = i.issue_id) as verification_count
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters
    if (status) {
      paramCount++;
      query += ` AND i.status = $${paramCount}`;
      params.push(status);
    }

    if (category) {
      paramCount++;
      query += ` AND i.category = $${paramCount}`;
      params.push(category);
    }

    if (date_from) {
      paramCount++;
      query += ` AND i.created_at >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND i.created_at <= $${paramCount}`;
      params.push(date_to);
    }

    // Add sorting
    const sortMapping = {
      priority: 'i.priority_score DESC',
      date_newest: 'i.created_at DESC',
      date_oldest: 'i.created_at ASC',
      upvotes: 'i.upvotes DESC'
    };
    const sortClause = sortMapping[sort_by] || 'i.priority_score DESC';
    query += ` ORDER BY ${sortClause}`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limitNum);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await client.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM issues i
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamCount = 0;

    if (status) {
      countParamCount++;
      countQuery += ` AND i.status = $${countParamCount}`;
      countParams.push(status);
    }

    if (category) {
      countParamCount++;
      countQuery += ` AND i.category = $${countParamCount}`;
      countParams.push(category);
    }

    if (date_from) {
      countParamCount++;
      countQuery += ` AND i.created_at >= $${countParamCount}`;
      countParams.push(date_from);
    }

    if (date_to) {
      countParamCount++;
      countQuery += ` AND i.created_at <= $${countParamCount}`;
      countParams.push(date_to);
    }

    const countResult = await client.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    const issues = result.rows.map(row => ({
      issue_id: row.issue_id,
      reporter_user_id: row.reporter_user_id,
      reporter_name: row.reporter_name,
      reporter_profile_pic: row.reporter_profile_pic,
      reporter_email: row.reporter_email,
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
      verification_count: parseInt(row.verification_count),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limitNum)
      },
      issues
    });

  } catch (error) {
    console.error('Get admin issues error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issues'
    });
  } finally {
    client.release();
  }
}

/**
 * POST /issue/:id/update-status
 * Update issue status (government only)
 */
async function updateIssueStatus(req, res) {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
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

    // Update issue status
    await client.query(
      'UPDATE issues SET status = $1, updated_at = NOW() WHERE issue_id = $2',
      [status, id]
    );

    // Handle proof image if provided
    let proofUrl = null;
    if (req.file) {
      proofUrl = `/uploads/${req.file.filename}`;
      await client.query(
        'UPDATE issues SET admin_proof_url = $1 WHERE issue_id = $2',
        [proofUrl, id]
      );
    }

    // Update issue status on blockchain
    const issue = issueResult.rows[0];
    const blockchainTxHash = await updateIssueStatusOnChain(req.user.private_key, issue.issue_id, status);
    await client.query(
      'UPDATE issues SET blockchain_tx_hash = $1 WHERE issue_id = $2',
      [blockchainTxHash, id]
    );

    await client.query('COMMIT');

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
      message: 'Issue status updated successfully',
      issue: {
        issue_id: updatedIssue.issue_id,
        status: updatedIssue.status,
        admin_proof_url: updatedIssue.admin_proof_url,
        updated_at: updatedIssue.updated_at
      },
      blockchain_tx_hash: blockchainTxHash
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update issue status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update issue status'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getDashboard,
  getAdminIssues,
  updateIssueStatus
};
