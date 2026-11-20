import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { QuotaInfo, SourceId } from "@/lib/types";

/**
 * A tiny on-disk store for API responses and quota counters.
 * Locally it lives in ./.data, on serverless hosts it falls back to the temp dir.
 * Every free-tier API here has a monthly cap (Unstop allows 6 calls a month),
 * so nothing is fetched twice while a cached copy is still fresh.
 */
const ROOT = process.env.VERCEL ? path.join("/tmp", "internship-buddy") : path.join(process.cwd(), ".data");

const memory = new Map<string, unknown>();

async function readJson<T>(file: string): Promise<T | null> {
  if (memory.has(file)) return memory.get(file) as T;
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as T;
    memory.set(file, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  memory.set(file, data);
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data));
  } catch {
    // Read-only filesystem: the in-memory copy still saves calls for this process.
  }
}

export type CacheEntry<T> = { savedAt: number; data: T };

const cacheFile = (key: string) =>
  path.join(ROOT, "cache", createHash("sha1").update(key).digest("hex") + ".json");

export async function getCached<T>(key: string): Promise<CacheEntry<T> | null> {
  return readJson<CacheEntry<T>>(cacheFile(key));
}

export async function setCached<T>(key: string, data: T) {
  await writeJson(cacheFile(key), { savedAt: Date.now(), data } satisfies CacheEntry<T>);
}

const quotaFile = path.join(ROOT, "quota.json");
type QuotaLedger = Partial<Record<SourceId, QuotaInfo>>;

export async function getQuotas(): Promise<QuotaLedger> {
  return (await readJson<QuotaLedger>(quotaFile)) ?? {};
}

export async function getQuota(source: SourceId): Promise<QuotaInfo | null> {
  const q = (await getQuotas())[source] ?? null;
  // Once the reset time has passed the provider has refilled the budget.
  if (q?.resetAt && Date.parse(q.resetAt) < Date.now()) return null;
  return q;
}

/** Reads the rate-limit headers both RapidAPI and omkar.cloud send back. */
export async function recordQuota(source: SourceId, headers: Headers, exhausted = false) {
  const num = (name: string) => {
    const v = headers.get(name);
    return v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  };
  const limit = num("x-ratelimit-requests-limit");
  let remaining = num("x-ratelimit-requests-remaining");
  const reset = num("x-ratelimit-requests-reset");
  if (exhausted) remaining = 0;
  if (limit == null && remaining == null && !exhausted) return;
  // omkar.cloud sends an epoch timestamp, RapidAPI sends seconds-until-reset.
  const resetAt =
    reset == null ? null : new Date(reset > 1_000_000_000 ? reset * 1000 : Date.now() + reset * 1000).toISOString();
  const ledger = await getQuotas();
  const prev = ledger[source];
  ledger[source] = {
    limit: limit ?? prev?.limit ?? null,
    remaining,
    resetAt: resetAt ?? prev?.resetAt ?? null,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(quotaFile, ledger);
}
