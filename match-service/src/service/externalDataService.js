const axios = require('axios');

// It's best practice to get the base URL from environment variables
const CONTEST_SERVICE_API = axios.create({
  baseURL: process.env.CONTEST_SERVICE_URL || 'http://localhost:5006', // Fallback for safety
});


/**
 * Fetches contest participations from the contest service.
 * Assumes the other service has an endpoint like POST /participations/query
 * @param {object} query - The query object (e.g., { user: userId, matchId: matchId }).
 * @returns {Promise<Array>} - A promise that resolves to an array of participations.
 */
exports.fetchContestParticipations = async (query) => {
  try {
    console.log('[ExternalService] Fetching ContestParticipations with query:', query);
    // The other service will receive this query in the request body
    const response = await CONTEST_SERVICE_API.post('/participations/query', query);
    return response.data; // Axios wraps the response data in a `data` property
  } catch (error) {
    console.error('[ExternalService] Error fetching contest participations:', error.message);
    // Return an empty array or throw the error, depending on how you want to handle failures
    return [];
  }
};

/**
 * Fetches contest participations and populates them from the contest service.
 * Assumes a dedicated endpoint for this, like POST /participations/details
 * @param {object} query - The query object.
 * @returns {Promise<Array>} - A promise that resolves to an array of populated participations.
 */
exports.fetchAndPopulateParticipations = async (query) => {
    try {
        console.log('[ExternalService] Fetching and populating Participations with query:', query);
        const response = await CONTEST_SERVICE_API.post('/participations/details', query);
        return response.data;
    } catch (error) {
        console.error('[ExternalService] Error fetching populated participations:', error.message);
        return [];
    }
};

/**
 * Fetches multiple teams by their IDs from the contest service.
 * Assumes an endpoint like POST /teams/by-ids
 * @param {Array<string>} ids - An array of team IDs.
 * @returns {Promise<Array>} - A promise that resolves to an array of teams.
 */
exports.fetchTeamsByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  try {
    console.log('[ExternalService] Fetching Teams for IDs:', ids.length);
    // We send the array of IDs in the request body
    const response = await CONTEST_SERVICE_API.post('/teams/by-ids', { ids });
    return response.data;
  } catch (error) {
    console.error('[ExternalService] Error fetching teams:', error.message);
    return [];
  }
};

/**
 * Fetches multiple contests by their IDs from the contest service.
 * Assumes an endpoint like POST /contests/by-ids
 * @param {Array<string>} ids - An array of contest IDs.
 * @returns {Promise<Array>} - A promise that resolves to an array of contests.
 */
exports.fetchContestsByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  try {
    console.log('[ExternalService] Fetching Contests for IDs:', ids.length);
    const response = await CONTEST_SERVICE_API.post('/contests/by-ids', { ids });
    return response.data;
  } catch (error) {
    console.error('[ExternalService] Error fetching contests:', error.message);
    return [];
  }
};

/**
 * Fetches multiple contest templates by their IDs from the contest service.
 * Assumes an endpoint like POST /templates/by-ids
 * @param {Array<string>} ids - An array of contest template IDs.
 * @returns {Promise<Array>} - A promise that resolves to an array of contest templates.
 */
exports.fetchContestTemplatesByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  try {
    console.log('[ExternalService] Fetching ContestTemplates for IDs:', ids.length);
    const response = await CONTEST_SERVICE_API.post('/templates/by-ids', { ids });
    return response.data;
  } catch (error) {
    console.error('[ExternalService] Error fetching contest templates:', error.message);
    return [];
  }
};
