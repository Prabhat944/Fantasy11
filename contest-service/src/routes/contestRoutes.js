const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const contestController = require('../controllers/contestController');

router.post('/join', authMiddleware, contestController.joinContest);
router.post('/multi-join', authMiddleware, contestController.joinMultipleContests);

module.exports = router;