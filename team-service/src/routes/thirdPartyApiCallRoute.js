const express = require('express');
const router = express.Router();
const teamController = require('../controllers/contestThirdPartyApiCalls'); // Adjust path as needed

router.get('/:teamId', teamController.getTeamByIdAndUserMatch);


module.exports = router;