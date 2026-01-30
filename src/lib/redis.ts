import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

export function getRedis() {
  if (!global._redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("Missing REDIS_URL");
    global._redis = new Redis(url);
  }
  return global._redis;
}
