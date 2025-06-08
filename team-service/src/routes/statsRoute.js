const express = require('express');
const router = express.Router();
const { getPlayerSelectionStats } = require('../controllers/statsController');
const redisClient = require('../utils/redisClient');

router.get('/stats/:matchId', async (req, res) => {
  const { matchId } = req.params;

  // Check Redis first
  const cached = await redisClient.get(`stats:${matchId}`);
  if (cached) return res.json(JSON.parse(cached));

  // Calculate if not in Redis
  const stats = await getPlayerSelectionStats(matchId);
  res.json(stats);
});

module.exports = router;
