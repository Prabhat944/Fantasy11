const League = require('../models/leagueModel');
const { nanoid } = require('nanoid');

/**
 * @desc    Create a new private league
 * @route   POST /api/leagues
 * @access  Private
 */
exports.createLeague = async (req, res) => {
    const { name, description, maxMembers } = req.body;
    const createdBy = req.user.id; // from auth middleware

    if (!name) {
        return res.status(400).json({ message: 'League name is required.' });
    }

    try {
        const newLeague = new League({
            name,
            description,
            createdBy,
            maxMembers,
            members: [createdBy], // The creator is the first member
            inviteCode: nanoid(8), // Generate a unique 8-character code
        });

        await newLeague.save();

        res.status(201).json({ message: 'League created successfully!', league: newLeague });
    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ message: 'Server error while creating league.' });
    }
};