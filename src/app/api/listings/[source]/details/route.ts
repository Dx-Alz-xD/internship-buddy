import type { NextRequest } from "next/server";
import type { SourceId } from "@/lib/types";
import { runDetails } from "@/server/run-source";
import { ADAPTERS } from "@/server/registry";
import { DETAILS } from "@/server/sources";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/listings/[source]/details">) {
  const { source } = await ctx.params;
  const adapter = DETAILS[source as SourceId];
  if (!adapter) return Response.json({ error: "This board includes the full description in the listing already." }, { status: 404 });
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const result = await runDetails(adapter, ref, ADAPTERS[source as SourceId]?.reserve ?? 0);
  if (!result.ok) return Response.json({ error: result.message }, { status: result.status });
  return Response.json({ details: result.details, cached: result.cached }, { headers: { "Cache-Control": "no-store" } });
}
