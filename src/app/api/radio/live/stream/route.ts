export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const MSG_LIST = (sid: string) => `cr:session:${sid}:messages`;
const PUB_CH = (sid: string) => `cr:session:${sid}:pub`;

function sse(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
  }

  const redis = getRedis();
  const sub = redis.duplicate();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let closed = false;
      let ping: any = null;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // ignore enqueue after close
          closed = true;
        }
      };

      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const cleanup = async () => {
        if (ping) clearInterval(ping);
        try {
          await sub.unsubscribe(PUB_CH(sessionId));
        } catch {}
        try {
          sub.disconnect();
        } catch {}
      };

      // Close on client abort (and prevent double close)
      req.signal.addEventListener("abort", () => {
        void cleanup().finally(() => safeClose());
      });

      // 1) backlog
      try {
        const backlog = await redis.lrange(MSG_LIST(sessionId), -200, -1);
        for (const item of backlog) safeEnqueue(sse("msg", item));
      } catch {
        safeEnqueue(
          sse(
            "msg",
            JSON.stringify({
              sessionId,
              idx: -1,
              agent: "SYSTEM",
              text: "SYSTEM: backlog read failed",
              ts: Date.now(),
            })
          )
        );
      }

      // 2) subscribe
      try {
        sub.on("message", (_ch, message) => {
          safeEnqueue(sse("msg", message));
        });

        await sub.subscribe(PUB_CH(sessionId));

        // heartbeat
        ping = setInterval(() => {
          safeEnqueue(`: ping ${Date.now()}\n\n`);
        }, 15000);
      } catch {
        safeEnqueue(
          sse(
            "msg",
            JSON.stringify({
              sessionId,
              idx: -1,
              agent: "SYSTEM",
              text: "SYSTEM: subscribe failed",
              ts: Date.now(),
            })
          )
        );
        await cleanup();
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
