const ChatMessage = require('../models/chatMessageModel');
const League = require('../models/leagueModel'); // To verify league membership
const UserService = require('../service/userServcie');

/**
 * @desc    Get all messages for a specific league
 * @route   GET /api/chat/:leagueId
 * @access  Private (for league members)
 */
exports.getMessagesForLeague = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const userId = req.user.id;

    // --- Security Check: Ensure the user is a member of the league ---
    const league = await League.findById(leagueId);
    if (!league || !league.members.includes(userId)) {
      return res.status(403).json({ message: 'Forbidden: You are not a member of this league.' });
    }

    // Find all messages for the league and populate sender details
    const messages = await ChatMessage.find({ leagueId: leagueId })
      .sort({ createdAt: 'asc' }) // Sort by oldest first
      .populate('sender', 'name profileImage'); // Pull in sender's name and image

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error while fetching messages.' });
  }
};

exports.getMessagesForContest = async (req, res) => {
    try {
      const { contestId } = req.params;
      const userId = req.user.id;
  
      // --- Security Check: You should verify the user is part of the contest.
      // This requires an API call to your Contest service.
      // const isParticipant = await checkContestParticipation(userId, contestId);
      // if (!isParticipant) {
      //   return res.status(403).json({ message: 'Forbidden: You are not in this contest.' });
      // }
  
      const messages = await ChatMessage.find({ contestId: contestId })
        .sort({ createdAt: 'asc' })
        .populate('sender', 'name profileImage');
  
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching contest messages:', error);
      res.status(500).json({ message: 'Server error.' });
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