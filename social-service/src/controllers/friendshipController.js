const Friendship = require('../models/friendshipModel');
const UserService = require('../service/userServcie'); // Ensure this path is correct
const Follow = require('../models/followModel');
const mongoose = require('mongoose');

exports.searchUsers = async (req, res) => {
    try {
        const searchTerm = req.query.search || '';
        const token = req.headers.authorization?.split(' ')[1];

        const users = await UserService.searchUsers(searchTerm, token);
        // We also need to filter out existing friends or pending requests
        // This is a future enhancement. For now, we just return the search.
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error while searching for users.' });
    }
};

exports.sendFriendRequest = async (req, res) => {
    const { recipientId } = req.body;
    const requesterId = req.user.userId; // Use userId from JWT

    if (requesterId === recipientId) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself." });
    }

    try {
        const existingFriendship = await Friendship.findOne({
            $or: [{ requester: requesterId, recipient: recipientId }, { requester: recipientId, recipient: requesterId }],
        });

        if (existingFriendship) {
            return res.status(400).json({ message: 'A friendship request already exists or you are already friends.' });
        }

        const newFriendship = new Friendship({ requester: requesterId, recipient: recipientId });
        await newFriendship.save();
        res.status(201).json({ message: 'Friend request sent successfully.', friendship: newFriendship });
    } catch (error) {
        res.status(500).json({ message: 'Server error while sending request.' });
    }
};

exports.respondToRequest = async (req, res) => {
    const { requestId, status } = req.body;
    const recipientId = req.user.userId; // Use userId from JWT

    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }
    
    try {
        const request = await Friendship.findById(requestId);
        if (!request || request.recipient.toString() !== recipientId || request.status !== 'pending') {
            return res.status(400).json({ message: 'Invalid request.' });
        }
        
        request.status = status;
        await request.save();
        res.status(200).json({ message: `Friend request ${status}.`, friendship: request });
    } catch (error) {
        res.status(500).json({ message: 'Server error while responding to request.' });
    }
};


exports.getFriendsList = async (req, res) => {
    try {
        const userId = req.user.userId; // Use userId from JWT
        const token = req.headers.authorization?.split(' ')[1];

        const friendships = await Friendship.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted',
        });

        // Get an array of all the friend IDs
        const friendIds = friendships.map(friendship => {
            return friendship.requester.toString() === userId ? friendship.recipient : friendship.requester;
        });

        if (friendIds.length === 0) {
            return res.json([]);
        }

        // Fetch all friend details in one API call from the User Service
        // Note: This requires a new endpoint on your User Service to fetch users by an array of IDs
        const friendsDetails = await UserService.getUsersByIds(friendIds, token);

        res.json(friendsDetails);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching friends list.' });
    }
};

exports.getPendingRequests = async (req, res) => {
    try {
      const userId = req.user.userId;
      console.log('UserId from JWT:', userId);
  
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
  
      const token = req.headers.authorization?.split(' ')[1];
  
      const requests = await Friendship.find({
        recipient: new mongoose.Types.ObjectId(userId),
        status: 'pending',
      }).lean();
  
      console.log('Found Requests:', requests);
  
      const requesterIds = requests.map(req => req.requester);
      
      if (requesterIds.length === 0) {
        return res.json([]);
      }
  
      const requestersDetails = await UserService.getUsersByIds(requesterIds, token);
      const requestersMap = new Map(requestersDetails.map(user => [user._id.toString(), user]));
  
      const populatedRequests = requests.map(request => {
        request.requester = requestersMap.get(request.requester.toString());
        return request;
      });
  
      res.json(populatedRequests);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error while fetching pending requests.' });
    }
};

exports.getUserFriendsList = async (req, res) => {
    try {
        const { userId } = req.params; // Get the user ID from the URL parameter
        const token = req.headers.authorization?.split(' ')[1]; // Get the auth token

        // Validate the provided user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Find all accepted friendships where the user is either the requester or the recipient
        const friendships = await Friendship.find({
            $or: [{ requester: userId }, { recipient: userId }],
            status: 'accepted',
        });

        // Create a list of all the friend IDs from the friendships
        const friendIds = friendships.map(friendship => {
            // If the requester is the user we are looking for, then the friend is the recipient. Otherwise, it's the requester.
            return friendship.requester.toString() === userId ? friendship.recipient : friendship.requester;
        });

        // If the user has no friends, return an empty array
        if (friendIds.length === 0) {
            return res.json([]);
        }

        // Use the UserService to fetch the details for all friend IDs at once
        const friendsDetails = await UserService.getUsersByIds(friendIds, token);

        // Send the list of friend details in the response
        res.json(friendsDetails);

    } catch (error) {
        console.error(error); // Log the error for debugging
        res.status(500).json({ message: 'Server error while fetching the friends list.' });
    }
};

exports.getConnectionCounts = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Use Promise.all to run all count queries concurrently for better performance
        const [friendCount, followerCount, followingCount] = await Promise.all([
            // 1. Count accepted friends
            Friendship.countDocuments({
                $or: [{ requester: userId }, { recipient: userId }],
                status: 'accepted',
            }),
            // 2. Count followers (users following the given userId)
            Follow.countDocuments({ following: userId }),
            // 3. Count following (users the given userId is following)
            Follow.countDocuments({ follower: userId })
        ]);

        res.json({
            friends: friendCount,
            followers: followerCount,
            following: followingCount,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while fetching connection counts.' });
    }
};