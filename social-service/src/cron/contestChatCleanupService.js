// // In your Chat Service -> services/cleanupService.js

// const axios = require('axios');
// const cron = require('node-cron');
// const ChatMessage = require('../models/chatMessageModel');

// // Configuration for connecting to the Contest Service
// const contestService = axios.create({
//     baseURL: process.env.CONTEST_SERVICE_URL,
//     headers: {
//         'x-internal-api-key': process.env.INTERNAL_API_TOKEN
//     }
// });

// // const deleteChatsForCompletedContests = async () => {
// //     console.log('Running scheduled job: Deleting chats for completed contests...');

// //     try {
// //         // 1. Call Contest Service to get a list of completed contests
// //         console.log('Fetching completed contests from Contest Service...');
// //         const response = await contestService.get('/api/v1/user/internal/for-chat-cleanup');
// //         const contests = response.data;

// //         if (!contests || contests.length === 0) {
// //             console.log('No newly completed contests found.');
// //             return;
// //         }

// //         const contestIdsToDelete = contests.map(c => c._id);
// //         console.log(`Found ${contestIdsToDelete.length} contests to process.`);

// //         // 2. Delete all chat messages associated with these contests
// //         const deleteResult = await ChatMessage.deleteMany({
// //             contestId: { $in: contestIdsToDelete }
// //         });

// //         if (deleteResult.deletedCount > 0) {
// //             console.log(`Successfully deleted ${deleteResult.deletedCount} chat messages.`);
// //         }

// //         // 3. Call Contest Service again to mark the contests as 'chatDeleted'
// //         console.log('Marking contests as chat-deleted in Contest Service...');
// //         await contestService.patch('/api/v1/user/internal/mark-chat-deleted', {
// //             contestIds: contestIdsToDelete
// //         });

// //         console.log('Successfully updated contests in Contest Service.');

// //     } catch (error) {
// //         // Handle potential errors from the API call
// //         if (error.response) {
// //             console.error('Error from Contest Service:', error.response.status, error.response.data);
// //         } else {
// //             console.error('Error during chat cleanup job:', error.message);
// //         }
// //     }
// // };

// const deleteChatsForCompletedContests = async () => {
//     console.log('Running scheduled job: Cleaning up contest chats...');

//     try {
//         // 1. Get completed contest IDs from Contest Service (This part is unchanged)
//         console.log('Fetching completed contests...');
//         const response = await contestService.get('/api/v1/contestController/internal/for-chat-cleanup');
//         const contests = response.data;

//         if (!contests || contests.length === 0) {
//             console.log('No newly completed contests found.');
//             return;
//         }

//         const completedContestIds = contests.map(c => c._id);
        
//         // 2. Find the CHAT ROOMS associated with these completed contests.
//         // This is the key change: we only target 'group' rooms linked to these contests.
//         const roomsToDelete = await ChatRoom.find({
//             type: 'group',
//             groupSourceId: { $in: completedContestIds }
//         }).select('_id');

//         if (roomsToDelete.length === 0) {
//             console.log('No chat rooms found for the completed contests.');
//             // Still need to mark them as deleted in the contest service
//         } else {
//             const roomIdsToDelete = roomsToDelete.map(r => r._id);

//             // 3. Perform the cascading delete
//             // A) Delete all messages within those specific rooms
//             const messageDeleteResult = await ChatMessage.deleteMany({ chatRoomId: { $in: roomIdsToDelete } });
//             console.log(`Deleted ${messageDeleteResult.deletedCount} messages from temporary contest rooms.`);

//             // B) Delete the temporary room documents themselves
//             const roomDeleteResult = await ChatRoom.deleteMany({ _id: { $in: roomIdsToDelete } });
//             console.log(`Deleted ${roomDeleteResult.deletedCount} temporary chat rooms.`);
//         }

//         // 4. Notify the Contest Service that the cleanup is done (This part is unchanged)
//         console.log('Marking contests as chat-deleted in Contest Service...');
//         await contestService.patch('/api/v1/contestController/internal/mark-chat-deleted', {
//             contestIds: completedContestIds
//         });

//         console.log('Cleanup job finished successfully.');

//     } catch (error) {
//         if (error.response) {
//             console.error('Error from Contest Service:', error.response.status, error.response.data);
//         } else {
//             console.error('Error during chat cleanup job:', error.message);
//         }
//     }
// };
// const scheduleChatCleanup = () => {
//     cron.schedule('* * * * *', deleteChatsForCompletedContests);
//     console.log('Chat cleanup job scheduled. Will run every 10 minutes.');
// };
// scheduleChatCleanup(); 
// module.exports = { scheduleChatCleanup };