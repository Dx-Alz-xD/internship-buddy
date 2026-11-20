import "server-only";
import { createHash } from "node:crypto";
import type { SearchInput } from "@/lib/search-input";
import { extractSkills } from "@/lib/skills";
import { COUNTRIES, getRole, ROLES } from "@/lib/taxonomy";
import type { Listing, Pay, WorkMode } from "@/lib/types";
import { BOARDS, type Board } from "./ats-boards";
import { type Adapter, clean, getJson, guessKind, guessWorkMode, truncate } from "./sources";
import { getCached, setCached } from "./store";

const UA = { "User-Agent": "InternshipBuddy/1.0 (student internship finder)" };
const NO_KEY = () => "public";

/** Turns HTML descriptions into readable plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const iso = (v: string | number | null | undefined) => {
  if (v == null || v === "") return null;
  const t = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
/** A short keyword for boards whose search works best with one or two words. */
const keyword = (input: SearchInput) => getRole(ROLES.find((r) => r.query === input.query)?.id ?? `custom:${input.query}`).keywords[0] ?? input.query;
const countryLabel = (code: string) => (code === "in" ? "India" : (COUNTRIES.find((c) => c.code === code)?.label ?? "India"));

function base(partial: Partial<Listing> & Pick<Listing, "id" | "source" | "title" | "company" | "url">): Listing {
  const text = `${partial.title}\n${partial.description ?? partial.summary ?? ""}`;
  return {
    kind: guessKind(partial.title),
    logo: null,
    locations: [],
    locationLabel: "See listing",
    workMode: "unknown",
    pay: null,
    duration: null,
    skills: extractSkills(text, { strict: true }).slice(0, 12),
    summary: "",
    description: null,
    postedLabel: null,
    postedAt: null,
    deadline: null,
    publisher: null,
    tags: [],
    partTime: false,
    ...partial,
  };
}

/* ------------------------------- Himalayas ------------------------------- */

type HmJob = {
  title: string;
  excerpt: string | null;
  companyName: string;
  companyLogo: string | null;
  employmentType: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  salaryPeriod: string | null;
  seniority: string[] | null;
  locationRestrictions: string[] | null;
  description: string | null;
  pubDate: number | null;
  expiryDate: number | null;
  applicationLink: string;
  guid: string;
};

export const himalayas: Adapter = {
  id: "himalayas",
  label: "Himalayas",
  // Their data refreshes daily, and they ask clients to poll about once a day.
  ttlHours: 24,
  reserve: 0,
  apiKey: NO_KEY,
  cacheKey: (i) => `himalayas|${keyword(i)}|${i.includeJobs}|${i.country}`,
  async fetch(input) {
    const p = new URLSearchParams({ q: keyword(input), country: countryLabel(input.country), page: "1", sort: "recent" });
    if (input.includeJobs) p.set("seniority", "Entry-level");
    else p.set("employment_type", "Intern");
    const { body, headers } = await getJson(`https://himalayas.app/jobs/api/search?${p}`, UA);
    const jobs = (body?.jobs ?? []) as HmJob[];
    return {
      headers,
      listings: jobs.map((j) => {
        const desc = htmlToText(j.description);
        const period = j.salaryPeriod === "annual" ? "yearly" : j.salaryPeriod === "monthly" ? "monthly" : j.salaryPeriod === "hourly" ? "hourly" : null;
        const pay: Pay | null = j.minSalary || j.maxSalary ? { label: "", min: j.minSalary, max: j.maxSalary, currency: j.currency, period, unpaid: false } : null;
        const where = j.locationRestrictions?.length ? j.locationRestrictions.join(", ") : "Worldwide";
        return base({
          id: `himalayas:${hash(j.guid)}`,
          source: "himalayas",
          kind: j.employmentType === "Intern" ? "internship" : guessKind(j.title),
          title: clean(j.title),
          company: clean(j.companyName),
          logo: j.companyLogo,
          locations: j.locationRestrictions ?? [],
          locationLabel: `Remote · ${where}`,
          workMode: "remote",
          pay,
          summary: truncate(clean(j.excerpt), 240),
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.pubDate),
          deadline: iso(j.expiryDate),
          url: j.applicationLink,
          publisher: "Himalayas",
          tags: [j.employmentType, ...(j.seniority ?? [])].filter((t): t is string => !!t),
        });
      }),
    };
  },
};

/* ---------------------------- Company career pages ---------------------------- */

