// user-service/src/routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const userProfileController = require('../controller/userProfileController');

router.get('/me/detailed', authMiddleware, userProfileController.getDetailedUserProfile);

module.exports = router;