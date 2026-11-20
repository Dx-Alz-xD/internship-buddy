import "server-only";
import type { SearchInput } from "@/lib/search-input";
import { tidySkills } from "@/lib/skills";
import type { Listing, ListingDetails, SourceResult } from "@/lib/types";
import { type Adapter, type DetailsAdapter, type RequestCtx, SourceHttpError } from "./sources";
import { getCached, getQuota, recordQuota, setCached } from "./store";

/** Identical requests that arrive together (React dev mode mounts twice) share one upstream call. */
const inFlight = new Map<string, Promise<SourceResult>>();

/** Drops listings whose deadline has passed and cleans skill lists, for fresh and cached results alike. */
const stillOpen = (listings: Listing[]) => {
  const now = Date.now();
  return listings.filter((l) => !l.deadline || Date.parse(l.deadline) > now).map((l) => ({ ...l, skills: tidySkills(l.skills) }));
};

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export async function runSource(adapter: Adapter, input: SearchInput, refresh: boolean, ctx: RequestCtx): Promise<SourceResult> {
  const key = adapter.cacheKey(input);
  const running = inFlight.get(key);
  if (running) return running;
  const job = run(adapter, input, refresh, key, ctx).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function run(adapter: Adapter, input: SearchInput, refresh: boolean, key: string, ctx: RequestCtx): Promise<SourceResult> {
  const cached = await getCached<Listing[]>(key);
  const quota = await getQuota(adapter.id);
  const base = { source: adapter.id, quota } as const;
  const fresh = cached && Date.now() - cached.savedAt < adapter.ttlHours * 3_600_000;

  if (cached && fresh && !refresh) {
    return { ...base, status: "cached", fetchedAt: new Date(cached.savedAt).toISOString(), listings: stillOpen(cached.data) };
  }

  const fallback = (status: SourceResult["status"], message: string): SourceResult =>
    cached
      ? { ...base, status: "stale", fetchedAt: new Date(cached.savedAt).toISOString(), listings: stillOpen(cached.data), message: `${message} Showing the copy saved ${when(cached.savedAt)}.` }
      : { ...base, status, fetchedAt: null, listings: [], message };

  const apiKey = adapter.apiKey();
  if (!apiKey) return fallback("missing-key", `No API key set for ${adapter.label}.`);

  const supported = adapter.supports ? adapter.supports(input) : true;
  if (supported !== true) return { ...base, status: "skipped", fetchedAt: null, listings: [], message: supported };

  if (quota?.remaining != null && quota.remaining <= adapter.reserve) {
    const reset = quota.resetAt ? ` It resets ${when(Date.parse(quota.resetAt))}.` : "";
    return fallback("quota", `${adapter.label}'s free monthly calls are used up.${reset}`);
  }

  try {
    const { listings, headers } = await adapter.fetch(input, apiKey, ctx);
    await recordQuota(adapter.id, headers, false, adapter.quota);
    await setCached(key, listings);
    return { ...base, quota: await getQuota(adapter.id), status: "live", fetchedAt: new Date().toISOString(), listings: stillOpen(listings) };
  } catch (err) {
    if (err instanceof SourceHttpError) {
      if (err.status === 429) {
        await recordQuota(adapter.id, err.headers, true);
        return fallback("quota", `${adapter.label} says the monthly limit is reached.`);
      }
      if (err.status === 401 || err.status === 403) {
        return fallback("error", `${adapter.label} rejected the request (${err.status}): ${err.message}. Check that the key is subscribed to this API and allowed from this server.`);
      }
      return fallback("error", `${adapter.label} returned an error: ${err.message}.`);
    }
    const msg = err instanceof Error && err.name === "TimeoutError" ? "took too long to answer" : "could not be reached";
    return fallback("error", `${adapter.label} ${msg}.`);
  }
}

/* ------------------------------ Listing details ------------------------------ */

export type DetailsResult =
  | { ok: true; details: ListingDetails; cached: boolean }
  | { ok: false; status: number; message: string };

const DETAILS_TTL = 14 * 24 * 3_600_000;

/** Full description for one listing. Cached for two weeks, and subject to the same monthly budget guard. */
export async function runDetails(adapter: DetailsAdapter, ref: string, reserve: number): Promise<DetailsResult> {
  const key = `details|${adapter.source}|${ref}`;
  const cached = await getCached<ListingDetails>(key);
  if (cached && Date.now() - cached.savedAt < DETAILS_TTL) return { ok: true, details: cached.data, cached: true };

  // Try the main provider, then the fallback, each behind its own monthly budget guard.
  const providers = [
    { id: adapter.source as string, label: adapter.label, reserve, apiKey: () => (adapter.source === "internshala" ? process.env.INTERNSHALA_API_KEY : process.env.RAPIDAPI_KEY), fetch: adapter.fetch },
    ...(adapter.fallback ? [adapter.fallback] : []),
  ];
  let message = `${adapter.label} did not return the full listing.`;
  for (const p of providers) {
    const apiKey = p.apiKey();
    if (!apiKey) continue;
    const quota = await getQuota(p.id);
    if (quota?.remaining != null && quota.remaining <= p.reserve) {
      message = `${p.label}'s free monthly calls are used up, so the full description is not available.`;
      continue;
    }
    const job = p.fetch(ref, apiKey);
    if (!job) return { ok: false, status: 400, message: "That listing reference is not valid." };
    try {
      const { details, headers } = await job;
      await recordQuota(p.id, headers);
      if (!details.description) continue;
      await setCached(key, details);
      return { ok: true, details, cached: false };
    } catch (err) {
      if (err instanceof SourceHttpError && err.status === 429) await recordQuota(p.id, err.headers, true);
    }
  }
  if (cached) return { ok: true, details: cached.data, cached: true };
  return { ok: false, status: 502, message };
}
