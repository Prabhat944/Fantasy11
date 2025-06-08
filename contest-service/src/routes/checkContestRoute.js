// In your routes/debugRoutes.js (or similar)
const express = require('express');
const router = express.Router();
// Assuming your controller is named debugController or contestController
const { getContestsForMatchCheck } = require('../controllers/checkContest'); // Adjust path

// You might want to protect this route with authentication/authorization middleware
// const { protect, authorizeAdmin } = require('../middleware/authMiddleware');
// router.get('/check-contests', protect, authorizeAdmin, getContestsForMatchCheck);

router.get('/check-contests', getContestsForMatchCheck); // Or with auth middleware

module.exports = router;