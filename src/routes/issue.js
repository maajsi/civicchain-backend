const express = require('express');
const router = express.Router();
const issueController = require('../controllers/issueController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

// POST /api/issue/classify
router.post(
  '/classify',
  authenticateToken,
  upload.single('image'),
  handleUploadError,
  issueController.classifyImage
);

// POST /api/issue/report
router.post('/report', authenticateToken, issueController.reportIssue);

// GET /api/issues
router.get('s', authenticateToken, issueController.getIssues);

// GET /api/issue/:id
router.get('/:id', authenticateToken, issueController.getIssueById);

// POST /api/issue/:id/upvote
router.post('/:id/upvote', authenticateToken, issueController.upvoteIssue);

// POST /api/issue/:id/downvote
router.post('/:id/downvote', authenticateToken, issueController.downvoteIssue);

// POST /api/issue/:id/verify
router.post('/:id/verify', authenticateToken, issueController.verifyIssue);

// POST /api/issue/:id/update-status
router.post(
  '/:id/update-status',
  authenticateToken,
  requireRole('government'),
  upload.single('proof_image'),
  handleUploadError,
  issueController.updateIssueStatus
);

module.exports = router;
