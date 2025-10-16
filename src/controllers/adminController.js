const db = require('../db');

async function getDashboard(req, res) {
  try {
    // Check user role
    if (req.user.role !== 'government') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Government role required.'
      });
    }
    
    // Get statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_issues,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_issues,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_issues,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_issues,
        COUNT(*) as total_issues,
        AVG(priority_score) as avg_priority_score
      FROM issues
    `);
    
    const stats = statsResult.rows[0];
    
    // Get category breakdown
    const categoryResult = await db.query(`
      SELECT category, COUNT(*) as count
      FROM issues
      GROUP BY category
    `);
    
    // Get heatmap data (recent issues with locations)
    const heatmapResult = await db.query(`
      SELECT 
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        priority_score,
        category,
        status
      FROM issues
      WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 1000
    `);
    
    // Get top priority issues
    const topPriorityResult = await db.query(`
      SELECT 
        i.issue_id, i.reporter_user_id, i.wallet_address, i.image_url, i.description, 
        i.category, ST_Y(i.location::geometry) as lat, ST_X(i.location::geometry) as lng,
        i.region, i.status, i.priority_score, i.blockchain_tx_hash, i.upvotes, i.downvotes,
        i.admin_proof_url, i.created_at, i.updated_at,
        u.name as reporter_name, u.profile_pic as reporter_pic
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE i.status IN ('open', 'in_progress')
      ORDER BY i.priority_score DESC
      LIMIT 10
    `);
    
    const topPriorityIssues = topPriorityResult.rows.map(issue => ({
      ...issue,
      location: { lat: issue.lat, lng: issue.lng },
      reporter: {
        user_id: issue.reporter_user_id,
        name: issue.reporter_name,
        profile_pic: issue.reporter_pic
      }
    }));
    
    // Get recent activity stats
    const recentActivityResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as issues_last_7_days,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as issues_last_30_days,
        COUNT(*) FILTER (WHERE status = 'resolved' AND updated_at > NOW() - INTERVAL '7 days') as resolved_last_7_days,
        COUNT(*) FILTER (WHERE status = 'resolved' AND updated_at > NOW() - INTERVAL '30 days') as resolved_last_30_days
      FROM issues
    `);
    
    return res.json({
      success: true,
      stats: {
        ...stats,
        open_issues: parseInt(stats.open_issues),
        in_progress_issues: parseInt(stats.in_progress_issues),
        resolved_issues: parseInt(stats.resolved_issues),
        closed_issues: parseInt(stats.closed_issues),
        total_issues: parseInt(stats.total_issues),
        avg_priority_score: parseFloat(stats.avg_priority_score) || 0,
        category_breakdown: categoryResult.rows.map(r => ({
          category: r.category,
          count: parseInt(r.count)
        })),
        recent_activity: {
          issues_last_7_days: parseInt(recentActivityResult.rows[0].issues_last_7_days),
          issues_last_30_days: parseInt(recentActivityResult.rows[0].issues_last_30_days),
          resolved_last_7_days: parseInt(recentActivityResult.rows[0].resolved_last_7_days),
          resolved_last_30_days: parseInt(recentActivityResult.rows[0].resolved_last_30_days)
        }
      },
      heatmap_data: heatmapResult.rows,
      top_priority_issues: topPriorityIssues
    });
    
  } catch (error) {
    console.error('Get dashboard error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
}

async function getAdminIssues(req, res) {
  try {
    // Check user role
    if (req.user.role !== 'government') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Government role required.'
      });
    }
    
    const { 
      status, 
      category, 
      date_from, 
      date_to, 
      sort_by = 'priority_score', 
      page = 1, 
      limit = 20 
    } = req.query;
    
    let query = `
      SELECT 
        i.issue_id, i.reporter_user_id, i.wallet_address, i.image_url, i.description, 
        i.category, ST_Y(i.location::geometry) as lat, ST_X(i.location::geometry) as lng,
        i.region, i.status, i.priority_score, i.blockchain_tx_hash, i.upvotes, i.downvotes,
        i.admin_proof_url, i.created_at, i.updated_at,
        u.name as reporter_name, u.profile_pic as reporter_pic, u.rep as reporter_rep
      FROM issues i
      JOIN users u ON i.reporter_user_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Status filter
    if (status) {
      query += ` AND i.status = $${++paramCount}`;
      params.push(status);
    }
    
    // Category filter
    if (category) {
      query += ` AND i.category = $${++paramCount}`;
      params.push(category);
    }
    
    // Date range filter
    if (date_from) {
      query += ` AND i.created_at >= $${++paramCount}`;
      params.push(date_from);
    }
    
    if (date_to) {
      query += ` AND i.created_at <= $${++paramCount}`;
      params.push(date_to);
    }
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered_issues`;
    const countResult = await db.query(countQuery, params);
    const totalIssues = parseInt(countResult.rows[0].total);
    
    // Sort
    const validSortFields = ['priority_score', 'created_at', 'updated_at', 'upvotes'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'priority_score';
    query += ` ORDER BY i.${sortField} DESC`;
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limitNum, offset);
    
    const result = await db.query(query, params);
    
    const issues = result.rows.map(issue => ({
      ...issue,
      location: { lat: issue.lat, lng: issue.lng },
      reporter: {
        user_id: issue.reporter_user_id,
        name: issue.reporter_name,
        profile_pic: issue.reporter_pic,
        rep: issue.reporter_rep
      }
    }));
    
    return res.json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalIssues,
        total_pages: Math.ceil(totalIssues / limitNum)
      },
      issues
    });
    
  } catch (error) {
    console.error('Get admin issues error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch issues'
    });
  }
}

module.exports = {
  getDashboard,
  getAdminIssues
};
