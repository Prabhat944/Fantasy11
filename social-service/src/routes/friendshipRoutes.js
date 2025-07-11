const express = require('express');
const router = express.Router();
const {
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    getFriendsList,
    getPendingRequests
} = require('../controllers/friendshipController');

// Import the real, secure authentication middleware
const { protect } = require('../middleware/authMiddleware');

// Use the real middleware to protect all routes in this file
// It will verify the JWT and attach the user to the request.
router.use(protect);

router.get('/search', searchUsers);
router.post('/request', sendFriendRequest);
router.post('/respond', respondToRequest);
router.get('/', getFriendsList);
router.get('/pending', getPendingRequests);

module.exports = router;