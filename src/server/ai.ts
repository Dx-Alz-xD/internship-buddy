import "server-only";

/**
 * Thin client for Groq's OpenAI-compatible API.
 * Free plan: about 8,000 tokens a minute per model, so inputs are trimmed and work is
 * split between the 120B model (careful reading and writing) and the 20B model (quick parsing).
 */
export const MODELS = {
  smart: "openai/gpt-oss-120b",
  fast: "openai/gpt-oss-20b",
  guard: "meta-llama/llama-prompt-guard-2-86m",
} as const;

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}

export const aiConfigured = () => !!process.env.GROQ_API_KEY;

type JsonSchema = Record<string, unknown>;

async function call(body: Record<string, unknown>) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiError(503, "AI is not set up on this server (GROQ_API_KEY is missing).");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 20;
    throw new AiError(429, `Groq's free limit is busy. Try again in about ${Math.ceil(wait)} seconds.`, wait);
  }
  if (res.status === 401 || res.status === 403) throw new AiError(502, "Groq rejected the API key.");
  if (!res.ok) {
    let msg = `Groq returned ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
    } catch {}
    throw new AiError(502, msg);
  }
  return res.json();
}

export async function aiJson<T>(opts: {
  model?: keyof typeof MODELS;
  system: string;
  user: string;
  name: string;
  schema: JsonSchema;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const data = await call({
    model: MODELS[opts.model ?? "smart"],
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
    reasoning_effort: opts.effort ?? "low",
    max_completion_tokens: opts.maxTokens ?? 2000,
    temperature: 0.4,
  });
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new AiError(502, "The AI returned an empty answer. Try again.");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiError(502, "The AI answer was cut off. Try again.");
  }
}

/**
 * Listing descriptions are written by strangers. Before one reaches the main model, check it
 * for text aimed at AI tools ("ignore previous instructions…"). Returns the highest score seen.
 */
export async function injectionScore(text: string): Promise<number> {
  if (!text.trim() || !aiConfigured()) return 0;
  const chunks: string[] = [];
  for (let i = 0; i < Math.min(text.length, 6000); i += 1800) chunks.push(text.slice(i, i + 1800));
  try {
    const scores = await Promise.all(
      chunks.map(async (c) => {
        const d = await call({ model: MODELS.guard, messages: [{ role: "user", content: c }] });
        return Number(d?.choices?.[0]?.message?.content) || 0;
      }),
    );
    return Math.max(0, ...scores);
  } catch {
    // The guard is a safety net, not a gate: if it is unavailable the main prompt still treats listing text as data.
    return 0;
  }
}

/* --------------------------- tiny per-visitor rate limit --------------------------- */

const hits = new Map<string, number[]>();
/** At most `limit` AI calls per visitor per 10 minutes, so a public deploy cannot drain the key. */
export function allow(visitor: string, limit = 40) {
  const t = Date.now();
  const recent = (hits.get(visitor) ?? []).filter((x) => t - x < 600_000);
  if (recent.length >= limit) return false;
  recent.push(t);
  hits.set(visitor, recent);
  return true;
}
