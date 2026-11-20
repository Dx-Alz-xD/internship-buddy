export type SourceId = "internshala" | "jsearch" | "linkedin" | "unstop";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type Pay = {
  label: string;
  min: number | null;
  max: number | null;
  currency: string | null;
  period: "monthly" | "yearly" | "hourly" | "weekly" | "daily" | null;
  unpaid: boolean;
};

/** One opening, normalised from any source. */
export type Listing = {
  id: string;
  source: SourceId;
  kind: "internship" | "job";
  title: string;
  company: string;
  logo: string | null;
  locations: string[];
  locationLabel: string;
  workMode: WorkMode;
  pay: Pay | null;
  duration: string | null;
  skills: string[];
  summary: string;
  description: string | null;
  postedLabel: string | null;
  postedAt: string | null;
  deadline: string | null;
  url: string;
  publisher: string | null;
  tags: string[];
  partTime: boolean;
  /** Filled in on the client when the same opening shows up on several sources. */
  alsoOn?: SourceId[];
};

export type SourceStatus =
  | "live" // fetched just now
  | "cached" // served from cache, still fresh
  | "stale" // cache is old but the API budget is used up or the API failed
  | "quota" // no budget left and nothing cached
  | "error"
  | "missing-key";

export type QuotaInfo = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  updatedAt: string;
};

export type SourceResult = {
  source: SourceId;
  status: SourceStatus;
  fetchedAt: string | null;
  listings: Listing[];
  message?: string;
  quota?: QuotaInfo | null;
};

export type StudyYear = "1" | "2" | "3" | "4" | "5" | "grad";

export type Profile = {
  name: string;
  status: "student" | "graduate" | "switcher";
  college: string;
  collegeCity: string;
  degree: string;
  branch: string;
  year: StudyYear;
  gradYear: number;
  roles: string[];
  skills: string[];
  workMode: "remote" | "onsite" | "hybrid" | "any";
  cities: string[];
  region: "india" | "abroad";
  country: string;
  minStipend: number;
  maxDuration: number | null;
  availableFrom: string;
  partTime: boolean;
  wantsJobs: boolean;
  links: { linkedin: string; github: string; portfolio: string };
  cv: CvMeta | null;
  createdAt: string;
  updatedAt: string;
};

export type CvMeta = {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  skills: string[];
  wordCount: number;
  preview: string;
};

export type CvParseResult = {
  text: string;
  wordCount: number;
  skills: string[];
  links: { linkedin: string; github: string; portfolio: string };
  emails: string[];
};

export const APP_STATUSES = [
  "saved",
  "applied",
  "assessment",
  "interview",
  "offer",
  "rejected",
] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export type Application = {
  id: string;
  listingId: string | null;
  source: SourceId | "manual";
  title: string;
  company: string;
  logo: string | null;
  url: string;
  locationLabel: string;
  payLabel: string | null;
  status: AppStatus;
  notes: string;
  appliedOn: string | null;
  deadline: string | null;
  nextStepOn: string | null;
  nextStep: string;
  contact: string;
  history: { status: AppStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
};
