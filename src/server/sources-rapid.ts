import "server-only";
import type { SearchInput } from "@/lib/search-input";
import { getRole, ROLES } from "@/lib/taxonomy";
import type { Listing, ListingDetails, Pay, WorkMode } from "@/lib/types";
import { type Adapter, clean, getJson, guessKind, guessWorkMode, truncate } from "./sources";
import { htmlToText } from "./sources-extra";
import { extractSkills } from "@/lib/skills";

/**
 * More RapidAPI and direct job feeds. Most free plans here count jobs returned rather than calls,
 * so every request asks for a fixed page of 20 and results are shared between visitors for days.
 */

const PAGE = 20;
const rapid = (host: string, key: string) => ({ "x-rapidapi-host": host, "x-rapidapi-key": key });
const RAPID_KEY = () => process.env.RAPIDAPI_KEY;
const keyword = (input: SearchInput) => getRole(ROLES.find((r) => r.query === input.query)?.id ?? `custom:${input.query}`).keywords[0] ?? input.query;
const iso = (v: string | number | null | undefined) => {
  if (v == null || v === "") return null;
  const t = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ENTRY = /\b(intern|internship|trainee|apprentice|fresher|graduate)\b/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiJob = Record<string, any>;


function listing(partial: Partial<Listing> & Pick<Listing, "id" | "source" | "title" | "company" | "url">): Listing {
  return {
    kind: guessKind(partial.title),
    logo: null,
    locations: [],
    locationLabel: "See listing",
    workMode: "unknown",
    pay: null,
    duration: null,
    summary: truncate(clean(partial.description ?? ""), 240),
    description: null,
    postedLabel: null,
    postedAt: null,
    deadline: null,
    publisher: null,
    tags: [],
    partTime: false,
    ...partial,
    // Use the board's own skills when it sends them, otherwise read them from the text.
    skills: partial.skills ?? extractSkills(`${partial.title}\n${partial.description ?? ""}`, { strict: true }).slice(0, 12),
  };
}

/* --------------------------------- hirebase --------------------------------- */

export const hirebase: Adapter = {
  id: "hirebase",
  label: "Hirebase",
  ttlHours: 72,
  reserve: 1,
  apiKey: RAPID_KEY,
  // Free plan: 50 calls and 500 jobs a month.
  quota: { units: [{ header: "x-ratelimit-jobs-remaining", limitHeader: "x-ratelimit-jobs-limit", perCall: PAGE }] },
  cacheKey: (i) => `hirebase|${keyword(i)}|${i.includeJobs}|${i.remote}|${i.country}`,
  supports: (i) => (i.country === "in" ? true : "Searches India only."),
  async fetch(input, key) {
    const body: Record<string, unknown> = {
      keywords: [keyword(input)],
      geo_locations: [{ country: "India" }],
      job_types: input.includeJobs ? ["Internship", "Full Time"] : ["Internship"],
      days_ago: 30,
      sort_by: "date_posted",
      sort_order: "desc",
      page: 1,
      limit: PAGE,
    };
    if (input.remote) body.location_types = ["Remote"];
    const { body: res, headers } = await getJson(
      "https://hirebase-jobs-data.p.rapidapi.com/v2/jobs/search",
      { ...rapid("hirebase-jobs-data.p.rapidapi.com", key), "Content-Type": "application/json" },
      { method: "POST", body: JSON.stringify(body) },
    );
    return {
      headers,
      listings: ((res?.jobs ?? []) as ApiJob[]).map((j) => {
        const locs = (Array.isArray(j.locations) ? j.locations : []) as ApiJob[];
        const cities = locs.map((l) => str(l.city)).filter(Boolean);
        const mode: WorkMode = j.location_type === "Remote" ? "remote" : j.location_type === "Hybrid" ? "hybrid" : j.location_type === "In-Person" ? "onsite" : "unknown";
        const sal = j.salary_range as ApiJob | null;
        const pay: Pay | null =
          sal && (num(sal.min) || num(sal.max))
            ? { label: "", min: num(sal.min), max: num(sal.max), currency: str(sal.currency) || null, period: /month/i.test(str(sal.period)) ? "monthly" : /year|annual/i.test(str(sal.period)) ? "yearly" : null, unpaid: false }
            : null;
        const desc = htmlToText(str(j.description));
        return listing({
          id: `hirebase:${j._id ?? j.md5_hash ?? j.job_slug}`,
          source: "hirebase",
          kind: /intern/i.test(str(j.job_type)) || ENTRY.test(str(j.job_title)) ? "internship" : "job",
          title: clean(j.job_title),
          company: clean(j.company_name) || "Company",
          logo: str(j.company_logo) || null,
          locations: cities,
          locationLabel: mode === "remote" ? `Remote${cities.length ? ` · ${cities.join(", ")}` : ""}` : cities.join(", ") || "India",
          workMode: mode,
          pay,
          skills: strs(j.skills).length ? strs(j.skills) : undefined,
          summary: truncate(clean(str(j.requirements_summary)) || desc, 240),
          description: desc || null,
          postedAt: iso(j.date_posted),
          url: str(j.application_link) || str(j.job_board_link),
          publisher: "Hirebase",
          tags: [str(j.experience_level), j.visa_sponsored ? "Visa sponsorship" : ""].filter(Boolean),
        });
      }),
    };
  },
};

/* ------------------------------- fantastic.jobs ------------------------------- */

export const fantastic: Adapter = {
  id: "fantastic",
  label: "Fantastic.jobs",
  ttlHours: 72,
  reserve: 1,
  apiKey: () => process.env.FANTASTIC_JOBS_API_KEY,
  // Free plan: 100 calls and 500 jobs a month, reported in their own headers.
  quota: { requestsHeader: "x-api-requests-remaining", limitHeader: "x-api-requests-limit", units: [{ header: "x-api-jobs-remaining", perCall: PAGE }] },
  cacheKey: (i) => `fantastic|${keyword(i)}|${i.includeJobs}|${i.remote}|${i.country}`,
  async fetch(input, key) {
    const p = new URLSearchParams({
      time_frame: "7d",
      limit: String(PAGE),
      description_format: "text",
      title: keyword(input),
      location: input.country === "in" ? "India" : input.country.toUpperCase(),
      ai_employment_type: input.includeJobs ? "INTERN,FULL_TIME" : "INTERN",
    });
    if (input.includeJobs) p.set("ai_experience_level", "0-2");
    if (input.remote) p.set("ai_work_arrangement", "Remote Solely,Remote OK");
    const { body, headers } = await getJson(`https://data.fantastic.jobs/v1/active-jb?${p}`, { Authorization: `Bearer ${key}` });
    return {
      headers,
      listings: ((Array.isArray(body) ? body : []) as ApiJob[]).map((j) => {
        const places = strs(j.locations_derived);
        const arrangement = str(j.ai_work_arrangement);
        const mode: WorkMode = /remote/i.test(arrangement) || j.location_type === "TELECOMMUTE" ? "remote" : /hybrid/i.test(arrangement) ? "hybrid" : /on-?site/i.test(arrangement) ? "onsite" : "unknown";
        const min = num(j.ai_salary_min_value) ?? num(j.ai_salary_value);
        const max = num(j.ai_salary_max_value) ?? num(j.ai_salary_value);
        const unit = str(j.ai_salary_unit_text).toUpperCase();
        const pay: Pay | null = min || max ? { label: "", min, max, currency: str(j.ai_salary_currency) || null, period: unit === "MONTH" ? "monthly" : unit === "YEAR" ? "yearly" : unit === "HOUR" ? "hourly" : null, unpaid: false } : null;
        const desc = clean(str(j.description_text)).length ? str(j.description_text) : "";
        const types = strs(j.employment_type);
        return listing({
          id: `fantastic:${j.id}`,
          source: "fantastic",
          kind: types.includes("INTERN") || ENTRY.test(str(j.title)) ? "internship" : "job",
          title: clean(j.title),
          company: clean(j.organization) || "Company",
          logo: str(j.organization_logo) || null,
          locations: places,
          locationLabel: mode === "remote" ? `Remote${places.length ? ` · ${places[0]}` : ""}` : places.join(" · ") || "India",
          workMode: mode,
          pay,
          skills: strs(j.ai_key_skills).length ? strs(j.ai_key_skills) : undefined,
          summary: truncate(clean(str(j.ai_requirements_summary)) || clean(desc), 240),
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.date_posted),
          deadline: iso(j.date_valid_through),
          url: str(j.url),
          publisher: str(j.source_domain) || str(j.source) || "Fantastic.jobs",
          tags: [str(j.seniority), j.direct_apply ? "Apply on company site" : ""].filter(Boolean),
          partTime: types.includes("PART_TIME"),
        });
      }),
    };
  },
};

