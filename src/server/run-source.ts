import "server-only";
import type { SearchInput } from "@/lib/search-input";
import type { Listing, SourceResult } from "@/lib/types";
import { type Adapter, SourceHttpError } from "./sources";
import { getCached, getQuota, recordQuota, setCached } from "./store";

/** Identical requests that arrive together (React dev mode mounts twice) share one upstream call. */
const inFlight = new Map<string, Promise<SourceResult>>();

const stillOpen = (listings: Listing[]) => {
  const now = Date.now();
  return listings.filter((l) => !l.deadline || Date.parse(l.deadline) > now);
};

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export async function runSource(adapter: Adapter, input: SearchInput, refresh: boolean): Promise<SourceResult> {
  const key = adapter.cacheKey(input);
  const running = inFlight.get(key);
  if (running) return running;
  const job = run(adapter, input, refresh, key).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function run(adapter: Adapter, input: SearchInput, refresh: boolean, key: string): Promise<SourceResult> {
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

  if (quota?.remaining != null && quota.remaining <= adapter.reserve) {
    const reset = quota.resetAt ? ` It resets ${when(Date.parse(quota.resetAt))}.` : "";
    return fallback("quota", `${adapter.label}'s free monthly calls are used up.${reset}`);
  }

  try {
    const { listings, headers } = await adapter.fetch(input, apiKey);
    await recordQuota(adapter.id, headers);
    await setCached(key, listings);
    return { ...base, quota: await getQuota(adapter.id), status: "live", fetchedAt: new Date().toISOString(), listings: stillOpen(listings) };
  } catch (err) {
    if (err instanceof SourceHttpError) {
      if (err.status === 429) {
        await recordQuota(adapter.id, err.headers, true);
        return fallback("quota", `${adapter.label} says the monthly limit is reached.`);
      }
      if (err.status === 401 || err.status === 403) {
        return fallback("error", `${adapter.label} rejected the API key (${err.status}). Check that the key is subscribed to this API.`);
      }
      return fallback("error", `${adapter.label} returned an error: ${err.message}.`);
    }
    const msg = err instanceof Error && err.name === "TimeoutError" ? "took too long to answer" : "could not be reached";
    return fallback("error", `${adapter.label} ${msg}.`);
  }
}
