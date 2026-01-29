// better-auth-redis.ts
import { logger, type SecondaryStorage } from "better-auth";
import redisClient from "./cache.config.js";

const PREFIX = "session:";

export const redisSecondaryStorage: SecondaryStorage = {
  async get(key) {
    logger.info("[Redis GET]", key);
    const v = await redisClient.get("session:" + key);
    return v ? JSON.parse(v) : null;
  },

  async set(key, value, ttl) {
    logger.info("[Redis SET]", key, "TTL:", ttl);
    await redisClient.set(
      "session:" + key,
      JSON.stringify(value),
      "EX",
      ttl ?? 60,
    );
  },

  async delete(key) {
    logger.info("[Redis DEL]", key);
    await redisClient.del("session:" + key);
  },
};