/* ------------------------------- jobs-api21 ------------------------------- */

export const jobindex: Adapter = {
  id: "jobindex",
  label: "Job index",
  // Free plan: 200 credits a month, one per job, so one shared page every four days.
  ttlHours: 96,
  reserve: 0,
  apiKey: RAPID_KEY,
  quota: { units: [{ header: "x-ratelimit-credits-remaining", limitHeader: "x-ratelimit-credits-limit", perCall: PAGE }] },
  cacheKey: (i) => `jobindex|${i.country}|${i.includeJobs}`,
  async fetch(input, key) {
    const { body, headers } = await getJson(
      "https://jobs-api21.p.rapidapi.com/v1/jobs/search",
      { ...rapid("jobs-api21.p.rapidapi.com", key), "Content-Type": "application/json" },
      {
        method: "POST",
        body: JSON.stringify({
          page: 0,
          limit: PAGE,
          job_country_code_or: [input.country.toUpperCase()],
          posted_at_max_age_days: 14,
          job_title_or: input.includeJobs ? ["intern", "trainee", "fresher", "graduate", "junior"] : ["intern", "trainee"],
        }),
      },
    );
    return {
      headers,
      listings: ((body?.data ?? []) as ApiJob[]).map((j) => {
        const loc = clean(str(j.short_location) || str(j.location));
        const desc = htmlToText(str(j.description));
        const pay: Pay | null =
          num(j.min_salary) || num(j.max_salary) || j.salary_string
            ? { label: str(j.salary_string), min: num(j.min_salary), max: num(j.max_salary), currency: str(j.salary_currency) || null, period: /month/i.test(str(j.salary_period)) ? "monthly" : /year/i.test(str(j.salary_period)) ? "yearly" : null, unpaid: false }
            : null;
        return listing({
          id: `jobindex:${j.id}`,
          source: "jobindex",
          title: clean(j.job_title),
          company: clean(typeof j.company === "string" ? j.company : j.company_object?.name) || "Company",
          logo: str(j.company_object?.logo) || null,
          locations: loc ? [loc] : [],
          locationLabel: j.remote ? `Remote${loc ? ` · ${loc}` : ""}` : loc || "India",
          workMode: j.remote ? "remote" : j.hybrid ? "hybrid" : guessWorkMode(loc),
          pay,
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.date_posted),
          url: str(j.final_url) || str(j.url),
          publisher: (() => {
            try {
              return new URL(str(j.url)).hostname.replace(/^(www|in)\./, "");
            } catch {
              return "Job index";
            }
          })(),
          tags: [j.easy_apply ? "Easy apply" : "", str(j.seniority).replace(/_/g, " ")].filter(Boolean),
        });
      }),
    };
  },
};

