// In your WALLET SERVICE's middleware/authMiddleware.js
// Make sure to set up and connect to the SAME Redis instance
const redisClient = require('../config/redis'); // Example path
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Invalid token: missing userId' });
        }

        // ✅ --- CHECK AGAINST REDIS --- ✅
        // Get the latest token for this user from our shared Redis cache
        const latestToken = await redisClient.get(`session:${userId}`);

        // Compare the token from the request with the latest one from Redis
        if (!latestToken || token !== latestToken) {
            return res.status(401).json({ 
                message: 'Session expired. You have logged in on another device.' 
            });
        }
        // ✅ --- END OF CHECK --- ✅

        req.user = { _id: userId };
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authMiddleware;