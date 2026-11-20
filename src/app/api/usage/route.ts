import type { NextRequest } from "next/server";
import { ADAPTERS, SOURCE_IDS } from "@/server/sources";
import { getQuotas } from "@/server/store";

export async function GET(req: NextRequest) {
  // Reading the URL keeps this handler request-time, so the numbers are always current.
  void req.nextUrl;
  const quotas = await getQuotas();
  const sources = SOURCE_IDS.map((id) => ({
    id,
    label: ADAPTERS[id].label,
    configured: !!ADAPTERS[id].apiKey(),
    refreshHours: ADAPTERS[id].ttlHours,
    quota: quotas[id] ?? null,
  }));
  return Response.json({ sources }, { headers: { "Cache-Control": "no-store" } });
}
