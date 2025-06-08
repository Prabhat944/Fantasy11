// In user-service: routes/userMatchRoutes.js
const express = require('express');
const router = express.Router();
const userMatchController = require('../controller/contestThirdPartyApiCall');

router.get('/', userMatchController.getUserMatchRecord);      // For GET /api/user-matches
router.post('/', userMatchController.createUserMatchRecord); // For POST /api/user-matches

module.exports = router;