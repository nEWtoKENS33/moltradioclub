"use client";

import { useState } from "react";
import GoLive from "./GoLive";
import LiveView from "./LiveView";

export default function ClientLive() {
  const [sessionId, setSessionId] = useState("");

  return (
    <>
      <GoLive onSession={setSessionId} />
      {sessionId ? <LiveView sessionId={sessionId} /> : null}
    </>
  );
}