const INDIA = /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|delhi|new delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad|jaipur|kochi|coimbatore|chandigarh|indore|mohali|trivandrum|thiruvananthapuram)\b/i;
const ENTRY = /\b(intern|internship|trainee|apprentice|graduate|new grad|campus|fresher|early career)\b/i;
const JUNIOR = /\b(junior|jr\.?|associate|entry[- ]level)\b|\b(sde|software (development )?engineer|developer|analyst|engineer)[\s-]*(i|1)\b/i;
const SENIOR = /\b(senior|sr\.?|lead|staff|principal|manager|director|head|architect|vp|ii|iii|iv|2|3)\b/i;

/** Career-page APIs return loosely shaped JSON; each field is read defensively below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiJob = Record<string, any>;

type Raw = { board: Board; id: string; title: string; team: string; location: string; india: boolean; url: string; posted: string | null; description: string; type: string; workMode: WorkMode; pay: string };

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const item = items[i++]!;
        out.push(await fn(item));
      }
    }),
  );
  return out;
}

async function fetchBoard(b: Board): Promise<Raw[]> {
  try {
    if (b.ats === "greenhouse") {
      const { body } = await getJson(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`, UA);
      return (body?.jobs ?? []).map((j: ApiJob) => {
        const offices = (j.offices ?? []).map((o: { name?: string; location?: string }) => `${o.name ?? ""} ${o.location ?? ""}`).join(" ");
        const location = clean(j.location?.name);
        return {
          board: b,
          id: String(j.id),
          title: clean(j.title),
          team: (j.departments ?? []).map((d: { name: string }) => d.name).join(", "),
          location,
          india: INDIA.test(`${location} ${offices}`),
          url: j.absolute_url,
          posted: j.first_published ?? j.updated_at ?? null,
          description: htmlToText(j.content),
          type: "",
          workMode: guessWorkMode(location),
          pay: "",
        } satisfies Raw;
      });
    }
    if (b.ats === "lever") {
      const { body } = await getJson(`https://api.lever.co/v0/postings/${b.slug}?mode=json&limit=300`, UA);
      return (Array.isArray(body) ? body : []).map((j: ApiJob) => {
        const location = clean(j.categories?.location ?? (j.categories?.allLocations ?? []).join(", "));
        return {
          board: b,
          id: j.id,
          title: clean(j.text),
          team: [j.categories?.team, j.categories?.department].filter(Boolean).join(", "),
          location,
          india: j.country === "IN" || INDIA.test(location),
          url: j.hostedUrl,
          posted: iso(j.createdAt),
          description: clean(j.descriptionPlain) + (j.lists ?? []).map((l: { text: string; content: string }) => `\n\n${l.text}\n${htmlToText(l.content)}`).join(""),
          type: j.categories?.commitment ?? "",
          workMode: j.workplaceType === "remote" ? "remote" : j.workplaceType === "hybrid" ? "hybrid" : j.workplaceType === "onsite" ? "onsite" : "unknown",
          pay: j.salaryRange ? `${j.salaryRange.currency ?? ""} ${j.salaryRange.min ?? ""}–${j.salaryRange.max ?? ""} ${j.salaryRange.interval ?? ""}`.trim() : "",
        } satisfies Raw;
      });
    }
    if (b.ats === "ashby") {
      const { body } = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}?includeCompensation=true`, UA);
      return (body?.jobs ?? []).map((j: ApiJob) => {
        const addr = j.address?.postalAddress ?? {};
        const location = clean([j.location, addr.addressLocality, addr.addressCountry].filter(Boolean).join(", "));
        const secondary = (j.secondaryLocations ?? []).map((s: { location?: string }) => s.location ?? "").join(" ");
        return {
          board: b,
          id: j.id,
          title: clean(j.title),
          team: [j.department, j.team].filter(Boolean).join(", "),
          location,
          india: INDIA.test(`${location} ${secondary}`),
          url: j.jobUrl,
          posted: j.publishedAt ?? null,
          description: clean(j.descriptionPlain) || htmlToText(j.descriptionHtml),
          type: j.employmentType ?? "",
          workMode: j.isRemote ? "remote" : j.workplaceType === "Hybrid" ? "hybrid" : j.workplaceType === "OnSite" ? "onsite" : "unknown",
          pay: j.compensation?.compensationTierSummary ?? "",
        } satisfies Raw;
      });
    }
    const { body } = await getJson(`https://api.smartrecruiters.com/v1/companies/${b.slug}/postings?limit=100&country=in`, UA);
    return (body?.content ?? []).map((j: ApiJob) => {
      const loc = j.location ?? {};
      const location = clean(loc.fullLocation ?? [loc.city, loc.region, loc.country].filter(Boolean).join(", "));
      return {
        board: b,
        id: j.id,
        title: clean(j.name),
        team: j.function?.label ?? "",
        location,
        india: true,
        url: `https://jobs.smartrecruiters.com/${j.company?.identifier ?? b.slug}/${j.id}`,
        posted: j.releasedDate ?? null,
        description: "",
        type: `${j.typeOfEmployment?.label ?? ""} ${j.experienceLevel?.label ?? ""}`,
        workMode: loc.remote ? "remote" : loc.hybrid ? "hybrid" : "onsite",
        pay: "",
      } satisfies Raw;
    });
  } catch {
    // One company's board being down should not hide the others.
    return [];
  }
}

const RAW_TTL = 12 * 3_600_000;

async function allIndiaPostings(): Promise<Raw[]> {
  const cached = await getCached<Raw[]>("careers|raw");
  if (cached && Date.now() - cached.savedAt < RAW_TTL) return cached.data;
  const all = (await pool(BOARDS, 6, fetchBoard)).flat().filter((r) => r.india);
  // Descriptions are long; keep enough for matching and the AI fit check.
  const slim = all.map((r) => ({ ...r, description: truncate(r.description, 6000) }));
  await setCached("careers|raw", slim);
  return slim;
}

export const careers: Adapter = {
  id: "careers",
  label: "Company careers",
  ttlHours: 12,
  reserve: 0,
  apiKey: NO_KEY,
  cacheKey: (i) => `careers|${i.query}|${i.includeJobs}|${i.remote}`,
  async fetch(input) {
    const raw = await allIndiaPostings();
    const role = getRole(ROLES.find((r) => r.query === input.query)?.id ?? `custom:${input.query}`);
    const fits = (r: Raw) => {
      const isIntern = ENTRY.test(r.title) || /intern/i.test(r.type);
      if (isIntern) return true;
      if (!input.includeJobs) return false;
      return (JUNIOR.test(r.title) || /entry/i.test(r.type)) && !SENIOR.test(r.title);
    };
    const relevance = (r: Raw) => (role.keywords.some((k) => `${r.title} ${r.team}`.toLowerCase().includes(k)) ? 1 : 0);
    const picked = raw
      .filter(fits)
      .filter((r) => !input.remote || r.workMode === "remote")
      .sort((a, b) => relevance(b) - relevance(a) || (b.posted ?? "").localeCompare(a.posted ?? ""))
      .slice(0, 60);
    return {
      headers: new Headers(),
      listings: picked.map((r) =>
        base({
          id: `careers:${r.board.ats}:${r.board.slug}:${r.id}`,
          source: "careers",
          kind: ENTRY.test(r.title) || /intern/i.test(r.type) ? "internship" : "job",
          title: r.title,
          company: r.board.name,
          locations: r.location.split(/[,;/]/).map((s) => s.trim()).filter(Boolean),
          locationLabel: r.location || "India",
          workMode: r.workMode,
          pay: r.pay ? { label: r.pay, min: null, max: null, currency: null, period: null, unpaid: false } : null,
          summary: truncate(r.description, 240),
          description: r.description || null,
          postedAt: iso(r.posted),
          url: r.url,
          publisher: `${r.board.name} careers`,
          tags: [r.team, r.type].map((t) => clean(t)).filter(Boolean),
        }),
      ),
    };
  },
};

/* ------------------------------- jobdataapi ------------------------------- */

