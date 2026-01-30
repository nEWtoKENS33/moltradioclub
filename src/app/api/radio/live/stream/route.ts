export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const MSG_LIST = (sid: string) => `cr:session:${sid}:messages`;
const PUB_CH = (sid: string) => `cr:session:${sid}:pub`;

function sseEvent(event: string, data: string) {
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
      // 1) Send backlog
      try {
        const backlog = await redis.lrange(MSG_LIST(sessionId), -200, -1);
        for (const item of backlog) {
          controller.enqueue(encoder.encode(sseEvent("msg", item)));
        }
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(
            sseEvent("msg", JSON.stringify({
              sessionId,
              idx: -1,
              agent: "SYSTEM",
              text: `SYSTEM: backlog read failed`,
              ts: Date.now(),
            }))
          )
        );
      }

      // 2) Subscribe to live messages
      try {
        sub.on("message", (_channel, message) => {
          controller.enqueue(encoder.encode(sseEvent("msg", message)));
        });

        await sub.subscribe(PUB_CH(sessionId));

        // 3) Heartbeat so proxies don’t kill the connection
        const ping = setInterval(() => {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        }, 15000);

        // 4) Close on client abort
        req.signal.addEventListener("abort", async () => {
          clearInterval(ping);
          try {
            await sub.unsubscribe(PUB_CH(sessionId));
          } catch {}
          try {
            sub.disconnect();
          } catch {}
          controller.close();
        });
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(
            sseEvent("msg", JSON.stringify({
              sessionId,
              idx: -1,
              agent: "SYSTEM",
              text: `SYSTEM: subscribe failed`,
              ts: Date.now(),
            }))
          )
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // CORS si lo necesitas (si todo es mismo dominio, no es necesario)
      // "Access-Control-Allow-Origin": "*",
    },
  });
}
