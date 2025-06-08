// In your controllers/contestCheckController.js (or the relevant controller file)

const Contest = require('../models/Contest'); // Adjust path to your Contest model
const Match = require('../models/Match');     // Adjust path to your Match model
const ContestTemplate = require('../models/ContestTemplate'); // <-- ADD THIS LINE

/**
 * @description Get contests for a specific match, useful for checking cron job creations.
 * @route GET /api/v1/debug/check-contests
 * @queryparam {String} matchId - The ID of the match to check contests for.
 * @queryparam {String} [createdAfter] - Optional: ISO Date string. Filters contests created after this timestamp.
 * @queryparam {Number} [limit=50] - Optional: Limits the number of contests returned.
 * @access Private/Admin
 */
exports.getContestsForMatchCheck = async (req, res) => {
  try {
    const { matchId, createdAfter, limit } = req.query;

    if (!matchId) {
      return res.status(400).json({ message: 'matchId query parameter is required.' });
    }

    const query = {
      matchId: matchId,
    };

    if (createdAfter) {
      const date = new Date(createdAfter);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid createdAfter date format. Please use ISO date string.' });
      }
      query.createdAt = { $gte: date };
    }

    const resultLimit = parseInt(limit, 10) || 50;

    const contests = await Contest.find(query)
      .sort({ createdAt: -1 }) 
      .limit(resultLimit)
      .populate('contestTemplateId', 'title type entryFee totalSpots') 
      .populate('baseContestId', 'title') 
      .lean(); 

    if (contests.length === 0) {
      return res.status(200).json({ 
        message: `No contests found for matchId ${matchId}` + (createdAfter ? ` created after ${createdAfter}.` : '.'),
        data: [] 
      });
    }

    res.status(200).json({
      message: `Found ${contests.length} contest(s) for matchId ${matchId}` + (createdAfter ? ` created after ${createdAfter}.` : '.'),
      data: contests,
    });

  } catch (error) {
    // Log the error with a timestamp for better tracking
    console.error(`[${new Date().toISOString()}] Error in getContestsForMatchCheck:`, error.name, error.message); // Log error name and message
    // For debugging, you might want the full stack: console.error(error); 
    
    res.status(500).json({ 
        message: 'Server error while fetching contests.', 
        errorName: error.name, // Send error name for easier debugging on client if needed
        errorMessage: error.message 
    });
  }
};