// config/redis.js
const Redis = require('ioredis');

const REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';
const redisClient = new Redis(REDIS_URI);

redisClient.on('connect', () => {
    console.log('Redis Connected Successfully!');
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
});

module.exports = redisClient;