/* ------------------------------- remote-jobs1 ------------------------------- */

export const remotejobs: Adapter = {
  id: "remotejobs",
  label: "Remote Jobs",
  // Free plan: 20 calls a month, so one shared page every three days.
  ttlHours: 72,
  reserve: 1,
  apiKey: RAPID_KEY,
  cacheKey: (i) => `remotejobs|${i.country}|${i.includeJobs}`,
  async fetch(input, key) {
    const p = new URLSearchParams({ country: input.country, limit: "50", include_company: "true", include_total_count: "false" });
    if (!input.includeJobs) p.set("employment_type", "internship");
    const { body, headers } = await getJson(`https://remote-jobs1.p.rapidapi.com/jobs?${p}`, rapid("remote-jobs1.p.rapidapi.com", key));
    return {
      headers,
      listings: ((body?.data ?? []) as ApiJob[]).map((j) => {
        const company = (typeof j.company === "object" && j.company ? j.company : {}) as ApiJob;
        const types = strs(j.employmentTypes);
        const desc = htmlToText(str(j.description));
        const countries = strs(j.countries).map((c) => c.toUpperCase());
        return listing({
          id: `remotejobs:${j.id}`,
          source: "remotejobs",
          kind: types.includes("internship") || ENTRY.test(str(j.title)) ? "internship" : "job",
          title: clean(j.title),
          company: clean(str(company.name)) || "Company",
          logo: str(company.logo) || str(company.logo_url) || null,
          locations: countries,
          locationLabel: `Remote · ${countries.slice(0, 4).join(", ") || "Worldwide"}`,
          workMode: "remote",
          skills: strs(j.skills).length ? strs(j.skills) : undefined,
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.datePosted),
          url: str(j.url),
          publisher: (() => {
            try {
              return new URL(str(j.url)).hostname.replace(/^www\./, "");
            } catch {
              return "Remote Jobs";
            }
          })(),
          tags: types.map((t) => t[0]!.toUpperCase() + t.slice(1)),
          partTime: types.includes("parttime"),
        });
      }),
    };
  },
};

