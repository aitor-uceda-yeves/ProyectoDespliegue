const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  retryStrategy(times) { return Math.min(times * 500, 5000); }
});
redis.on('error', err => console.error('Redis error:', err.message));
module.exports = redis;
