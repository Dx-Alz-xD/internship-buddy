import { daysAgo, monthlyInr, rupees } from "./format";
import { canonicalSkill } from "./skills";
import { getRole } from "./taxonomy";
import type { Listing, Profile } from "./types";

export type Match = {
  score: number;
  reasons: string[];
  warnings: string[];
  matchedSkills: string[];
};

const SENIOR = /\b(senior|sr\.?|lead|staff|principal|manager|director|head of|architect|vp)\b|\b[3-9]\+?\s*(?:years|yrs)\b/i;

function includesWord(haystack: string, needle: string) {
  const n = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${n}`, "i").test(haystack);
}

/**
 * Scores a listing for one student, 0–100. Plain additive points so the reasons shown in
 * the UI line up with the number:
 *   role in the title 35 · skills 35 · place 15 · stipend 10 · freshness 5
 */
export function scoreListing(listing: Listing, profile: Profile, roleId: string): Match {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // Role
  const role = getRole(roleId);
  const otherRoles = profile.roles.filter((r) => r !== roleId).map(getRole);
  const title = listing.title.toLowerCase();
  const body = `${listing.summary} ${listing.skills.join(" ")} ${listing.description ?? ""}`.toLowerCase();
  if (role.keywords.some((k) => includesWord(title, k))) {
    score += 35;
    reasons.push(`${role.label} role`);
  } else if (otherRoles.some((r) => r.keywords.some((k) => includesWord(title, k)))) {
    const r = otherRoles.find((r) => r.keywords.some((k) => includesWord(title, k)))!;
    score += 25;
    reasons.push(`Fits your ${r.label} interest`);
  } else if (role.keywords.some((k) => includesWord(body, k))) {
    score += 15;
  } else {
    score += 4;
  }

  // Skills
  const mine = new Map(profile.skills.map((s) => [canonicalSkill(s).toLowerCase(), s]));
  const theirs = Array.from(new Set(listing.skills.map((s) => canonicalSkill(s))));
  const matchedSkills = theirs.filter((s) => mine.has(s.toLowerCase()));
  if (theirs.length === 0) {
    score += 12;
  } else {
    const wanted = Math.min(theirs.length, 5);
    score += Math.round(35 * Math.min(1, matchedSkills.length / wanted));
    if (matchedSkills.length) {
      reasons.push(`You know ${matchedSkills.length} of ${theirs.length} skills listed`);
    } else if (theirs.length >= 3) {
      warnings.push("None of the listed skills are on your profile");
    }
  }

  // Place
  const cities = profile.cities.map((c) => c.toLowerCase());
  const inMyCity = listing.locations.some((l) => cities.some((c) => l.toLowerCase().includes(c))) ||
    cities.some((c) => listing.locationLabel.toLowerCase().includes(c));
  if (listing.workMode === "remote") {
    score += profile.workMode === "onsite" ? 8 : 15;
    if (profile.workMode !== "onsite") reasons.push("Work from home");
  } else if (inMyCity) {
    score += 15;
    reasons.push(`In ${profile.cities.find((c) => listing.locationLabel.toLowerCase().includes(c.toLowerCase()) || listing.locations.some((l) => l.toLowerCase().includes(c.toLowerCase()))) ?? "your city"}`);
  } else if (profile.workMode === "remote") {
    score += 2;
    warnings.push("Not marked as remote");
  } else if (listing.workMode === "unknown") {
    score += 7;
  } else {
    score += profile.workMode === "any" && cities.length === 0 ? 10 : 4;
  }

  // Stipend
  const monthly = monthlyInr(listing.pay);
  if (monthly == null) {
    score += 5;
  } else if (monthly >= profile.minStipend) {
    score += 10;
    if (monthly > 0 && profile.minStipend > 0) reasons.push(`Pays over your ${rupees(profile.minStipend)} minimum`);
  } else {
    warnings.push(monthly === 0 ? "Unpaid" : `Pays below your ${rupees(profile.minStipend)} minimum`);
  }

  // Freshness
  const age = daysAgo(listing.postedAt);
  if (age != null) {
    if (age <= 3) {
      score += 5;
      reasons.push("Posted in the last 3 days");
    } else if (age <= 7) score += 3;
    else if (age <= 30) score += 1;
  }

  // Fit for the student's stage
  if (SENIOR.test(listing.title)) {
    score -= 30;
    warnings.push("Asks for senior experience");
  }
  if (listing.kind === "job" && !profile.wantsJobs) {
    score -= 15;
    warnings.push("Full-time job, not an internship");
  }
  if (listing.partTime && !profile.partTime) {
    score -= 5;
    warnings.push("Part-time");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, warnings, matchedSkills };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|inc|technologies|technology|solutions|india)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// When the same opening appears twice, keep the copy from the board with the richest data.
const SOURCE_RANK: Record<string, number> = { internshala: 0, careers: 1, jsearch: 2, himalayas: 3, jobdata: 4, adzuna: 5, careerjet: 6, jooble: 7, linkedin: 8, unstop: 9, programs: 10 };

/** Merges the same opening posted on several boards, keeping the most detailed copy. */
export function dedupe(listings: Listing[]): Listing[] {
  const byKey = new Map<string, Listing>();
  for (const l of listings) {
    const key = `${norm(l.title)}|${norm(l.company)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...l, alsoOn: [] });
      continue;
    }
    const [keep, drop] = SOURCE_RANK[l.source] < SOURCE_RANK[prev.source] ? [l, prev] : [prev, l];
    const alsoOn = Array.from(new Set([...(prev.alsoOn ?? []), drop.source])).filter((s) => s !== keep.source);
    byKey.set(key, { ...keep, alsoOn, description: keep.description ?? drop.description, logo: keep.logo ?? drop.logo });
  }
  return Array.from(byKey.values());
}
