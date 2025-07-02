// // jobs/updateRecentMatchesCron.js

// const cron = require('node-cron');
// const RecentMatch = require('../models/RecentMatch'); // ❗ IMPORTANT: Make sure this filename is correct!
// const cricketDataService = require('../services/cricketService'); // ❗ IMPORTANT: Make sure this path is correct!

// /**
//  * Fetches the latest list of recent/live matches, updates the database,
//  * and cleans up old records based on a retention policy.
//  */
// const updateRecentMatchesJob = async () => {
//     console.log('----------------------------------------------------');
//     console.log(`[${new Date().toLocaleTimeString()}] Running RECENT matches cron job...`);

//     try {
//         // Step 1: Fetch the latest data from the API
//         const response = await cricketDataService.recentMatchesList();
//         const recentMatchesData = response?.data;

//         if (!Array.isArray(recentMatchesData) || recentMatchesData.length === 0) {
//             console.log('No recent matches data returned from API. Job finished.');
//             return;
//         }
        
//         const freshMatchIds = recentMatchesData.map(match => match.id);
//         console.log(`Found ${freshMatchIds.length} recent/live matches from API.`);

//         // Step 2: Save all new/updated match data to MongoDB
//         const bulkOps = recentMatchesData.map(match => ({
//             updateOne: {
//                 filter: { _id: match.id },
//                 update: { $set: { ...match, _id: match.id, date: new Date(match.date), dateTimeGMT: new Date(match.dateTimeGMT + 'Z') } },
//                 upsert: true
//             }
//         }));
//         const result = await RecentMatch.bulkWrite(bulkOps);
//         console.log('RecentMatches collection updated:', { inserted: result.nUpserted, updated: result.nModified });


//         // Step 3: Enforce the data retention policy
        
//         // Define our retention policy: 6 days.
//        // Step 3: Enforce the data retention policy
// const retentionDate = new Date();
// retentionDate.setDate(retentionDate.getDate() - 6);

// // Delete any match that is BOTH no longer in the recent list AND older than 6 days
// const cleanupResult = await RecentMatch.deleteMany({
//   $and: [
//     { _id: { $nin: freshMatchIds } },
//     { dateTimeGMT: { $lt: retentionDate } }
//   ]
// });

//         if (cleanupResult.deletedCount > 0) {
//             console.log(`Data Retention: Deleted ${cleanupResult.deletedCount} matches that were too old or no longer recent.`);
//         }

//     } catch (error) {
//         console.error('A critical error occurred in updateRecentMatchesJob:', error.message);
//     } finally {
//         console.log(`RECENT matches job finished at ${new Date().toLocaleTimeString()}.`);
//     }
// };

// /**
//  * Schedules the cron job to run at a set interval.
//  */
// const scheduleRecentMatchesJob = () => {
//     updateRecentMatchesJob(); // Run once immediately on application startup
    
//     // Runs every minute to keep live scores and statuses as fresh as possible.
//     cron.schedule('* * * * *', updateRecentMatchesJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });

//     console.log('✅ Recent Matches cron job (with 6-day Data Retention) scheduled to run every minute.');
// };

// // This line starts the scheduling process as soon as the file is loaded.
// scheduleRecentMatchesJob();

// // Export the function in case you need to trigger it manually elsewhere.
// module.exports = { scheduleRecentMatchesJob };