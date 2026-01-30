export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { openclawChat } from "@/lib/openclaw";
import { ensureSession, markStarted, pushMessage, endSession } from "@/lib/liveBus";
import { AGENTS, EPISODE, producerSystem } from "@/lib/radioShow";
import type { Agent, LiveMessage } from "@/lib/radioTypes";

// ✅ your redis singleton (you said you created lib/redist.ts)
import { getRedis } from "@/lib/redis";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeLine(raw: string, turn: number) {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  const suffix = `(turn ${turn})`;
  if (!s) return `... ${suffix}`;

  const out = s.endsWith(suffix) ? s : `${s} ${suffix}`;

  const max = 320;
  if (out.length <= max) return out;

  const cut = max - (suffix.length + 4);
  return `${out.slice(0, Math.max(0, cut)).trim()}... ${suffix}`;
}

function makeMsg(sessionId: string, idx: number, agent: Agent, text: string): LiveMessage {
  return { sessionId, idx, agent, text, ts: Date.now() };
}

/**
 * IMPORTANT:
 * - If you run a Render Worker (worker.js), you MUST set CLAW_RADIO_USE_WORKER=true
 *   so this route does NOT start a second producer in-process.
 */
const USE_WORKER = process.env.CLAW_RADIO_USE_WORKER === "true";

export async function POST() {
  const sessionId = `main-${Date.now()}`;

  // Ensure the session exists immediately (prevents "Session not found")
  ensureSession(sessionId);
  markStarted(sessionId);

  // Seed message so viewers see something instantly
  pushMessage(
    sessionId,
    makeMsg(
      sessionId,
      0,
      "DJ_CLAW",
      normalizeLine("Mic check. Chamber sealed. Welcome to Claw Radio.", 0)
    )
  );

  // If you're using a real worker, mark the session as "running" in Redis
  // so worker.js can pick it up.
  if (USE_WORKER) {
    const redis = getRedis(); // throws if REDIS_URL missing (good!)
    await redis.sadd("cr:sessions:running", sessionId);
  } else {
    // Fallback (local dev): Run producer async (non-blocking) inside this process
    setTimeout(() => void runProducer(sessionId), 0);
  }

  return NextResponse.json(
    { ok: true, sessionId, mode: USE_WORKER ? "worker" : "inprocess" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function runProducer(sessionId: string) {
  let idx = 1;

  // Keep small transcript context (for prompting)
  const transcript: { agent: Agent; text: string }[] = [
    { agent: "DJ_CLAW", text: "Mic check. Chamber sealed. Welcome to Claw Radio. (turn 0)" },
  ];

  try {
    const totalTurns = 32;

    for (let turn = 1; turn <= totalTurns; turn++) {
      const agentObj = AGENTS[(turn - 1) % AGENTS.length];
      const agent = agentObj.id as Agent;

      const last = transcript
        .slice(-12)
        .map((m) => `${m.agent}: ${m.text}`)
        .join("\n");

      const prompt = [
        { role: "system" as const, content: producerSystem() },
        { role: "system" as const, content: agentObj.system },
        {
          role: "user" as const,
          content:
            `Episode mood=${EPISODE.mood}, bpm=${EPISODE.bpm}\n` +
            `Recent transcript:\n${last || "(empty)"}\n\n` +
            `Write the next line as ${agent}. Keep it short. End with "(turn ${turn})".`,
        },
      ];

      const raw = await openclawChat(prompt, { temperature: 0.9, maxTokens: 140 });
      const text = normalizeLine(raw, turn);

      transcript.push({ agent, text });
      pushMessage(sessionId, makeMsg(sessionId, idx++, agent, text));

      await sleep(750);
    }

    endSession(sessionId);
  } catch (err: any) {
    const msg = `SYSTEM: ${err?.message ?? String(err)}`;
    pushMessage(sessionId, makeMsg(sessionId, idx++, "DJ_CLAW", normalizeLine(msg, -1)));
    endSession(sessionId);
  }
}
