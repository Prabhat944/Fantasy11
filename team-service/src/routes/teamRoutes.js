const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
// const matchController = require('../controllers/matchController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/team/create', authMiddleware, teamController.createTeam);

router.get('/team/user', authMiddleware, teamController.getUserTeams);

router.put('/teams/:teamId', authMiddleware, teamController.updateUserTeam);

router.post('/team/clone/:teamId', authMiddleware, teamController.cloneTeam);

module.exports = router;
