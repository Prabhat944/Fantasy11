const express = require('express');
const router = express.Router();
const { getMessagesForLeague, getMessagesForContest, postMessage } = require('../controllers/chatController');

// Import the real auth middleware
const { protect } = require('../middleware/authMiddleware');

// Use the middleware for all chat routes
router.use(protect);

// Route to get chat history for a league
router.get('/:leagueId', getMessagesForLeague);
router.get('/contest/:contestId', getMessagesForContest);
router.post('/send', postMessage);
module.exports = router;