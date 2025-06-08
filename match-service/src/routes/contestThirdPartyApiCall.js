// In match-service: routes/matchRoutes.js
const express = require('express');
const router = express.Router();
const matchController = require('../controllers/contestThirdPartyApiCall');

// This line connects the incoming request to your new controller function
router.get('/:matchId', matchController.getMatchDetailsForContestService);

module.exports = router;