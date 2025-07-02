// In a file like jobs/updateMatchStatsCron.js

const cron = require('node-cron');
const { matchUpdateBallByBall } = require('../services/cricketService');
const parseMatchData = require('../utils/parseMatchData');
const PlayerPerformance = require('../models/PlayerPerformanceSchema');
const RecentMatch = require('../models/RecentMatch');
const Squad = require('../models/Squad');

/**
 * This cron job is responsible for updating player points for all live matches
 * and doing a final calculation for newly completed matches.
 */
const updateMatchStatsJob = async () => {
  console.log('---[STATS CRON START]---');
  
  try {
    // STEP 1: Fetch ALL recent matches (both live and completed) from our local DB.
    // The logic inside the loop will handle skipping matches that are already finalized.
    const activeMatches = await RecentMatch.find({}).lean();

    if (activeMatches.length === 0) {
      console.log('[STATS CRON] No active matches found in the recent collection.');
      console.log('---[STATS CRON END]---');
      return;
    }
    console.log(`[STATS CRON] Found ${activeMatches.length} total matches in the recent collection to check.`);

    for (const match of activeMatches) {
      const matchId = match._id.toString();

      // Check if we have already processed and finalized this match. If so, skip it.
      // This is the most efficient way to prevent reprocessing completed matches.
      const isFinalized = await PlayerPerformance.exists({ matchId: matchId, matchStatus: 'COMPLETED' });
      if (isFinalized) {
        continue; // Skip this iteration, move to the next match
      }

      console.log(`[STATS CRON] Processing stats for match: ${matchId} ("${match.name}")`);

      // STEP 2: Fetch the squad for this match from our local DB.
      const squadDoc = await Squad.findById(matchId).lean();
      if (!squadDoc || !squadDoc.squad || squadDoc.squad.length === 0) {
          console.warn(`[STATS CRON] Could not find squad data for match ${matchId} in local DB. Skipping.`);
          continue;
      }

      // Combine all players from both teams into a single list
      const playingXI = squadDoc.squad.flatMap(team => team.players);
      if (playingXI.length === 0) {
          console.warn(`[STATS CRON] Squad found for match ${matchId}, but player list is empty. Skipping.`);
          continue;
      }

      // STEP 3: Make the ONLY necessary external API call for ball-by-ball data.
      try {
        const bbbRes = await matchUpdateBallByBall(matchId);
        const bbb = bbbRes?.data?.bbb;

        if (bbb && Array.isArray(bbb) && bbb.length > 0) {
          // Process the new data using your point calculation utility
          await parseMatchData(bbb, matchId, match.matchType, playingXI);
          console.log(`[STATS CRON] Successfully updated stats for match ${matchId}.`);

          // If the match data now says it has ended, finalize the performance records
          if (match.matchEnded) {
            await PlayerPerformance.updateMany({ matchId: matchId }, { $set: { matchStatus: 'COMPLETED' } });
            console.log(`[STATS CRON] >>> Successfully FINALIZED all performance records for match ${matchId}.`);
          }
        } else if (!match.matchEnded) {
            // Only log this message if the match is still live, to avoid clutter.
            console.log(`[STATS CRON] No new ball-by-ball data for live match ${matchId}.`);
        }
      } catch (bbbError) {
          console.error(`[STATS CRON] Error fetching ball-by-ball for ${matchId}:`, bbbError.message);
      }
    }
  } catch (err) {
    console.error('[STATS CRON] A critical error occurred:', err.message);
  } finally {
    console.log('---[STATS CRON END]---');
  }
};

/**
 * Schedules the cron job to run at a set interval.
 */
const scheduleStatsJob = () => {
    updateMatchStatsJob();
    // Run every minute to get live updates
    cron.schedule('* * * * *', updateMatchStatsJob, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('✅ Match Stats cron job (for live & completed) scheduled to run every minute.');
};

// This line starts the scheduling process as soon as the file is loaded.
scheduleStatsJob();

module.exports = { scheduleStatsJob };
