// controllers/followController.js

const Follow = require('../models/followModel');
const UserService = require('../service/userServcie'); // Assuming path is correct
const mongoose = require('mongoose');

/**
 * @desc    Follow a user
 * @route   POST /api/follow/:userId
 * @access  Private
 */
exports.followUser = async (req, res) => {
    const followerId = req.user.userId; // Logged-in user
    const followingId = req.params.userId; // User to follow

    if (followerId === followingId) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }

    try {
        // Check if the follow relationship already exists
        const existingFollow = await Follow.findOne({ follower: followerId, following: followingId });
        if (existingFollow) {
            return res.status(400).json({ message: "You are already following this user." });
        }

        const newFollow = new Follow({ follower: followerId, following: followingId });
        await newFollow.save();

        res.status(201).json({ message: "Successfully followed user.", follow: newFollow });
    } catch (error) {
        res.status(500).json({ message: "Server error while trying to follow user." });
    }
};

/**
 * @desc    Unfollow a user
 * @route   DELETE /api/follow/:userId
 * @access  Private
 */
exports.unfollowUser = async (req, res) => {
    const followerId = req.user.userId; // Logged-in user
    const followingId = req.params.userId; // User to unfollow

    try {
        const result = await Follow.findOneAndDelete({ follower: followerId, following: followingId });
        if (!result) {
            return res.status(404).json({ message: "You are not following this user." });
        }
        res.status(200).json({ message: "Successfully unfollowed user." });
    } catch (error) {
        res.status(500).json({ message: "Server error while trying to unfollow user." });
    }
};

/**
 * @desc    Get a user's followers list
 * @route   GET /api/follow/:userId/followers
 * @access  Private
 */
exports.getFollowers = async (req, res) => {
    try {
        const userId = req.params.userId;
        const token = req.headers.authorization?.split(' ')[1];

        const follows = await Follow.find({ following: userId }).select('follower -_id');
        const followerIds = follows.map(f => f.follower);
        
        if (followerIds.length === 0) {
            return res.json([]);
        }

        const followersDetails = await UserService.getUsersByIds(followerIds, token);
        res.json(followersDetails);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching followers." });
    }
};

/**
 * @desc    Get a list of users a user is following
 * @route   GET /api/follow/:userId/following
 * @access  Private
 */
exports.getFollowing = async (req, res) => {
    try {
        const userId = req.params.userId;
        const token = req.headers.authorization?.split(' ')[1];

        const follows = await Follow.find({ follower: userId }).select('following -_id');
        const followingIds = follows.map(f => f.following);

        if (followingIds.length === 0) {
            return res.json([]);
        }

        const followingDetails = await UserService.getUsersByIds(followingIds, token);
        res.json(followingDetails);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching following list." });
    }
};