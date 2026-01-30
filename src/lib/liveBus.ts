import type { LiveMessage } from "./radioTypes";

type Subscriber = (msg: LiveMessage) => void;

export type SessionState = {
  messages: LiveMessage[];
  subs: Set<Subscriber>;
  ended: boolean;
  started: boolean;
};

const sessions = new Map<string, SessionState>();

/**
 * Ensures an in-memory session exists.
 * This prevents "Session not found" when a viewer subscribes before the producer starts.
 */
export function ensureSession(sessionId: string): SessionState {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { messages: [], subs: new Set(), ended: false, started: false };
    sessions.set(sessionId, s);
  }
  return s;
}

export function markStarted(sessionId: string) {
  const s = ensureSession(sessionId);
  s.started = true;
}

export function isStarted(sessionId: string) {
  return sessions.get(sessionId)?.started ?? false;
}

export function isEnded(sessionId: string) {
  return sessions.get(sessionId)?.ended ?? false;
}

export function pushMessage(sessionId: string, msg: LiveMessage) {
  const s = ensureSession(sessionId);
  if (s.ended) return;

  s.messages.push(msg);

  // Notify subscribers safely (one bad subscriber shouldn't kill the loop).
  for (const fn of s.subs) {
    try {
      fn(msg);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function subscribe(sessionId: string, fn: Subscriber) {
  const s = ensureSession(sessionId);
  s.subs.add(fn);
  return () => s.subs.delete(fn);
}

export function getMessages(sessionId: string) {
  return ensureSession(sessionId).messages;
}

export function endSession(sessionId: string) {
  const s = ensureSession(sessionId);
  s.ended = true;
}

/** Optional: drop a session from memory (useful in dev). */
export function dropSession(sessionId: string) {
  sessions.delete(sessionId);
}
