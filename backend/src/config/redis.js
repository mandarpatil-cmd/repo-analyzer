const IORedis = require('ioredis');

let connection;

const getRedisConnection = () => {
  if (connection) return connection;

  connection = new IORedis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  });

  connection.on('connect', () => console.log('✅ Redis Connected'));
  connection.on('error', (err) => console.error('❌ Redis Error:', err.message));

  return connection;
};

module.exports = { getRedisConnection };