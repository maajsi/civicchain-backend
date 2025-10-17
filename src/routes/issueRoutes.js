const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { classifyIssue, reportIssue, getIssues, getIssueById } = require('../controllers/issueController');
const { upvoteIssue, downvoteIssue } = require('../controllers/voteController');
const { verifyIssue } = require('../controllers/verificationController');
const { updateIssueStatus } = require('../controllers/adminController');
const { authMiddleware, requireGovernment } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, JPG and PNG are allowed.'));
    }
  }
});

// POST /issue/classify - Upload image and get AI classification
router.post('/classify', authMiddleware, upload.single('image'), classifyIssue);

// POST /issue/report - Submit final issue report
router.post('/report', authMiddleware, reportIssue);

// GET /issues - Fetch issues with filters
router.get('/', authMiddleware, getIssues);

// GET /issue/:id - Get single issue details
router.get('/:id', authMiddleware, getIssueById);

// POST /issue/:id/upvote - Upvote an issue
router.post('/:id/upvote', authMiddleware, upvoteIssue);

// POST /issue/:id/downvote - Downvote an issue
router.post('/:id/downvote', authMiddleware, downvoteIssue);

// POST /issue/:id/verify - Verify a resolved issue
router.post('/:id/verify', authMiddleware, verifyIssue);

// POST /issue/:id/update-status - Update issue status (government only)
router.post('/:id/update-status', authMiddleware, requireGovernment, upload.single('proof_image'), updateIssueStatus);

module.exports = router;
