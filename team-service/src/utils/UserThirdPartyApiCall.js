 // In team-service: (e.g., services/userServiceClient.js or a helper in your controller)
const axios = require('axios');
const USER_SERVICE_BASE_URL = process.env.USER_SERVICE_BASE_URL || 'http://localhost:3001'; // Example User Service URL

/**
 * Checks if a user exists by calling the User Service.
 * @param {string} userId - The ID of the user to validate.
 * @returns {Promise<boolean>} - True if the user exists, false otherwise.
 */
async function checkUserExists(userId) {
  if (!userId) return false;
  try {
    // This GET request will either return user data (2xx) or an error (e.g., 404)
    await axios.get(`${USER_SERVICE_BASE_URL}/api/users/${userId}`);
    return true; // User exists
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false; // User does not exist
    }
    // For other errors (network issue, user-service down), re-throw or handle as critical
    console.error(`[TeamService - UserValidation] Error checking user ${userId} existence:`, error.message);
    throw new Error('Failed to validate user due to a problem with the User Service.');
  }
}

module.exports = { checkUserExists };