// file: scripts/manualMatchSync.js
require('dotenv').config(); // If you use environment variables for DB URI etc.
const mongoose = require('mongoose');
const { syncUpcomingMatchesWithDB } = require('../controllers/matchSyncService'); // Adjust path
const connectDB = require('../config/db'); // Your Mongoose connection function

const runSync = async () => {
  await connectDB(); // Connect to MongoDB
  console.log('Starting manual match sync...');
  const result = await syncUpcomingMatchesWithDB();
  console.log('Manual match sync finished.', result);
  await mongoose.disconnect();
  process.exit(0);
};

runSync().catch(async err => {
  console.error('Manual sync failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});