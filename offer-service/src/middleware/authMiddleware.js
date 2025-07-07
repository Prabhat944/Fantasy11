// In your Offer Service, Contest Service, etc.
// middleware/authMiddleware.js

const axios = require('axios');

// Get the two potential sources of truth for authentication
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token or invalid authorization header provided' });
    }

    const token = authHeader.split(' ')[1];

    // --- ✅ NEW LOGIC BLOCK ---
    // First, check if the token matches our internal, shared secret token.
    if (INTERNAL_API_TOKEN && token === INTERNAL_API_TOKEN) {
        // If it matches, this is a trusted internal service call (like from our cron job).
        // We can create a "system" user object for consistency if needed.
        req.user = { _id: 'SYSTEM_USER', role: 'system' };
        
        // IMPORTANT: Immediately call next() to grant access and stop further processing.
        return next(); 
    }
    // --- END OF NEW LOGIC ---


    // If it's not the internal token, proceed with the original user token validation.
    try {
        // 1. Call the User Service to validate the user's JWT
        const response = await axios.post(`${USER_SERVICE_URL}/api/users/validate-token`, {
            token: token
        });

        // 2. Attach the real user data to the request object.
        req.user = response.data;
        next();
        
    } catch (err) {
        // 3. Handle authentication failures for user tokens.
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || 'Authentication failed for user token.';
        
        return res.status(status).json({ message });
    }
};

module.exports = authMiddleware;