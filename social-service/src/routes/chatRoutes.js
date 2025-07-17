const express = require('express');
const router = express.Router();
const { getMessagesForLeague, getMessagesForContest, postMessage, getDirectMessageHistory, postDirectMessage, getPredefinedMessages } = require('../controllers/chatController');

// Import the real auth middleware
const { protect } = require('../middleware/authMiddleware');

// Use the middleware for all chat routes
router.use(protect);

// Route to get chat history for a league
router.get('/:leagueId', getMessagesForLeague);
router.get('/contest/:contestId', getMessagesForContest);
router.post('/send', postMessage);
router.get('/friends/:friendId', getDirectMessageHistory);

// Send a new message to a friend
router.post('/friends', postDirectMessage);
router.get('/predefined-messages', getPredefinedMessages);
module.exports = router;