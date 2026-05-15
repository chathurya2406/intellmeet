const redis = require("redis");

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: "redis://127.0.0.1:6379",
    });

    redisClient.on("error", () => {});

    await redisClient.connect();

    console.log("Redis Connected");

  } catch (error) {
    console.log("Redis not running, skipping cache");
    redisClient = null;
  }
};

module.exports = {
  connectRedis,
  getRedisClient: () => redisClient,
};