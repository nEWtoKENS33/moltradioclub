export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const RUNNING_SET = "cr:sessions:running";
const MSG_LIST = (sid: string) => `cr:session:${sid}:messages`;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
  }

  const redis = getRedis();

  const isRunning = await redis.sismember(RUNNING_SET, sessionId);
  const len = await redis.llen(MSG_LIST(sessionId));
  const last = await redis.lindex(MSG_LIST(sessionId), -1);

  return NextResponse.json({
    ok: true,
    sessionId,
    isRunning: Boolean(isRunning),
    messageCount: Number(len),
    lastMessage: last ? JSON.parse(last) : null,
  });
}