type JdJob = {
  id: number;
  title: string;
  company: { name: string; logo: string | null } | null;
  location: string | null;
  types: { name: string }[] | null;
  has_remote: boolean;
  published: string | null;
  description: string | null;
  application_url: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
};

export const jobdata: Adapter = {
  id: "jobdata",
  label: "jobdataapi",
  // Anonymous access allows about 10 calls an hour, so one shared copy is reused for 6 hours.
  ttlHours: 6,
  reserve: 0,
  apiKey: NO_KEY,
  cacheKey: (i) => `jobdata|${i.country}`,
  async fetch(input) {
    const p = new URLSearchParams({ country_code: input.country.toUpperCase(), title: "intern" });
    const { body, headers } = await getJson(`https://jobdataapi.com/api/jobs/?${p}`, UA);
    const jobs = (body?.results ?? []) as JdJob[];
    return {
      headers,
      listings: jobs.map((j) => {
        const desc = htmlToText(j.description);
        const types = (j.types ?? []).map((t) => t.name);
        const loc = clean((j.location ?? "").split(" / ")[0]);
        return base({
          id: `jobdata:${j.id}`,
          source: "jobdata",
          kind: types.includes("Internship") || /intern/i.test(j.title) ? "internship" : "job",
          title: clean(j.title),
          company: clean(j.company?.name) || "Company",
          logo: j.company?.logo ?? null,
          locations: loc ? [loc] : [],
          locationLabel: j.has_remote ? `Remote${loc ? ` · ${loc}` : ""}` : loc || "India",
          workMode: j.has_remote ? "remote" : guessWorkMode(loc),
          pay: j.salary_min || j.salary_max ? { label: "", min: j.salary_min, max: j.salary_max, currency: j.salary_currency, period: "yearly", unpaid: false } : null,
          summary: truncate(desc, 240),
          description: truncate(desc, 9000) || null,
          postedAt: iso(j.published),
          url: j.application_url,
          publisher: "jobdataapi",
          tags: types,
          partTime: types.includes("Part Time"),
        });
      }),
    };
  },
};

