const axios = require('axios');
require('dotenv').config();

// Create an Axios instance for the User Service
const userServiceApi = axios.create({
  baseURL: process.env.USER_SERVICE_URL,
});

/**
 * Searches for users by making an API call to the User Service.
 * @param {string} searchTerm - The name or email to search for.
 * @param {string} authToken - The JWT of the user making the request.
 * @returns {Promise<Array>} A promise that resolves to an array of users.
 */
exports.searchUsers = async (searchTerm, authToken) => {
  try {
    // Forward the authorization token to the User Service
    const response = await userServiceApi.get(`/api/v1/auth/search?search=${searchTerm}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching users from User Service:', error.message);
    // Return an empty array or throw the error, depending on desired behavior
    return [];
  }
};

exports.getUserById = async (userId, authToken) => {
  try {
    const response = await userServiceApi.get(`/api/v1/auth/${userId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching user ${userId} from User Service:`, error.message);
    return null;
  }
};

exports.getUsersByIds = async (userIds, authToken) => {
  try {
    const users = await Promise.all(
      userIds.map(id => userServiceApi.get(`/api/v1/auth/${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(res => res.data).catch(err => null))
    );
    return users.filter(Boolean);  // Remove failed requests (nulls)
  } catch (error) {
    console.error('Error fetching users by IDs:', error.message);
    return [];
  }
};