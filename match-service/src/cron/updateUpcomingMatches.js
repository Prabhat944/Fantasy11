// // jobs/updateMatchesCron.js

// const cron = require('node-cron');
// const Series = require('../models/UpcomingSeries'); // ❗ IMPORTANT: Make sure this filename is correct!
// const Match = require('../models/UpcomingMatches');   // ❗ IMPORTANT: Make sure this filename is correct!
// const cricketDataService = require('../services/cricketService');
// const redisClient = require('../utils/redisClient'); // Assuming your redis client is in utils

// const updateAllMatchesJob = async () => {
//     console.log('====================================================');
//     console.log(`[${new Date().toLocaleTimeString()}] Running FULL MATCH update job (with Redis Fallback)...`);
    
//     let activeSeriesIds = [];

//     try {
//         // --- Step 1: Try to get the list of series IDs from Redis first ---
//         const redisKey = 'cache:upcoming_series';
//         try {
//             const cachedSeriesString = await redisClient.get(redisKey);
//             if (cachedSeriesString) {
//                 console.log("Cache HIT: Got series list from Redis.");
//                 const cachedSeries = JSON.parse(cachedSeriesString);
//                 activeSeriesIds = cachedSeries.map(s => s.id);
//             }
//         } catch (redisError) {
//             console.warn(`A non-critical Redis error occurred: ${redisError.message}. Proceeding with MongoDB fallback.`);
//             // If Redis fails, we do nothing here. The next block will handle it.
//         }
        
//         // --- Step 2: If Redis was empty or failed, fall back to MongoDB ---
//         if (activeSeriesIds.length === 0) {
//             console.log("Cache MISS or Redis error. Falling back to MongoDB for series list.");
//             const activeSeriesFromDB = await Series.find({}, '_id').lean();
//             activeSeriesIds = activeSeriesFromDB.map(s => s._id);
//         }

//         if (activeSeriesIds.length === 0) {
//             console.log('No active series found in database or cache. Exiting job.');
//             return;
//         }

//         console.log(`Found ${activeSeriesIds.length} active series to process.`);

//         // --- Step 3: Fetch all matches for the active series ---
//         let allMatchesFromApi = [];
//         for (const seriesId of activeSeriesIds) {
//             try {
//                 const seriesInfoResponse = await cricketDataService.getSeriesById(seriesId);
//                 const matchList = seriesInfoResponse?.data?.matchList;

//                 if (Array.isArray(matchList)) {
//                     const matchesForThisSeries = matchList.map(match => ({ ...match, seriesId: seriesId }));
//                     allMatchesFromApi.push(...matchesForThisSeries);
//                 } else {
//                     console.warn(`No 'matchList' found for series ${seriesId}. Skipping.`);
//                 }
//             } catch (error) {
//                 console.error(`Failed to fetch details for series ${seriesId}: ${error.message}`);
//             }
//         }
        
//         console.log(`Total matches collected from API: ${allMatchesFromApi.length}`);
        
//         // --- Step 4: Save all collected matches to the Match collection ---
//         if (allMatchesFromApi.length > 0) {
//             const bulkOps = allMatchesFromApi.map(match => ({
//                 updateOne: {
//                     filter: { _id: match.id },
//                     update: { $set: { ...match, _id: match.id, date: new Date(match.date), dateTimeGMT: new Date(match.dateTimeGMT + 'Z') } },
//                     upsert: true
//                 }
//             }));
//             const result = await Match.bulkWrite(bulkOps);
//             console.log('Match collection updated:', { inserted: result.nUpserted, updated: result.nModified });
//         }

//         // --- Step 5: Clean up old/completed matches and matches from inactive series ---
//         const cleanupResult = await Match.deleteMany({
//             $or: [
//                 { seriesId: { $nin: activeSeriesIds } }, // Match's series is no longer active
//                 { dateTimeGMT: { $lt: new Date() } }    // Match's start time is in the past
//             ]
//         });

//         if (cleanupResult.deletedCount > 0) {
//             console.log(`Cleanup successful: Deleted ${cleanupResult.deletedCount} old or completed matches.`);
//         }

//     } catch (error) {
//         console.error('A critical error occurred in updateAllMatchesJob:', error.message);
//     } finally {
//         console.log(`FULL MATCH update job finished at ${new Date().toLocaleTimeString()}.`);
//         console.log('====================================================');
//     }
// };

// const scheduleMatchesJob = () => {
//     updateAllMatchesJob(); // Run once on startup
//     cron.schedule('*/15 * * * *', updateAllMatchesJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Full match details cron job (with Redis Fallback) scheduled to run every 15 minutes.');
// };

// scheduleMatchesJob();

// module.exports = { scheduleMatchesJob };