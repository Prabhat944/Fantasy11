const express = require('express');
const router = express.Router();
const controller = require('../controllers/matchController');
const authMiddleware = require('../middleware/authMiddleware');


router.get('/cricket/up-coming-matches', controller.getUpcomingMatches);
router.get('/cricket/match/:matchId', controller.getMatchDetails);
router.get('/cricket/recent-matches', controller.getRecentMatches);
console.log('Cricket routes loaded');
router.get('/my-matches', authMiddleware, controller.getMyMatches);
router.get(
    '/matches/my-contests/:matchId', 
    authMiddleware, 
    controller.getUserContestsForMatch
);
module.exports = router;
