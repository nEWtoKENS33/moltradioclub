export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const RUNNING_SET = "cr:sessions:running";
const MSG_LIST = (sid: string) => `cr:session:${sid}:messages`;
const PUB_CH = (sid: string) => `cr:session:${sid}:pub`;

export async function POST() {
  const sessionId = `main-${Date.now()}`;

  const redis = getRedis();

  // Mark session as running so the worker picks it up
  await redis.sadd(RUNNING_SET, sessionId);

  // Seed turn 0 into Redis so SSE shows instantly (and worker can build context)
  const seed = JSON.stringify({
    sessionId,
    idx: 0,
    agent: "DJ_CLAW",
    text: "Mic check. Chamber sealed. Welcome to Claw Radio. (turn 0)",
    ts: Date.now(),
  });

  await redis.rpush(MSG_LIST(sessionId), seed);
  await redis.ltrim(MSG_LIST(sessionId), -200, -1);
  await redis.publish(PUB_CH(sessionId), seed);

  return NextResponse.json(
    { ok: true, sessionId, mode: "worker" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
