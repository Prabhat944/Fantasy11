// // jobs/updateSeriesCron.js

// const cron = require('node-cron');
// const Series = require('../models/UpcomingSeries');
// const { upcomingSeriesList } = require('../services/cricketService');
// const redisClient = require('../utils/redisClient');

// const REDIS_KEY = 'cache:upcoming_series';

// const updateSeriesJob = async () => {
//     console.log('---------------------------------');
//     console.log(`[${new Date().toLocaleTimeString()}] Running cron job: Fetching, caching, and cleaning series...`);
    
//     try {
//         const seriesData = await upcomingSeriesList();

//         if (!seriesData) {
//             console.log('API did not return series data. Skipping update.');
//             return;
//         }

//         const freshSeriesIds = seriesData.map(series => series.id);
//         console.log(`Found ${freshSeriesIds.length} upcoming series from the API.`);

//         if (seriesData.length > 0) {
//             const bulkOps = seriesData.map(series => {
//                 // --- NEW: Calculate a proper endDateTime ---
//                 // We take the endDate string (e.g., "Sep 21") and combine it with the start date's year.
//                 const startYear = new Date(series.startDate).getFullYear();
//                 const endDateTime = new Date(`${series.endDate}, ${startYear}`);
//                 // Set to the end of that day to avoid deleting it too early.
//                 endDateTime.setHours(23, 59, 59, 999); 

//                 return {
//                     updateOne: {
//                         filter: { _id: series.id },
//                         update: { 
//                             $set: {
//                                 ...series, // a shortcut to set all matching fields
//                                 _id: series.id,
//                                 startDate: new Date(series.startDate),
//                                 endDateTime: endDateTime // Store our calculated date
//                             } 
//                         },
//                         upsert: true,
//                     }
//                 };
//             });
            
//             const mongoResult = await Series.bulkWrite(bulkOps);
//             console.log('MongoDB (Series) upsert successful:', {
//                 inserted: mongoResult.nUpserted,
//                 updated: mongoResult.nModified,
//             });
//         }
        
//         // --- UPGRADED CLEANUP LOGIC ---
//         // Delete a series if EITHER of these conditions is true:
//         // 1. Its ID is NOT in the list from the API.
//         // 2. Its calculated end date is now in the past.
//         const yesterday = new Date();
//         yesterday.setDate(yesterday.getDate() - 1); // Give a 1-day buffer

//         const deleteResult = await Series.deleteMany({
//             $or: [
//                 { _id: { $nin: freshSeriesIds } },
//                 { endDateTime: { $lt: yesterday } } 
//             ]
//         });

//         if (deleteResult.deletedCount > 0) {
//             console.log(`MongoDB cleanup successful: Deleted ${deleteResult.deletedCount} old/completed series.`);
//         }

//         // --- Update Redis Cache ---
//         // This remains the same. We always overwrite the cache with the freshest data from the API.
//         const expirationInSeconds = 7200; 
//         redisClient.setEx(
//             REDIS_KEY,
//             expirationInSeconds,
//             JSON.stringify(seriesData) 
//         );
//         console.log(`Redis cache updated. Key: "${REDIS_KEY}" now contains ${seriesData.length} series.`);

//     } catch (error) {
//         console.error('An error occurred during the updateSeriesJob:', error.message);
//     } finally {
//         console.log(`Cron job for SERIES finished at ${new Date().toLocaleTimeString()}.`);
//     }
// };

// const scheduleSeriesJob = () => {
//   updateSeriesJob();
//   cron.schedule('0 * * * *', updateSeriesJob, {
//     scheduled: true,
//     timezone: "Asia/Kolkata"
//   });
//   console.log('✅ Upcoming SERIES cron job (with enhanced cleanup) scheduled.');
// };

// scheduleSeriesJob();

// module.exports = { scheduleSeriesJob };