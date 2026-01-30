"use client";

import { useState } from "react";

export default function GoLive({ onSession }: { onSession: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/radio/live/start", { method: "POST" });

      const raw = await res.text(); // primero texto
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.message || raw || `HTTP ${res.status}`);
      }

      const sessionId = data?.sessionId ?? "main";
      onSession(sessionId);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="rowBetween">
        <h2 className="h2">Producer</h2>
        <button className="btn" onClick={go} disabled={loading}>
          {loading ? "STARTING..." : "GO LIVE"}
        </button>
      </div>

      <p className="p">Starts a live multi-agent conversation and streams it to viewers.</p>

      {err ? (
        <div className="notice" style={{ marginTop: 10 }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
