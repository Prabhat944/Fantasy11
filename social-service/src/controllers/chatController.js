const ChatMessage = require('../models/chatMessageModel');
const League = require('../models/leagueModel'); // To verify league membership
const UserService = require('../service/userServcie');
const ChatRoom = require('../models/chatRoomModel');
const PredefinedMessage = require('../models/predefinedMessageModel');
const axios = require('axios');

const teamService = axios.create({
    baseURL: process.env.TEAM_SERVICE_URL, // e.g., 'http://localhost:3002/api'
    headers: { 'x-internal-api-key': process.env.INTERNAL_API_TOKEN }
});
const contestService = axios.create({
    baseURL: process.env.CONTEST_SERVICE_URL,
    headers: { 'x-internal-api-key': process.env.INTERNAL_API_TOKEN }
});
/**
 * @desc    Get all messages for a specific league
 * @route   GET /api/chat/:leagueId
 * @access  Private (for league members)
 */
exports.getMessagesForContest = async (req, res) => {
    try {
        const { contestId } = req.params;
        const token = req.headers.authorization?.split(' ')[1];

        // 1. Fetch the raw messages without populating
        const messages = await ChatMessage.find({ contestId: contestId })
            .sort({ createdAt: 'asc' })
            .lean(); // Use .lean() for plain JS objects

        if (messages.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Collect all unique sender IDs
        const senderIds = [...new Set(messages.map(m => m.sender.toString()))];

        // 3. Fetch all sender details in one API call from the User Service
        const senders = await UserService.getUsersByIds(senderIds, token);
        const sendersMap = new Map(senders.map(s => [s._id.toString(), s]));

        // 4. Manually "populate" the messages with the sender details
        const populatedMessages = messages.map(message => {
            message.sender = sendersMap.get(message.sender.toString());
            return message;
        });

        res.status(200).json(populatedMessages);

    } catch (error) {
        console.error('Error fetching contest messages:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};


// 👇 --- CORRECTED FUNCTION FOR LEAGUES ---
exports.getMessagesForLeague = async (req, res) => {
    try {
        const { leagueId } = req.params;
        const userId = req.user.userId; // Correctly use userId from your JWT payload
        const token = req.headers.authorization?.split(' ')[1];

        const league = await League.findById(leagueId);
        if (!league || !league.members.map(m => m.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Forbidden: You are not a member of this league.' });
        }

        // 1. Fetch raw messages
        const messages = await ChatMessage.find({ leagueId: leagueId })
            .sort({ createdAt: 'asc' })
            .lean();

        if (messages.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Collect sender IDs
        const senderIds = [...new Set(messages.map(m => m.sender.toString()))];

        // 3. Fetch sender details from User Service
        const senders = await UserService.getUsersByIds(senderIds, token);
        const sendersMap = new Map(senders.map(s => [s._id.toString(), s]));

        // 4. Manually populate
        const populatedMessages = messages.map(message => {
            message.sender = sendersMap.get(message.sender.toString());
            return message;
        });

        res.status(200).json(populatedMessages);
    } catch (error) {
        console.error('Error fetching league messages:', error);
        res.status(500).json({ message: 'Server error fetching messages.' });
    }
};

exports.postMessage = async (req, res) => {
    try {
      const { roomType, roomId, content } = req.body;
      const senderId = req.user.userId;
      const token = req.headers.authorization?.split(' ')[1];
  
      if (!senderId) {
        return res.status(403).json({ message: 'User ID not found in token.' });
      }
  
      // --- 1. Save the new message (without populating) ---
      let newMessage = new ChatMessage({
        content,
        sender: senderId,
        ...(roomType === 'league' && { leagueId: roomId }),
        ...(roomType === 'contest' && { contestId: roomId }),
      });
      await newMessage.save();
  
      // --- 2. Manually "Populate" by calling the User Service ---
      const senderDetails = await UserService.getUserById(senderId, token);
  
      // --- 3. Combine the message and sender details ---
      // Convert the Mongoose document to a plain object
      const finalMessage = newMessage.toObject(); 
      // Attach the sender details we fetched
      finalMessage.sender = senderDetails; 
  
      // --- 4. Broadcast the complete payload ---
      req.io.to(roomId).emit('newMessage', finalMessage);
  
      res.status(201).json({ message: 'Message sent successfully', chatMessage: finalMessage });
  
    } catch (error) {
      console.error('Error posting message:', error);
      res.status(500).json({ message: 'Server error while posting message.' });
    }
};

exports.getDirectMessageHistory = async (req, res) => {
    try {
        const loggedInUserId = req.user.userId;
        const friendId = req.params.friendId;
        const token = req.headers.authorization?.split(' ')[1];

        // 1. Find the direct message room
        const room = await ChatRoom.findOne({
            type: 'directMessage',
            participants: { $all: [loggedInUserId, friendId] }
        });

        if (!room) {
            return res.status(200).json([]);
        }

        // 2. Fetch all messages for the room
        let messages = await ChatMessage.find({ chatRoomId: room._id })
            .sort({ createdAt: 'asc' })
            .lean();

        if (messages.length === 0) {
            return res.json([]);
        }

        // 3. Populate sender details (efficiently)
        const senderIds = [...new Set(messages.map(m => m.sender.toString()))];
        const senders = await UserService.getUsersByIds(senderIds, token);
        const sendersMap = new Map(senders.map(s => [s._id.toString(), s]));

        messages.forEach(message => {
            message.sender = sendersMap.get(message.sender.toString());
        });

        // 4. NEW: Collect all Team IDs from 'team_share' messages
        const teamIdsToFetch = messages
            .filter(m => m.messageType === 'team_share')
            .map(m => m.content);
        
        // 5. NEW: If we have team IDs, fetch their details from the Team Service
        if (teamIdsToFetch.length > 0) {
            const response = await teamService.post('/api/v1/team/internal/by-ids', {
                teamIds: teamIdsToFetch
            });
            const teams = response.data;
            
            // 6. NEW: Create a map for quick lookup of teams by their ID
            const teamsMap = new Map(teams.map(t => [t._id.toString(), t]));

            // 7. NEW: Final loop to replace the team ID with the full team object
            messages.forEach(message => {
                if (message.messageType === 'team_share') {
                    // Replace the ID in 'content' with the full object
                    message.content = teamsMap.get(message.content);
                }
            });
        }
        
        res.status(200).json(messages);

    } catch (error) {
        console.error('Error fetching direct messages:', error);
        res.status(500).json({ message: 'Server error fetching messages.' });
    }
};

// exports.postDirectMessage = async (req, res) => {
//     try {
//         const senderId = req.user.userId;
//         const {
//             roomType,
//             roomId,
//             messageType = 'predefined', // Default to 'predefined'
//             // The client will now send one of these two:
//             predefinedMessageId, // For canned text responses
//             content              // For special types like team shares
//         } = req.body;
//         const token = req.headers.authorization?.split(' ')[1];

//         let room;
//         let messageContent; // This will hold the final content to be saved

//         // --- This block for finding/creating the room remains the same ---
//         if (roomType === 'directMessage') {
//             const recipientId = roomId;
//             room = await ChatRoom.findOne({ type: 'directMessage', participants: { $all: [senderId, recipientId] } });
//             if (!room) {
//                 room = new ChatRoom({ type: 'directMessage', participants: [senderId, recipientId] });
//                 await room.save();
//             }
//         } else if (roomType === 'league' || roomType === 'contest') {
//             room = await ChatRoom.findOne({ type: 'group', groupSourceId: roomId });
//             if (!room) {
//                 room = new ChatRoom({ type: 'group', groupSourceId: roomId, participants: [senderId] });
//                 await room.save();
//             }
//             if (!room.participants.includes(senderId)) {
//                 room.participants.push(senderId);
//                 await room.save();
//             }
//         }

//         if (!room) {
//             return res.status(400).json({ message: "Invalid room type or ID." });
//         }
//         // --- End of room logic ---


//         // --- START: New logic to determine message content ---
//         if (messageType === 'predefined') {
//             if (!predefinedMessageId) {
//                 return res.status(400).json({ message: 'predefinedMessageId is required for this message type.' });
//             }
//             // Find the predefined message text from the database
//             const predefinedMsg = await PredefinedMessage.findById(predefinedMessageId).lean();
//             if (!predefinedMsg || !predefinedMsg.isActive) {
//                 return res.status(400).json({ message: 'Invalid or inactive predefined message.' });
//             }
//             messageContent = predefinedMsg.text; // The content is the text from our database
        
//         } else if (messageType === 'team_share') {
//             if (!content) {
//                 return res.status(400).json({ message: 'Content (the teamId) is required for team shares.' });
//             }
//             messageContent = content; // The content is the team ID passed from the client
        
//         } else {
//             return res.status(400).json({ message: 'Invalid message type provided.' });
//         }
//         // --- END: New logic ---


//         // Create the new message using the content we determined above
//         const newMessage = new ChatMessage({
//             chatRoomId: room._id,
//             sender: senderId,
//             content: messageContent, // Use the resolved content
//             messageType: messageType,
//         });
//         await newMessage.save();

//         const senderDetails = await UserService.getUserById(senderId, token);
//         const finalMessage = newMessage.toObject();
//         finalMessage.sender = senderDetails;

//         // Populate the final message if it was a team share before broadcasting
//         if (finalMessage.messageType === 'team_share') {
//             // Assuming you have a 'teamService' configured similarly to UserService
//             const teamDetails = await teamService.post('/api/v1/team/internal/by-ids', { teamIds: [finalMessage.content] });
//             if (teamDetails.data && teamDetails.data.length > 0) {
//                 finalMessage.content = teamDetails.data[0];
//             }
//         }
        
//         req.io.to(room._id.toString()).emit('newMessage', finalMessage);

//         res.status(201).json({ message: 'Message sent', chatMessage: finalMessage });

//     } catch (error) {
//         console.error('Error posting message:', error);
//         res.status(500).json({ message: 'Server error while posting message.' });
//     }
// };

exports.postDirectMessage = async (req, res) => {
    try {
        const senderId = req.user.userId;
        const {
            roomType,
            roomId,
            messageType = 'predefined',
            predefinedMessageId, 
            content              
        } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        let room;
        let messageContent;

        // --- Room finding/creation logic remains the same ---
        if (roomType === 'directMessage') {
            const recipientId = roomId;
            room = await ChatRoom.findOne({ type: 'directMessage', participants: { $all: [senderId, recipientId] } });
            if (!room) {
                room = new ChatRoom({ type: 'directMessage', participants: [senderId, recipientId] });
                await room.save();
            }
        } else if (roomType === 'league' || roomType === 'contest') {
            // ... (your existing group room logic)
        }

        if (!room) {
            return res.status(400).json({ message: "Invalid room type or ID." });
        }
        
        // --- UPDATED: Logic to determine message content ---
        if (messageType === 'predefined') {
            if (!predefinedMessageId) {
                return res.status(400).json({ message: 'predefinedMessageId is required for this message type.' });
            }
            const predefinedMsg = await PredefinedMessage.findById(predefinedMessageId).lean();
            if (!predefinedMsg || !predefinedMsg.isActive) {
                return res.status(400).json({ message: 'Invalid or inactive predefined message.' });
            }
            messageContent = predefinedMsg.text; 
        
        } else if (messageType === 'team_share') {
            if (!content) {
                return res.status(400).json({ message: 'Content (the teamId) is required for team shares.' });
            }
            messageContent = content; 
        
        } else if (messageType === 'contest_invite') { // <-- NEW: Handle contest invites
            if (!content) {
                return res.status(400).json({ message: 'Content (the contestId) is required for contest invites.' });
            }
            messageContent = content; // The content is the contest ID
        
        } else {
            return res.status(400).json({ message: 'Invalid message type provided.' });
        }
        // --- END of updated logic ---

        
        const newMessage = new ChatMessage({
            chatRoomId: room._id,
            sender: senderId,
            content: messageContent,
            messageType: messageType,
        });
        await newMessage.save();

        const senderDetails = await UserService.getUserById(senderId, token);
        const finalMessage = newMessage.toObject();
        finalMessage.sender = senderDetails;

        // --- NEW: Populate content for team shares OR contest invites before broadcasting ---
        if (finalMessage.messageType === 'team_share') {
            const teamDetails = await teamService.post('/api/v1/team/internal/by-ids', { teamIds: [finalMessage.content] });
            if (teamDetails.data && teamDetails.data.length > 0) {
                finalMessage.content = teamDetails.data[0];
            }
        } else if (finalMessage.messageType === 'contest_invite') {
            // Assuming you have an internal endpoint on your Contest Service to get details
            const contestDetails = await contestService.post('/api/v1/user/internal/by-ids', { contestIds: [finalMessage.content] });
            if (contestDetails.data && contestDetails.data.length > 0) {
                finalMessage.content = contestDetails.data[0];
            }
        }
        
        req.io.to(room._id.toString()).emit('newMessage', finalMessage);

        res.status(201).json({ message: 'Message sent', chatMessage: finalMessage });

    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).json({ message: 'Server error while posting message.' });
    }
};

exports.getPredefinedMessages = async (req, res) => {
    try {
        const messages = await PredefinedMessage.find({ isActive: true })
            .sort({ order: 'asc' })
            .lean();
        res.json(messages);
    } catch (error) {
        console.error('Error fetching predefined messages:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};