// In user-service: routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controller/teamThirdPartyApiCall'); // Adjust path as needed

// Route for GET /api/users/:userId
// This is the endpoint that team-service's checkUserExists will call
router.get('/:userId', userController.getUserProfileById);

// Other user-specific routes
// router.post('/register', userController.registerUser);
// router.post('/login', userController.loginUser);
// ... etc.

// If you have routes for UserMatch, they might look like:
// router.post('/:userId/matches', userMatchController.addUserMatch); // Example
// Or they might be under a completely different path like /api/user-matches

module.exports = router;