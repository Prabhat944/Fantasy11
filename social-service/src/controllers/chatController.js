const ChatMessage = require('../models/chatMessageModel');
const League = require('../models/leagueModel'); // To verify league membership
const UserService = require('../service/userServcie');

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