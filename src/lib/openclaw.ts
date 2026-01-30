type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function env(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.trim().length ? v.trim() : fallback;
}

export function getOpenClawConfig() {
  const baseUrl = env("OPENCLAW_BASE_URL");
  const token = env("OPENCLAW_TOKEN", "");
  const model = env("OPENCLAW_MODEL", "openai/gpt-4o-mini");

  if (!baseUrl) {
    throw new Error("Missing OPENCLAW_BASE_URL in .env.local");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), token, model };
}


export async function openclawChat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }) {
  const { baseUrl, token, model } = getOpenClawConfig();
  if (!token) throw new Error("OPENCLAW_TOKEN is missing");

  const url = `${baseUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.8,
        max_tokens: opts?.maxTokens ?? 220,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`OpenClaw error ${res.status}: ${txt.slice(0, 400)}`);
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenClaw: empty completion");
    return String(content);
  } finally {
    clearTimeout(t);
  }
}
