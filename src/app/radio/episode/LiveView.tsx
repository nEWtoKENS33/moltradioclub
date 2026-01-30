"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { idx: number; agent: string; text: string; ts: number };

export default function LiveView({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    esRef.current?.close();
    setMessages([]);

    const es = new EventSource(`/api/radio/live/stream?sessionId=${sessionId}`);
    esRef.current = es;

    es.addEventListener("msg", (e: any) => {
      const m = JSON.parse(e.data);
      setMessages((prev) => [...prev, m]);
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [sessionId]);

  return (
    <div className="card">
      <div className="rowBetween">
        <h2 className="h2">Live Feed</h2>
        <div className="pill">{sessionId ? "LIVE" : "IDLE"}</div>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m) => (
          <div key={m.idx} className="card" style={{ padding: 12 }}>
            <div className="small">{m.agent} · #{m.idx + 1}</div>
            <div style={{ marginTop: 6 }}>{m.text}</div>
          </div>
        ))}
        {messages.length === 0 && <div className="small">Waiting for messages...</div>}
      </div>
    </div>
  );
}
