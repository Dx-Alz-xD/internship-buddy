import type { NextRequest } from "next/server";
import type { AiTask } from "@/lib/ai-types";
import { AiError, aiConfigured, allow } from "@/server/ai";
import { TASKS } from "@/server/ai-tasks";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/ai/[task]">) {
  const { task } = await ctx.params;
  const run = TASKS[task as AiTask];
  if (!run) return Response.json({ error: `Unknown AI task "${task}".` }, { status: 404 });
  if (!aiConfigured()) return Response.json({ error: "AI is not set up on this server. Add GROQ_API_KEY to .env.local." }, { status: 503 });

  const visitor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(visitor)) return Response.json({ error: "Too many AI requests. Wait a few minutes and try again.", retryAfter: 120 }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  try {
    return Response.json(await run(body), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AiError) return Response.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status });
    const timeout = e instanceof Error && e.name === "TimeoutError";
    return Response.json({ error: timeout ? "The AI took too long to answer. Try again." : "The AI request failed. Try again." }, { status: 502 });
  }
}
