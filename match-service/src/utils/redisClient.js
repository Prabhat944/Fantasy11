// const redis = require('redis');
// const client = redis.createClient({ legacyMode: true });
// client.connect().catch(console.error);
// module.exports = client;


// utils/redisClient.js (example path)
const redis = require('redis');
const client = redis.createClient({ legacyMode: true }); // legacyMode: true

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('✅ Connected to Redis via legacy client wrapper'));
client.on('reconnecting', () => console.log('Redis client reconnecting'));
client.on('ready', () => console.log('Redis client ready!'));

// Connect the client
client.connect().catch(err => {
  console.error('Failed to connect to Redis:', err);
});

// Promisify methods we need if legacyMode interferes with direct promise usage
// For node-redis v4, even with legacyMode, .get() and .setEx() should return Promises.
// If they don't, you'd typically wrap them like this:
// const { promisify } = require('util');
// const getAsync = promisify(client.get).bind(client);
// const setExAsync = promisify(client.setEx).bind(client);
// module.exports = { client, getAsync, setExAsync };

// For v4, direct usage should be fine.
module.exports = client;