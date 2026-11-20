import "server-only";
import { extractSkills } from "@/lib/skills";
import type { SearchInput } from "@/lib/search-input";
import type { Listing, Pay, SourceId, WorkMode } from "@/lib/types";
import { COUNTRIES } from "@/lib/taxonomy";

export class SourceHttpError extends Error {
  constructor(
    public status: number,
    public headers: Headers,
    message: string,
  ) {
    super(message);
  }
}

export type Adapter = {
  id: SourceId;
  label: string;
  /** How long a cached response is served before calling the API again. */
  ttlHours: number;
  /** Stop calling once this many calls are left in the month. */
  reserve: number;
  apiKey: () => string | undefined;
  cacheKey: (input: SearchInput) => string;
  fetch: (input: SearchInput, key: string) => Promise<{ listings: Listing[]; headers: Headers }>;
};

const TIMEOUT_MS = 20_000;

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? body?.error ?? message;
    } catch {}
    throw new SourceHttpError(res.status, res.headers, message);
  }
  return { body: await res.json(), headers: res.headers };
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function guessKind(title: string, types: string[] = []): Listing["kind"] {
  if (types.some((t) => /intern/i.test(t)) || /\bintern(ship)?\b|trainee|apprentice/i.test(title)) return "internship";
  return "job";
}

function guessWorkMode(...texts: (string | null | undefined)[]): WorkMode {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bremote\b|work from home|\bwfh\b/.test(t)) return "remote";
  return "unknown";
}

/* ----------------------------- Internshala ----------------------------- */

type IsPay = { label: string; min: number | null; max: number | null; currency: string | null; period: string | null; is_unpaid: boolean } | null;
type IsItem = {
  id: number;
  type: string;
  title: string;
  link: string;
  company: { name: string; logo: string | null } | null;
  locations: string[] | null;
  work_mode: "in_office" | "hybrid" | "work_from_home" | string;
  is_part_time: boolean;
  stipend?: IsPay;
  salary?: IsPay;
  duration?: { label: string } | null;
  experience?: { label: string } | null;
  skills: string[] | null;
  summary: string | null;
  posted: { label: string; date: string } | null;
  is_actively_hiring: boolean;
  is_early_applicant: boolean;
  job_offer: { label: string } | null;
  labels: string[] | null;
};

function isPay(p: IsPay | undefined): Pay | null {
  if (!p) return null;
  const period = (["monthly", "yearly", "hourly", "weekly", "daily"] as const).find((x) => x === p.period) ?? null;
  return { label: p.label, min: p.min, max: p.max, currency: p.currency, period, unpaid: p.is_unpaid };
}

function fromInternshala(i: IsItem, kind: Listing["kind"]): Listing {
  const workMode: WorkMode = i.work_mode === "work_from_home" ? "remote" : i.work_mode === "hybrid" ? "hybrid" : "onsite";
  const locations = i.locations ?? [];
  const tags: string[] = [];
  if (i.job_offer?.label) tags.push(i.job_offer.label);
  if (i.is_actively_hiring) tags.push("Actively hiring");
  if (i.is_early_applicant) tags.push("Few applicants so far");
  if (i.experience?.label) tags.push(i.experience.label);
  for (const l of i.labels ?? []) tags.push(l);
  return {
    id: `internshala:${i.id}`,
    source: "internshala",
    kind,
    title: clean(i.title),
    company: clean(i.company?.name) || "Company on Internshala",
    logo: i.company?.logo ?? null,
    locations,
    locationLabel: workMode === "remote" ? "Work from home" : locations.join(", ") || "India",
    workMode,
    pay: isPay(kind === "job" ? i.salary : i.stipend),
    duration: i.duration?.label ?? null,
    skills: i.skills ?? [],
    summary: clean(i.summary),
    description: null,
    postedLabel: i.posted?.label ?? null,
    postedAt: i.posted?.date ? new Date(i.posted.date).toISOString() : null,
    deadline: null,
    url: i.link,
    publisher: "Internshala",
    tags,
    partTime: !!i.is_part_time,
  };
}

const internshala: Adapter = {
  id: "internshala",
  label: "Internshala",
  ttlHours: 6,
  reserve: 10,
  apiKey: () => process.env.INTERNSHALA_API_KEY,
  cacheKey: (i) => `internshala|${i.category ?? i.query}|${i.city ?? ""}|${i.remote}|${i.includeJobs}`,
  async fetch(input, key) {
    const base = "https://internshala-scraper.omkar.cloud/internshala";
    // Category search returns far more than keyword search for the same role.
    const params = new URLSearchParams(input.category ? { category: input.category, page: "1" } : { query: input.query, page: "1" });
    if (input.remote) params.set("work_from_home", "true");
    else if (input.city) params.set("location", input.city);
    const headers = { "API-Key": key };
    const internships = await getJson(`${base}/internships/search?${params}`, headers);
    const listings = (internships.body.internships as IsItem[]).map((i) => fromInternshala(i, "internship"));
    let lastHeaders = internships.headers;
    if (input.includeJobs) {
      const jp = new URLSearchParams(params);
      jp.set("experience", "fresher");
      try {
        const jobs = await getJson(`${base}/jobs/search?${jp}`, headers);
        listings.push(...(jobs.body.jobs as IsItem[]).map((i) => fromInternshala(i, "job")));
        lastHeaders = jobs.headers;
      } catch (e) {
        if (!(e instanceof SourceHttpError)) throw e;
      }
    }
    return { listings, headers: lastHeaders };
  },
};