/* --------------------- Programs & fellowships (curated list) --------------------- */

type Program = { company: string; role: string; deadline: string | null; url: string; who: string; field: string; verified?: boolean };

export const programs: Adapter = {
  id: "programs",
  label: "Programs",
  ttlHours: 24,
  reserve: 0,
  apiKey: NO_KEY,
  cacheKey: () => "programs|all",
  async fetch() {
    // Curated, MIT-licensed list of internship programmes and research fellowships open to Indian students.
    const { body, headers } = await getJson("https://raw.githubusercontent.com/iitian-vibes/India-Tech-Internships/main/data/desk.json", UA);
    const list = (Array.isArray(body) ? body : []) as Program[];
    const today = new Date().toISOString().slice(0, 10);
    return {
      headers,
      listings: list
        .filter((p) => p.url && (!p.deadline || p.deadline >= today))
        .map((p) =>
          base({
            id: `programs:${hash(p.url + p.role)}`,
            source: "programs",
            kind: "internship",
            title: clean(p.role),
            company: clean(p.company),
            locationLabel: (p.company.match(/\(([^)]+)\)\s*$/)?.[1] ?? "See listing").trim(),
            summary: truncate(clean(p.who), 240),
            description: `Who can apply: ${clean(p.who)}`,
            deadline: p.deadline ? new Date(`${p.deadline}T23:59:00`).toISOString() : null,
            url: p.url,
            publisher: p.company.split(/[,(]/)[0]!.trim(),
            tags: [p.field ? `${p.field[0]!.toUpperCase()}${p.field.slice(1)}` : "", p.verified ? "Verified" : ""].filter(Boolean),
            skills: extractSkills(`${p.role} ${p.field}`),
          }),
        ),
    };
  },
};

/* ------------------------- Careerjet (free key) ------------------------- */

type CjJob = { title: string; company: string; date: string; description: string; locations: string; salary: string; salary_min?: number; salary_max?: number; salary_currency_code?: string; salary_type?: string; url: string };

export const careerjet: Adapter = {
  id: "careerjet",
  label: "Careerjet",
  ttlHours: 12,
  reserve: 0,
  apiKey: () => process.env.CAREERJET_API_KEY,
  cacheKey: (i) => `careerjet|${keyword(i)}|${i.city ?? ""}|${i.includeJobs}|${i.country}`,
  async fetch(input, key, ctx) {
    const p = new URLSearchParams({
      locale_code: input.country === "in" ? "en_IN" : `en_${input.country.toUpperCase()}`,
      keywords: keyword(input),
      location: input.city ?? countryLabel(input.country),
      sort: "date",
      page_size: "50",
      user_ip: ctx.ip,
      user_agent: ctx.ua,
    });
    if (!input.includeJobs) p.set("contract_type", "i");
    const { body, headers } = await getJson(`https://search.api.careerjet.net/v4/query?${p}`, {
      ...UA,
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    });
    const periods: Record<string, Pay["period"]> = { Y: "yearly", M: "monthly", W: "weekly", D: "daily", H: "hourly" };
    return {
      headers,
      listings: ((body?.jobs ?? []) as CjJob[]).map((j) =>
        base({
          id: `careerjet:${hash(j.url)}`,
          source: "careerjet",
          kind: input.includeJobs ? guessKind(j.title) : "internship",
          title: clean(j.title),
          company: clean(j.company) || "Company",
          locations: [clean(j.locations)],
          locationLabel: clean(j.locations) || "See listing",
          workMode: guessWorkMode(j.title, j.locations, j.description),
          pay: j.salary ? { label: j.salary, min: j.salary_min ?? null, max: j.salary_max ?? null, currency: j.salary_currency_code ?? null, period: periods[j.salary_type ?? ""] ?? null, unpaid: false } : null,
          summary: truncate(htmlToText(j.description), 240),
          description: htmlToText(j.description) || null,
          postedAt: iso(j.date),
          url: j.url,
          publisher: "Careerjet",
        }),
      ),
    };
  },
};

