// // In a file like jobs/updateSquadsCron.js

// const cron = require('node-cron');
// const Match = require('../models/UpcomingMatches'); // Using your provided model name
// const RecentMatch = require('../models/RecentMatch');
// const Squad = require('../models/Squad');
// const cricketDataService = require('../services/cricketService');

// const updateAllSquadsJob = async () => {
//     console.log('----------------------------------------------------');
//     console.log(`[${new Date().toLocaleTimeString()}] Running SQUAD update cron job...`);

//     try {
//         const upcomingMatches = await Match.find({ dateTimeGMT: { $gt: new Date() } }, '_id').lean();
//         const liveMatches = await RecentMatch.find({ matchEnded: false }, '_id').lean();

//         const allMatchIdsToProcess = [...new Set([
//             ...upcomingMatches.map(m => m._id.toString()),
//             ...liveMatches.map(m => m._id.toString())
//         ])];
        
//         if (allMatchIdsToProcess.length === 0) {
//             console.log('[SQUAD CRON] No upcoming or live matches found to fetch squads for.');
//             return;
//         }
//         console.log(`[SQUAD CRON] Found ${allMatchIdsToProcess.length} matches to check for squads.`);

//         for (const matchId of allMatchIdsToProcess) {
//             try {
//                 // ✅ FIX: REMOVED THE `if (squadExists) continue;` CHECK.
//                 // We will now always fetch to get the latest data.

//                 const squadResponse = await cricketDataService.matchSquad(matchId);
//                 const squadData = squadResponse?.data;

//                 if (Array.isArray(squadData) && squadData.length > 0) {
//                     const enrichedSquadData = squadData.map(team => ({
//                         ...team,
//                         players: team.players.map(player => ({ ...player, teamName: team.teamName }))
//                     }));

//                     // This command will now create the document if it doesn't exist,
//                     // or update the existing one with the full squad data.
//                     await Squad.findOneAndUpdate(
//                         { _id: matchId },
//                         { $set: { squad: enrichedSquadData } },
//                         { upsert: true, new: true }
//                     );

//                     // ✅ Best Practice: Update the hasSquad flag on the original match documents.
//                     await Match.updateOne({ _id: matchId }, { $set: { hasSquad: true } });
//                     await RecentMatch.updateOne({ _id: matchId }, { $set: { hasSquad: true } });
                    
//                     console.log(`[SQUAD CRON] Successfully saved/updated squad for match ${matchId}.`);
//                 }
//             } catch (error) {
//                 // This warning is normal and expected if a squad hasn't been announced yet.
//                 // console.warn(`[SQUAD CRON] Could not fetch squad for match ${matchId}.`);
//             }
//         }
        
//     } catch (error) {
//         console.error('A critical error occurred in updateAllSquadsJob:', error.message);
//     } finally {
//         console.log(`SQUAD update job finished at ${new Date().toLocaleTimeString()}.`);
//     }
// };

// const scheduleSquadsJob = () => {
//     // Run the job immediately on start, then schedule it.
//     updateAllSquadsJob(); 

//     cron.schedule('* * * * *', updateAllSquadsJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Match Squads cron job (for upcoming & live) scheduled every 10 minutes.');
// };

// // If you run this file directly (node jobs/updateSquadsCron.js), it will start the scheduler.
// // Make sure this is only called once in your main application entry point.
// scheduleSquadsJob(); 

// module.exports = { scheduleSquadsJob, updateAllSquadsJob };

