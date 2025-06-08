const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Team = require('../models/TeamSchema');
const { getPlayerSelectionStats } = require('../controllers/statsController');

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const runCron = async () => {
  const matchIds = await Team.distinct('matchId');

  for (const matchId of matchIds) {
    console.log(`🔄 Updating stats for match: ${matchId}`);
    await getPlayerSelectionStats(matchId);
  }

  console.log("✅ Stats cache updated.");
  process.exit(0);
};

runCron();
