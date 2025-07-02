const axios = require('axios');

const userServiceURL = 'http://localhost:5001/api/v1/user';

const getUserById = async (userId) => {
  try {
    const { data } = await axios.get(`${userServiceURL}/${userId}`);
    return data;
  } catch (err) {
    console.error('Failed to fetch user details', err.message);
    return null;
  }
};
module.exports= {getUserById};