"use client";

import { useCallback, useEffect, useState } from "react";
import type { Listing, ListingDetails } from "./types";

const memo = new Map<string, ListingDetails>();

/** Boards whose full description needs a separate call. Older cached listings lack the flag, so fall back to the source. */
export const hasDetails = (l: Listing) => l.detailsAvailable ?? (l.source === "internshala" || l.source === "linkedin");

const refFor = (l: Listing) => (l.source === "linkedin" ? (l.id.split(":")[1] ?? "") : l.url);

type State = { id: string | null; details: ListingDetails | null; loading: boolean; error: string | null };

/**
 * Full description for listings whose board needs a separate call (Internshala, LinkedIn).
 * Internshala loads on open since its budget is large; LinkedIn waits for a click.
 */
export function useListingDetails(listing: Listing | null) {
  const [state, setState] = useState<State>({ id: null, details: null, loading: false, error: null });
  const id = listing?.id ?? null;
  // State belongs to one listing; when another one opens, start from what is already cached for it.
  const view: State = state.id === id ? state : { id, details: id ? (memo.get(id) ?? null) : null, loading: false, error: null };

  const load = useCallback(async (): Promise<ListingDetails | null> => {
    if (!listing || !hasDetails(listing)) return null;
    const hit = memo.get(listing.id);
    if (hit) {
      setState({ id: listing.id, details: hit, loading: false, error: null });
      return hit;
    }
    setState({ id: listing.id, details: null, loading: true, error: null });
    try {
      const res = await fetch(`/api/listings/${listing.source}/details?ref=${encodeURIComponent(refFor(listing))}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not load the full listing.");
      memo.set(listing.id, data.details);
      setState((prev) => (prev.id === listing.id ? { ...prev, details: data.details, loading: false } : prev));
      return data.details as ListingDetails;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Could not load the full listing.";
      setState((prev) => (prev.id === listing.id ? { ...prev, loading: false, error } : prev));
      return null;
    }
  }, [listing]);

  useEffect(() => {
    if (listing?.source !== "internshala" || !hasDetails(listing) || memo.has(listing.id)) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [listing, load]);

  return { details: view.details, loading: view.loading, error: view.error, load };
}
