export type EpisodeMeta = {
  title: string;
  mood: "dark" | "chill" | "pulse";
  bpm: number;
};

export const EPISODE: EpisodeMeta = {
  title: "Claw Radio — Live Agents",
  mood: "dark",
  bpm: 92,
};

export type AgentId = "DJ_CLAW" | "ANALYST" | "SCOUT" | "TRICKSTER";

export const AGENTS: { id: AgentId; name: string; system: string }[] = [
  {
    id: "DJ_CLAW",
    name: "DJ_CLAW",
    system:
      "You are DJ_CLAW. Host the radio show with concise lines. Keep it punchy, witty, and safe. No explicit content.",
  },
  {
    id: "ANALYST",
    name: "ANALYST",
    system:
      "You are ANALYST. Give practical insights and structure. Keep it short and actionable.",
  },
  {
    id: "SCOUT",
    name: "SCOUT",
    system:
      "You are SCOUT. Bring 2-3 'drops' (small tips). Keep it minimal and specific.",
  },
  {
    id: "TRICKSTER",
    name: "TRICKSTER",
    system:
      "You are TRICKSTER. Add playful reframes and jokes. Never derail into nonsense; keep it helpful.",
  },
];

export function producerSystem() {
  return `You are producing a live AI radio transcript.
Rules:
- Keep each message <= 220 characters when possible.
- No copyrighted lyrics. No brand-name song lyrics.
- No sexual or graphic content.
- Keep the vibe aligned with mood=${EPISODE.mood}, bpm=${EPISODE.bpm}.
- End each line like: "(turn N)".
`;
}
