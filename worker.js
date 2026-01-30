/* worker.js - Claw Radio Producer Worker (Render) */
const Redis = require("ioredis");

const OPENCLAW_BASE_URL = process.env.OPENCLAW_BASE_URL; // e.g. https://your-openclaw.onrender.com
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const OPENCLAW_MODEL = process.env.OPENCLAW_MODEL;

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("Missing REDIS_URL");
  process.exit(1);
}
if (!OPENCLAW_BASE_URL || !OPENCLAW_TOKEN || !OPENCLAW_MODEL) {
  console.error("Missing OpenClaw env vars: OPENCLAW_BASE_URL / OPENCLAW_TOKEN / OPENCLAW_MODEL");
  process.exit(1);
}

const redis = new Redis(REDIS_URL);

const RUNNING_SET = "cr:sessions:running"; // sessions that should be producing
const MSG_LIST = (sid) => `cr:session:${sid}:messages`; // list backlog
const PUB_CH = (sid) => `cr:session:${sid}:pub`; // pubsub channel
const STATE_HASH = (sid) => `cr:session:${sid}:state`; // idx/turn/etc

const AGENTS = [
  { id: "DJ_CLAW", system: "You are DJ_CLAW, the host. Short, punchy, radio vibe." },
  { id: "AGENT_B", system: "You are AGENT_B. Co-host. Keep it witty and short." },
  { id: "AGENT_C", system: "You are AGENT_C. Analyst. Insightful, concise." },
  { id: "AGENT_D", system: "You are AGENT_D. Chaos. Funny, edgy, short." },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripTurn(text) {
  return String(text ?? "").replace(/\(turn\s*-?\d+\)\s*$/i, "").trim();
}

function normalizeLine(raw, turn) {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  const suffix = `(turn ${turn})`;
  const base = s ? s : "...";
  const out = base.endsWith(suffix) ? base : `${base} ${suffix}`;
  const max = 320;
  if (out.length <= max) return out;
  const cut = max - (suffix.length + 4);
  return `${out.slice(0, Math.max(0, cut)).trim()}... ${suffix}`;
}

async function openclawChat(messages, { temperature = 0.9, maxTokens = 140 } = {}) {
  const url = `${OPENCLAW_BASE_URL.replace(/\/+$/,"")}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENCLAW_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenClaw ${res.status}: ${txt || res.statusText}`);
  }

  const json = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    "";
  return String(content);
}

async function pushMessage(sessionId, msg) {
  const payload = JSON.stringify(msg);
  await redis.rpush(MSG_LIST(sessionId), payload);
  // keep last 200 messages
  await redis.ltrim(MSG_LIST(sessionId), -200, -1);
  await redis.publish(PUB_CH(sessionId), payload);
}

async function ensureState(sessionId) {
  const st = await redis.hgetall(STATE_HASH(sessionId));
  if (!st || Object.keys(st).length === 0) {
    await redis.hset(STATE_HASH(sessionId), {
      idx: "0",
      turn: "0",
    });
    // Seed initial message
    const seed = {
      sessionId,
      idx: 0,
      agent: "DJ_CLAW",
      text: "Mic check. Chamber sealed. Welcome to Claw Radio. (turn 0)",
      ts: Date.now(),
    };
    await pushMessage(sessionId, seed);
  }
}

async function produceOneTurn(sessionId) {
  await ensureState(sessionId);

  const st = await redis.hgetall(STATE_HASH(sessionId));
  const idx = parseInt(st.idx || "0", 10);
  const turn = parseInt(st.turn || "0", 10) + 1;

  const agentObj = AGENTS[(turn - 1) % AGENTS.length];
  const agentId = agentObj.id;

  // Build a tiny context from last messages
  const lastRaw = await redis.lrange(MSG_LIST(sessionId), -12, -1);
  const last = lastRaw
    .map((s) => {
      try {
        const m = JSON.parse(s);
        return `${m.agent}: ${stripTurn(m.text)}`;
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");

  const prompt = [
    { role: "system", content: "You are generating a live multi-agent radio show. Keep lines short." },
    { role: "system", content: agentObj.system },
    {
      role: "user",
      content:
        `Recent transcript:\n${last || "(empty)"}\n\n` +
        `Write the next line as ${agentId}. Keep it short. End with "(turn ${turn})".`,
    },
  ];

  const raw = await openclawChat(prompt, { temperature: 0.9, maxTokens: 140 });
  const text = normalizeLine(raw, turn);

  const msg = {
    sessionId,
    idx: idx + 1,
    agent: agentId,
    text,
    ts: Date.now(),
  };

  await pushMessage(sessionId, msg);
  await redis.hset(STATE_HASH(sessionId), { idx: String(idx + 1), turn: String(turn) });
}

async function main() {
  console.log("Claw Radio worker up.");

  while (true) {
    try {
      const sessions = await redis.smembers(RUNNING_SET);

      for (const sessionId of sessions) {
        // produce one turn per loop per session (simple fairness)
        await produceOneTurn(sessionId);
        await sleep(800);
      }

      // idle if no sessions
      if (sessions.length === 0) await sleep(1000);
    } catch (err) {
      console.error("Worker loop error:", err?.message || err);
      await sleep(1500);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
