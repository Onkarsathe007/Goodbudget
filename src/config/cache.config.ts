import { Redis } from "ioredis";
// const redisClient = new Redis(`${process.env.REDIS_URL}`);

const redisClient = new Redis({
  host: `${process.env.REDIS_HOST}`,
  port: 6379,
  db: 4,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export default redisClient;
