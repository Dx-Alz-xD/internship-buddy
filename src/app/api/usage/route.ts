import { connection } from "next/server";
import { aiConfigured } from "@/server/ai";
import { ADAPTERS, SOURCE_IDS } from "@/server/registry";
import { getQuotas } from "@/server/store";

export async function GET() {
  // Quotas change with every API call, so this must run per request rather than at build time.
  await connection();
  const quotas = await getQuotas();
  const sources = SOURCE_IDS.map((id) => ({
    id,
    label: ADAPTERS[id].label,
    configured: !!ADAPTERS[id].apiKey(),
    refreshHours: ADAPTERS[id].ttlHours,
    quota: quotas[id] ?? null,
  }));
  return Response.json({ sources, ai: aiConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
