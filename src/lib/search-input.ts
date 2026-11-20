import type { Profile } from "./types";
import { getRole } from "./taxonomy";

/** The coarse search sent to every job board. Fine-grained filtering happens on the client. */
export type SearchInput = {
  query: string;
  /** Internshala category for the role, when there is one. */
  category: string | null;
  city: string | null;
  remote: boolean;
  includeJobs: boolean;
  country: string; // ISO-2, lowercase
};

/** A one-off change to where to search, e.g. from a plain-English search, without editing the profile. */
export type SearchOverride = { city?: string | null; remote?: boolean };

export function buildSearchInput(profile: Profile, roleId: string, override?: SearchOverride | null): SearchInput {
  const role = getRole(roleId);
  const remote = override?.remote ?? profile.workMode === "remote";
  const city = override?.city !== undefined ? override.city : profile.cities[0] ?? null;
  return {
    query: role.query,
    category: role.internshala ?? null,
    city: remote || profile.region === "abroad" ? null : city,
    remote,
    includeJobs: profile.wantsJobs,
    country: profile.region === "abroad" ? profile.country || "us" : "in",
  };
}

export function toQueryString(input: SearchInput) {
  const p = new URLSearchParams();
  p.set("q", input.query);
  if (input.category) p.set("cat", input.category);
  if (input.city) p.set("city", input.city);
  if (input.remote) p.set("remote", "1");
  if (input.includeJobs) p.set("jobs", "1");
  p.set("country", input.country);
  return p.toString();
}

export function fromQueryString(p: URLSearchParams): SearchInput {
  return {
    query: (p.get("q") ?? "internship").slice(0, 80),
    category: p.get("cat")?.slice(0, 80) || null,
    city: p.get("city")?.slice(0, 60) || null,
    remote: p.get("remote") === "1",
    includeJobs: p.get("jobs") === "1",
    country: (p.get("country") ?? "in").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "in",
  };
}