/* -------------------------- JSearch (Google Jobs) -------------------------- */

type JsItem = {
  job_id: string;
  job_uid?: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_publisher: string | null;
  job_employment_types?: string[];
  job_employment_type?: string | null;
  job_apply_link: string;
  job_apply_is_direct: boolean;
  job_description: string | null;
  job_is_remote: boolean;
  job_posted_at: string | null;
  job_posted_at_datetime_utc: string | null;
  job_location: string | null;
  job_city: string | null;
  job_state: string | null;
  job_country: string | null;
  job_salary_string: string | null;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_period: string | null;
  job_google_link?: string | null;
};

const CURRENCY_BY_COUNTRY: Record<string, string> = { IN: "INR", US: "USD", GB: "GBP", CA: "CAD", DE: "EUR", NL: "EUR", SG: "SGD", AE: "AED", AU: "AUD" };

function fromJSearch(j: JsItem): Listing {
  const description = clean(j.job_description);
  const kind = guessKind(j.job_title, j.job_employment_types);
  const loc = j.job_location || [j.job_city, j.job_state].filter(Boolean).join(", ") || j.job_country || "";
  const workMode: WorkMode = j.job_is_remote ? "remote" : guessWorkMode(j.job_title, loc, description.slice(0, 1500));
  const periodMap: Record<string, Pay["period"]> = { YEAR: "yearly", MONTH: "monthly", HOUR: "hourly", WEEK: "weekly", DAY: "daily" };
  const hasPay = j.job_min_salary != null || j.job_max_salary != null || !!j.job_salary_string;
  const pay: Pay | null = hasPay
    ? {
        label: j.job_salary_string ?? "",
        min: j.job_min_salary,
        max: j.job_max_salary,
        currency: CURRENCY_BY_COUNTRY[j.job_country ?? ""] ?? null,
        period: periodMap[j.job_salary_period ?? ""] ?? null,
        unpaid: false,
      }
    : null;
  return {
    id: `jsearch:${j.job_uid ?? j.job_id}`,
    source: "jsearch",
    kind,
    title: clean(j.job_title),
    company: clean(j.employer_name),
    logo: j.employer_logo,
    locations: [j.job_city, j.job_state].filter(Boolean) as string[],
    locationLabel: workMode === "remote" ? `Remote${loc ? ` · ${loc}` : ""}` : loc || "Location not listed",
    workMode,
    pay,
    duration: null,
    skills: extractSkills(`${j.job_title}\n${description}`, { strict: true }).slice(0, 12),
    summary: truncate(description, 240),
    description: truncate(j.job_description ?? "", 9000) || null,
    postedLabel: j.job_posted_at,
    postedAt: j.job_posted_at_datetime_utc,
    deadline: null,
    url: j.job_apply_link || j.job_google_link || "",
    publisher: j.job_publisher,
    tags: [j.job_apply_is_direct ? "Apply on company site" : null, j.job_employment_type].filter(Boolean) as string[],
    partTime: (j.job_employment_types ?? []).includes("PARTTIME"),
  };
}

const jsearch: Adapter = {
  id: "jsearch",
  label: "Google Jobs",
  ttlHours: 24,
  reserve: 3,
  apiKey: () => process.env.RAPIDAPI_KEY,
  cacheKey: (i) => `jsearch|${i.query}|${i.city ?? ""}|${i.remote}|${i.includeJobs}|${i.country}`,
  async fetch(input, key) {
    const place = input.remote ? "" : input.city ? ` in ${input.city}` : input.country === "in" ? " in India" : "";
    const query = `${input.query}${input.includeJobs ? "" : " intern"}${place}`;
    const params = new URLSearchParams({
      query,
      page: "1",
      num_pages: "1",
      country: input.country,
      date_posted: "month",
      employment_types: input.includeJobs ? "INTERN,FULLTIME" : "INTERN",
    });
    if (input.remote) params.set("work_from_home", "true");
    if (input.includeJobs) params.set("job_requirements", "no_experience,under_3_years_experience");
    const { body, headers } = await getJson(`https://jsearch.p.rapidapi.com/search-v2?${params}`, {
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
      "x-rapidapi-key": key,
    });
    const jobs: JsItem[] = body?.data?.jobs ?? body?.data ?? [];
    return { listings: jobs.map(fromJSearch), headers };
  },
};

/* ------------------------------- LinkedIn ------------------------------- */

type LiItem = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  datePosted: string | null;
  postedTimeAgo: string | null;
  linkedinUrl: string;
};

