import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let redisReady = false;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    redisReady = true;
  }
} catch (error) {
  console.error("[REDIS INIT ERROR]", error);
}

export function getRedis(): Redis | null {
  return redis;
}

export function isRedisReady(): boolean {
  return redisReady;
}
