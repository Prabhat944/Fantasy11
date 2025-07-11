// utils/cache.js
const redisClient = require('../config/redis'); // Import the Redis client instance

// Cache expiration time in seconds (e.g., 1 hour)
const WALLET_CACHE_EXPIRY = 10; // 1 hour

/**
 * Invalidates (deletes) a specific user's wallet data from the Redis cache.
 * @param {string} userId - The ID of the user whose wallet cache needs to be invalidated.
 */
const invalidateWalletCache = async (userId) => {
    const cacheKey = `wallet:${userId}`;
    try {
        await redisClient.del(cacheKey);
        console.log(`Cache invalidated for user: ${userId}`);
    } catch (error) {
        console.error(`Error invalidating cache for ${userId}:`, error);
    }
};

/**
 * Sets a user's wallet data in the Redis cache.
 * @param {string} userId - The ID of the user.
 * @param {Object} walletData - The wallet object to cache.
 */
const setWalletCache = async (userId, walletData) => {
    const cacheKey = `wallet:${userId}`;
    try {
        // Store in Redis cache with an expiry time
        await redisClient.set(cacheKey, JSON.stringify(walletData), 'EX', WALLET_CACHE_EXPIRY);
        console.log(`Wallet for ${userId} cached.`);
    } catch (error) {
        console.error(`Error setting cache for ${userId}:`, error);
    }
};

/**
 * Retrieves a user's wallet data from the Redis cache.
 * @param {string} userId - The ID of the user.
 * @returns {Object|null} - The cached wallet data, or null if not found.
 */
const getWalletCache = async (userId) => {
    const cacheKey = `wallet:${userId}`;
    try {
        const cachedWallet = await redisClient.get(cacheKey);
        return cachedWallet ? JSON.parse(cachedWallet) : null;
    } catch (error) {
        console.error(`Error getting cache for ${userId}:`, error);
        return null; // Return null on error to fetch from DB
    }
};


module.exports = {
    invalidateWalletCache,
    setWalletCache,
    getWalletCache
};
