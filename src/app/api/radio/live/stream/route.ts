export const runtime = "nodejs";

import { ensureSession, getMessages, subscribe, isEnded } from "@/lib/liveBus";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") || "main";

  // Guarantee session exists even if viewer arrives first
  ensureSession(sessionId);

  const enc = new TextEncoder();
  let closed = false;
  let unsub: null | (() => void) = null;
  let ping: any = null;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      const send = (event: string, data: any) => {
        safeEnqueue(enc.encode(`event: ${event}\n`));
        safeEnqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const safeClose = () => {
        if (closed) return;
        closed = true;
        if (ping) clearInterval(ping);
        if (unsub) unsub();
        try {
          controller.close();
        } catch {}
      };

      // meta + backlog
      send("meta", { sessionId });
      const backlog = getMessages(sessionId);
      for (const msg of backlog) send("msg", msg);

      // subscribe
      unsub = subscribe(sessionId, (msg) => {
        send("msg", msg);
      });

      // keepalive + end detection
      ping = setInterval(() => {
        if (closed) return;

        // comment ping for proxies
        safeEnqueue(enc.encode(`: ping\n\n`));

        if (isEnded(sessionId)) {
          send("end", { ok: true });
          safeClose();
        }
      }, 15000);
    },
    cancel() {
      closed = true;
      if (ping) clearInterval(ping);
      if (unsub) unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