function fromLinkedIn(l: LiItem): Listing {
  const workMode = guessWorkMode(l.title, l.location);
  return {
    id: `linkedin:${l.id}`,
    source: "linkedin",
    kind: guessKind(l.title),
    title: clean(l.title),
    company: clean(l.companyName),
    logo: null,
    locations: [l.location],
    locationLabel: l.location || "Location not listed",
    workMode,
    pay: null,
    duration: null,
    skills: extractSkills(l.title),
    summary: "",
    description: null,
    postedLabel: l.postedTimeAgo,
    postedAt: l.datePosted ? new Date(l.datePosted).toISOString() : null,
    deadline: null,
    url: l.linkedinUrl,
    publisher: "LinkedIn",
    tags: [],
    partTime: false,
  };
}

const linkedin: Adapter = {
  id: "linkedin",
  label: "LinkedIn",
  ttlHours: 48,
  reserve: 2,
  apiKey: () => process.env.RAPIDAPI_KEY,
  cacheKey: (i) => `linkedin|${i.query}|${i.city ?? ""}|${i.remote}|${i.includeJobs}|${i.country}`,
  async fetch(input, key) {
    const countryLabel = input.country === "in" ? "India" : (COUNTRIES.find((c) => c.code === input.country)?.label ?? "Worldwide");
    const params = new URLSearchParams({
      query: input.query,
      location: input.city ? `${input.city}, ${countryLabel}` : countryLabel,
      datePosted: "month",
      experienceLevels: input.includeJobs ? "intern;entry" : "intern",
      employmentTypes: input.includeJobs ? "intern;fulltime" : "intern",
    });
    if (input.remote) params.set("workplaceTypes", "remote");
    const { body, headers } = await getJson(`https://jobs-api14.p.rapidapi.com/v2/linkedin/search?${params}`, {
      "x-rapidapi-host": "jobs-api14.p.rapidapi.com",
      "x-rapidapi-key": key,
    });
    if (body?.hasError && !body?.data?.length) {
      throw new SourceHttpError(502, headers, body?.errors?.[0]?.message ?? "LinkedIn search failed");
    }
    return { listings: ((body?.data ?? []) as LiItem[]).map(fromLinkedIn), headers };
  },
};

/* -------------------------------- Unstop -------------------------------- */

type UnItem = {
  id: number;
  title: string;
  url: string;
  public_url: string;
  start_date: string | null;
  end_date: string | null;
  region: string | null;
  regn_open: number;
  logo: string | null;
  approved_date?: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Unstop only returns the listing title; the organisation is recoverable from the URL slug. */
export function unstopCompany(item: Pick<UnItem, "id" | "title" | "public_url">): string {
  const slug = (item.public_url.split("/").pop() ?? "").replace(new RegExp(`-${item.id}$`), "");
  let rest = slug.startsWith(slugify(item.title)) ? slug.slice(slugify(item.title).length) : slug;
  rest = rest.replace(/^-+/, "").replace(/^internship-/, "");
  return rest ? titleCase(rest.replace(/-/g, " ")) : "Company on Unstop";
}

function fromUnstop(u: UnItem): Listing {
  const online = (u.region ?? "").toLowerCase() === "online";
  const approved = u.approved_date ? Date.parse(u.approved_date.replace(" GMT", "")) : NaN;
  const posted = Number.isFinite(approved) ? new Date(approved).toISOString() : u.start_date;
  return {
    id: `unstop:${u.id}`,
    source: "unstop",
    kind: "internship",
    title: clean(u.title),
    company: unstopCompany(u),
    logo: u.logo,
    locations: [],
    locationLabel: online ? "Online / remote" : "See listing",
    workMode: online ? "remote" : "unknown",
    pay: null,
    duration: null,
    skills: extractSkills(u.title),
    summary: "",
    description: null,
    postedLabel: null,
    postedAt: posted ? new Date(posted).toISOString() : null,
    deadline: u.end_date ? new Date(u.end_date).toISOString() : null,
    url: u.url,
    publisher: "Unstop",
    tags: [],
    partTime: false,
  };
}

const unstop: Adapter = {
  id: "unstop",
  label: "Unstop",
  // The free plan allows 6 calls a month, and the endpoint ignores search terms,
  // so one shared copy is refreshed at most every five days.
  ttlHours: 120,
  reserve: 0,
  apiKey: () => process.env.RAPIDAPI_KEY,
  cacheKey: () => "unstop|internships|1",
  async fetch(_input, key) {
    const { body, headers } = await getJson("https://unstop-api.p.rapidapi.com/internships?page=1", {
      "x-rapidapi-host": "unstop-api.p.rapidapi.com",
      "x-rapidapi-key": key,
    });
    const now = Date.now();
    const open = ((body?.results ?? []) as UnItem[]).filter(
      (u) => u.regn_open === 1 && (!u.end_date || Date.parse(u.end_date) > now),
    );
    return { listings: open.map(fromUnstop), headers };
  },
};

export const ADAPTERS: Record<SourceId, Adapter> = { internshala, jsearch, linkedin, unstop };
export const SOURCE_IDS = Object.keys(ADAPTERS) as SourceId[];