/* --------------------------- Adzuna (free key) --------------------------- */

type AzJob = {
  id: string;
  title: string;
  description: string;
  created: string;
  redirect_url: string;
  location?: { display_name?: string };
  company?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
};

export const adzuna: Adapter = {
  id: "adzuna",
  label: "Adzuna",
  ttlHours: 12,
  reserve: 5,
  apiKey: () => (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY ? `${process.env.ADZUNA_APP_ID}:${process.env.ADZUNA_APP_KEY}` : undefined),
  cacheKey: (i) => `adzuna|${keyword(i)}|${i.city ?? ""}|${i.includeJobs}|${i.country}`,
  async fetch(input, key) {
    const [appId, appKey] = key.split(":");
    const p = new URLSearchParams({ app_id: appId!, app_key: appKey!, results_per_page: "50", what: keyword(input), max_days_old: "30", sort_by: "date" });
    if (!input.includeJobs) p.set("what_or", "intern internship trainee");
    if (input.city) p.set("where", input.city);
    const { body, headers } = await getJson(`https://api.adzuna.com/v1/api/jobs/${input.country}/search/1?${p}`, { ...UA, Accept: "application/json" });
    return {
      headers,
      listings: ((body?.results ?? []) as AzJob[]).map((j) => {
        const title = htmlToText(j.title);
        const loc = clean(j.location?.display_name);
        return base({
          id: `adzuna:${j.id}`,
          source: "adzuna",
          title,
          company: clean(j.company?.display_name) || "Company",
          locations: loc ? [loc] : [],
          locationLabel: loc || "See listing",
          workMode: guessWorkMode(title, j.description),
          pay: j.salary_min || j.salary_max ? { label: "", min: j.salary_min ?? null, max: j.salary_max ?? null, currency: input.country === "in" ? "INR" : null, period: "yearly", unpaid: false } : null,
          summary: truncate(htmlToText(j.description), 240),
          description: htmlToText(j.description) || null,
          postedAt: iso(j.created),
          url: j.redirect_url,
          publisher: "Adzuna",
          partTime: j.contract_time === "part_time",
        });
      }),
    };
  },
};

/* --------------------------- Jooble (free key) --------------------------- */

type JbJob = { id: number | string; title: string; location: string; snippet: string; salary: string; source: string; type: string; link: string; company: string; updated: string };

export const jooble: Adapter = {
  id: "jooble",
  label: "Jooble",
  // 100 calls a day per key.
  ttlHours: 24,
  reserve: 0,
  apiKey: () => process.env.JOOBLE_API_KEY,
  cacheKey: (i) => `jooble|${keyword(i)}|${i.city ?? ""}|${i.includeJobs}`,
  async fetch(input, key) {
    const host = process.env.JOOBLE_HOST || "in.jooble.org";
    const { body, headers } = await getJson(`https://${host}/api/${key}`, { ...UA, "Content-Type": "application/json" }, {
      method: "POST",
      body: JSON.stringify({ keywords: `${keyword(input)}${input.includeJobs ? "" : " intern"}`, location: input.city ?? "India", page: "1", ResultOnPage: "40" }),
    });
    return {
      headers,
      listings: ((body?.jobs ?? []) as JbJob[]).map((j) => {
        const title = htmlToText(j.title);
        return base({
          id: `jooble:${j.id}`,
          source: "jooble",
          title,
          company: clean(j.company) || "Company",
          locations: [clean(j.location)],
          locationLabel: clean(j.location) || "See listing",
          workMode: guessWorkMode(title, j.location, j.snippet),
          pay: j.salary ? { label: j.salary, min: null, max: null, currency: null, period: null, unpaid: false } : null,
          summary: truncate(htmlToText(j.snippet), 240),
          description: htmlToText(j.snippet) || null,
          postedAt: iso(j.updated),
          url: j.link,
          publisher: j.source || "Jooble",
          tags: [j.type].filter(Boolean),
        });
      }),
    };
  },
};
