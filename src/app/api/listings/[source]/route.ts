import type { NextRequest } from "next/server";
import { fromQueryString } from "@/lib/search-input";
import type { SourceId } from "@/lib/types";
import { runSource } from "@/server/run-source";
import { ADAPTERS } from "@/server/registry";

// The first "Company careers" request reads about 45 career pages, which can take a while.
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: RouteContext<"/api/listings/[source]">) {
  const { source } = await ctx.params;
  const adapter = ADAPTERS[source as SourceId];
  if (!adapter) return Response.json({ error: `Unknown source "${source}"` }, { status: 404 });
  const params = req.nextUrl.searchParams;
  const visitor = {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
    ua: req.headers.get("user-agent") || "Mozilla/5.0",
  };
  const result = await runSource(adapter, fromQueryString(params), params.get("refresh") === "1", visitor);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