/* ------------------------------- jobs-api19 ------------------------------- */

export const freshers: Adapter = {
  id: "freshers",
  label: "Fresher jobs",
  // Free plan: 10 calls a month. The feed is India fresher hiring, so it only runs for students who want jobs.
  ttlHours: 120,
  reserve: 1,
  apiKey: RAPID_KEY,
  cacheKey: () => "freshers|in",
  supports: (i) => (i.includeJobs && i.country === "in" ? true : "Only for final-year students and graduates looking for jobs in India."),
  async fetch(_input, key) {
    const { body, headers } = await getJson("https://jobs-api19.p.rapidapi.com/jobs?limit=50", rapid("jobs-api19.p.rapidapi.com", key));
    return {
      headers,
      listings: ((Array.isArray(body) ? body : []) as ApiJob[]).map((j) => {
        const desc = [str(j.job_description), str(j.role_and_responsibility), str(j.education_and_skills)].map(htmlToText).filter(Boolean).join("\n\n");
        const location = clean(htmlToText(str(j.location)));
        return listing({
          id: `freshers:${j.id}:${clean(str(j.apply_link)).slice(-40)}`,
          source: "freshers",
          kind: "job",
          title: clean(htmlToText(str(j.job_title))) || clean(htmlToText(str(j.title))),
          company: clean(htmlToText(str(j.company)).replace(/\b20\d\d\b/g, "")) || "Company",
          locations: location ? location.split(/[,/]/).map((s) => s.trim()) : [],
          locationLabel: location || "India",
          workMode: guessWorkMode(location, str(j.job_type)),
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.posted_date),
          url: str(j.apply_link),
          publisher: "Fresher jobs",
          tags: [clean(str(j.experience)), clean(str(j.job_type))].filter((t) => t && t !== "Not specified"),
        });
      }),
    };
  },
};

/* ----------------------- job-search15: LinkedIn description backup ----------------------- */

/** Reads a LinkedIn job page's description when the main LinkedIn API's monthly calls run out. */
export const linkedinJdBackup = {
  id: "jdparse",
  label: "LinkedIn description reader",
  reserve: 2,
  apiKey: RAPID_KEY,
  fetch(ref: string, key: string): Promise<{ details: ListingDetails; headers: Headers }> | null {
    if (!/^\d{6,14}$/.test(ref)) return null;
    return getJson(
      "https://job-search15.p.rapidapi.com/",
      { ...rapid("job-search15.p.rapidapi.com", key), "Content-Type": "application/json" },
      { method: "POST", body: JSON.stringify({ api_type: "fetch_parsed_jd_by_url", job_url: `https://www.linkedin.com/jobs/view/${ref}` }) },
    ).then(({ body, headers }) => {
      const d = (Array.isArray(body) ? body[0] : body) as ApiJob | undefined;
      const recruiter = str(d?.recruiter_name);
      return {
        headers,
        details: {
          description: str(d?.full_text) || null,
          whoCanApply: recruiter ? [`Recruiter: ${recruiter}`] : [],
          requirements: null,
          perks: [],
          applyBy: null,
          openings: null,
          applicants: null,
          start: null,
        },
      };
    });
  },
};
