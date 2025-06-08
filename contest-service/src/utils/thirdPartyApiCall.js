const axios = require('axios');
const TEAM_SERVICE_BASE_URL = process.env.TEAM_SERVICE_BASE_URL || 'http://localhost:3002'; // Example URL for Team service
console.log('check TEAM_SERVICE_BASE_URL', TEAM_SERVICE_BASE_URL);
const USER_MATCH_SERVICE_BASE_URL = process.env.USER_MATCH_SERVICE_BASE_URL || 'http://localhost:3003'; // Example URL for UserMatch service
const MATCH_SERVICE_BASE_URL = process.env.MATCH_SERVICE_BASE_URL || process.env.CRICKET_SERVICE_BASE_URL || 'http://localhost:3004'; // Example URL for your Match/Cricket service

exports.getTeamDetails = async ({ teamId, userId, matchId }) => {
  console.log(`[TeamService] Fetching team: ${teamId} for user: ${userId}, match: ${matchId}`);
  try {
    const response = await axios.get(`${TEAM_SERVICE_BASE_URL}/api/teams/${teamId}`, {
      params: { userId, matchId },
      // headers: { 'Authorization': `Bearer ${your_auth_token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`[TeamService] Error fetching team ${teamId}. Status: ${error.response.status}`, error.response.data);
      if (error.response.status === 404) return null;
      throw new Error(`Team service request failed with status ${error.response.status}`);
    } else if (error.request) {
      console.error(`[TeamService] No response for team ${teamId}:`, error.message);
      throw new Error('Team service did not respond.');
    } else {
      console.error(`[TeamService] Request setup error for team ${teamId}:`, error.message);
      throw new Error('Error fetching team details.');
    }
  }
};

exports.getUserMatch = async ({ userId, matchId }) => {
  console.log(`[UserMatchService] Fetching UserMatch for user: ${userId}, match: ${matchId}`);
  try {
    const response = await axios.get(`${USER_MATCH_SERVICE_BASE_URL}/api/user-matches`, {
      params: { userId, matchId }
      // headers: { 'Authorization': `Bearer ${your_auth_token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`[UserMatchService] Error fetching UserMatch u:${userId} m:${matchId}. Status: ${error.response.status}`, error.response.data);
      if (error.response.status === 404) return null;
      throw new Error(`UserMatch service request failed with status ${error.response.status}`);
    } else if (error.request) {
      console.error(`[UserMatchService] No response for UserMatch u:${userId} m:${matchId}:`, error.message);
      throw new Error('UserMatch service did not respond.');
    } else {
      console.error(`[UserMatchService] Request setup error for UserMatch u:${userId} m:${matchId}:`, error.message);
      throw new Error('Error fetching UserMatch details.');
    }
  }
};

exports.createUserMatch = async (payload) => {
  console.log(`[UserMatchService] Creating UserMatch for user: ${payload.user}, match: ${payload.matchId}`);
  try {
    const response = await axios.post(`${USER_MATCH_SERVICE_BASE_URL}/api/user-matches`, payload, {
      // headers: { 'Authorization': `Bearer ${your_auth_token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`[UserMatchService] Error creating UserMatch. Status: ${error.response.status}`, error.response.data);
      throw new Error(`UserMatch service creation failed with status ${error.response.status}`);
    } else if (error.request) {
      console.error(`[UserMatchService] No response for creating UserMatch:`, error.message);
      throw new Error('UserMatch service did not respond during creation.');
    } else {
      console.error(`[UserMatchService] Request setup error for creating UserMatch:`, error.message);
      throw new Error('Error creating UserMatch record.');
    }
  }
};

exports.getMatchById = async (matchId) => {
  if (!matchId) {
    console.error('[MatchService] Match ID is required.');
    return null;
  }
  console.log(`[MatchService] Fetching match details for ID: ${matchId}`);
  try {
    // Adjust this endpoint to your actual Match service API
    const response = await axios.get(`${MATCH_SERVICE_BASE_URL}/api/matches/${matchId}`, {
      // headers: { 'X-Api-Key': 'YOUR_MATCH_API_KEY' } // If your match service needs an API key
    });
    return response.data; // Assuming it returns the matchInfo object
  } catch (error) {
    if (error.response) {
      console.error(`[MatchService] Error fetching match ${matchId}. Status: ${error.response.status}`, error.response.data);
      if (error.response.status === 404) return null;
      throw new Error(`Match service request failed for match ${matchId} with status ${error.response.status}`);
    } else if (error.request) {
      console.error(`[MatchService] No response for match ${matchId}:`, error.message);
      throw new Error(`Match service did not respond for match ${matchId}.`);
    } else {
      console.error(`[MatchService] Request setup error for match ${matchId}:`, error.message);
      throw new Error(`Error fetching match details for ${matchId}.`);
    }
  }
};