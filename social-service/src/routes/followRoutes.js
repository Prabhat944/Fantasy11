// routes/followRoutes.js

const express = require('express');
const router = express.Router();
const { followUser, unfollowUser, getFollowers, getFollowing } = require('../controllers/followController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Follow a user
router.post('/:userId', followUser);

// Unfollow a user
router.delete('/:userId', unfollowUser);

// Get a user's followers
router.get('/:userId/followers', getFollowers);

// Get a user's following list
router.get('/:userId/following', getFollowing);

module.exports = router;