// user-service/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
// Assuming getCurrentUser and updateUser were in authController,
// or move them to a dedicated userController if preferred.
const { getCurrentUser, updateUser } = require('../controller/authController'); // Or a new userController
const authMiddleware = require('../middleware/authMiddleware'); // Adjusted path

router.get('/me', authMiddleware, getCurrentUser);
router.put('/update', authMiddleware, updateUser);

module.exports = router;