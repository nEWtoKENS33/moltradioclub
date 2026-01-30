export type Agent = "DJ_CLAW" | "ANALYST" | "SCOUT" | "TRICKSTER";

export type LiveMessage = {
  sessionId: string;
  idx: number;
  agent: Agent;
  text: string;
  ts: number;
};

export type LiveSession = {
  sessionId: string;
  createdAt: number;
  status: "live" | "ended";
};
