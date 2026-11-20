import type { NextRequest } from "next/server";
import { fromQueryString } from "@/lib/search-input";
import type { SourceId } from "@/lib/types";
import { runSource } from "@/server/run-source";
import { ADAPTERS } from "@/server/sources";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/listings/[source]">) {
  const { source } = await ctx.params;
  const adapter = ADAPTERS[source as SourceId];
  if (!adapter) return Response.json({ error: `Unknown source "${source}"` }, { status: 404 });
  const params = req.nextUrl.searchParams;
  const result = await runSource(adapter, fromQueryString(params), params.get("refresh") === "1");
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
