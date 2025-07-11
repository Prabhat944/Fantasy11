const express = require('express');
const router = express.Router();
const { createLeague } = require('../controllers/leagueController');

// Import the real auth middleware
const { protect } = require('../middleware/authMiddleware');

// Use the middleware for all routes in this file
router.use(protect);

// Now, when createLeague is called, req.user will be securely populated
router.post('/', createLeague);

module.exports = router;