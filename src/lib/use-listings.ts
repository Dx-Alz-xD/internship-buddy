"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dedupe } from "./match";
import { buildSearchInput, type SearchOverride, toQueryString } from "./search-input";
import type { Listing, Profile, SourceId, SourceResult } from "./types";

export const SOURCES: { id: SourceId; label: string; credit?: string }[] = [
  { id: "internshala", label: "Internshala" },
  { id: "jsearch", label: "Google Jobs" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "unstop", label: "Unstop" },
  { id: "careers", label: "Company careers" },
  { id: "himalayas", label: "Himalayas", credit: "https://himalayas.app" },
  { id: "jobdata", label: "jobdataapi", credit: "https://jobdataapi.com" },
  { id: "programs", label: "Programs", credit: "https://github.com/iitian-vibes/India-Tech-Internships" },
  { id: "careerjet", label: "Careerjet", credit: "https://www.careerjet.co.in" },
  { id: "adzuna", label: "Adzuna", credit: "https://www.adzuna.in" },
  { id: "jooble", label: "Jooble", credit: "https://jooble.org" },
  { id: "hirebase", label: "Hirebase", credit: "https://hirebase.org" },
  { id: "fantastic", label: "Fantastic.jobs", credit: "https://fantastic.jobs" },
  { id: "jobindex", label: "Job index" },
  { id: "remotejobs", label: "Remote Jobs" },
  { id: "freshers", label: "Fresher jobs" },
];

export type SourceState = { loading: boolean; result: SourceResult | null };

const initial = () =>
  Object.fromEntries(SOURCES.map((s) => [s.id, { loading: true, result: null }])) as Record<SourceId, SourceState>;

/** Asks every board in parallel; each one fills in as soon as it answers. */
export function useListings(profile: Profile | null, roleId: string | null, override?: SearchOverride | null) {
  const [state, setState] = useState<Record<SourceId, SourceState>>(initial);
  // A refresh request only applies to the search it was made for, so switching roles never forces a paid call.
  const [refreshReq, setRefreshReq] = useState<{ qs: string; source: SourceId | "all"; n: number } | null>(null);

  const handledRefresh = useRef(0);

  const qs = useMemo(
    () => (profile && roleId ? toQueryString(buildSearchInput(profile, roleId, override)) : null),
    [profile, roleId, override],
  );

  useEffect(() => {
    if (!qs) return;
    const ctrl = new AbortController();
    // Each refresh click is honoured once; re-running this effect for any other reason reads the cache.
    const refresh = !!refreshReq && refreshReq.qs === qs && refreshReq.n > handledRefresh.current;
    if (refreshReq) handledRefresh.current = refreshReq.n;
    const targets = refresh && refreshReq.source !== "all" ? [refreshReq.source] : SOURCES.map((s) => s.id);
    setState((prev) => {
      const next = { ...prev };
      for (const id of targets) next[id] = { loading: true, result: refresh ? prev[id].result : null };
      return next;
    });
    for (const id of targets) {
      fetch(`/api/listings/${id}?${qs}${refresh ? "&refresh=1" : ""}`, { signal: ctrl.signal })
        .then(async (r) => (r.ok ? ((await r.json()) as SourceResult) : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((result) => setState((prev) => ({ ...prev, [id]: { loading: false, result } })))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setState((prev) => ({
            ...prev,
            [id]: {
              loading: false,
              result: { source: id, status: "error", fetchedAt: null, listings: [], message: "Could not reach the app server." },
            },
          }));
        });
    }
    return () => ctrl.abort();
  }, [qs, refreshReq]);

  const listings: Listing[] = useMemo(
    () => dedupe(SOURCES.flatMap((s) => state[s.id].result?.listings ?? [])),
    [state],
  );

  const refresh = useCallback(
    (source: SourceId | "all" = "all") => {
      if (qs) setRefreshReq((prev) => ({ qs, source, n: (prev?.n ?? 0) + 1 }));
    },
    [qs],
  );
  const loading = SOURCES.some((s) => state[s.id].loading);

  return { sources: state, listings, loading, refresh };
}
