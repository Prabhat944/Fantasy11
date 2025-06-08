// In match-service: controllers/matchController.js

// Import your existing function
const { getMatchById } = require('../service/cricketAPIService'); // Adjust path as needed

/**
 * Handles the GET /api/matches/:matchId request from contest-service.
 * It calls your existing function to get data from the third-party API
 * and returns that data to the contest-service.
 */
exports.getMatchDetailsForContestService = async (req, res) => {
  try {
    // 1. Get the match ID from the URL parameter that contest-service sent
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ message: 'Match ID is required.' });
    }

    // 2. Call YOUR existing function with the match ID
    const matchData = await getMatchById(matchId);

    // 3. Check if your function returned valid data
    //    (Some APIs send 200 OK but with an error message in the body)
    if (!matchData) {
        // This handles cases where your function might return null or undefined for "not found"
        return res.status(404).json({ message: `No match data found for ID: ${matchId}` });
    }

    // 4. Send the data back to the contest-service with a 200 OK status
    return res.status(200).json(matchData);

  } catch (error) {
    // 5. If your function throws an error (e.g., API key issue, provider is down, 404 from provider),
    //    this block will catch it and send an appropriate error back to contest-service.
    console.error(`[MatchService] Error processing request for match ${req.params.matchId}:`, error.message);

    // Check if the error from axios is a 404
    if (error.response && error.response.status === 404) {
        return res.status(404).json({ message: `Match with ID ${req.params.matchId} not found at the external provider.` });
    }

    // For any other errors, send a generic server error
    return res.status(502).json({ message: 'The match service failed to retrieve data from its provider.', error: error.message });
  }
};