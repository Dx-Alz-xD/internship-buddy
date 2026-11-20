import type { StudyYear } from "./types";

export type AiTask = "cv-extract" | "fit" | "write" | "cv-review" | "skill-plan" | "search" | "job-extract";

export type CvExtract = {
  name: string;
  college: string;
  collegeCity: string;
  degree: string;
  branch: string;
  gradYear: number | null;
  currentYear: StudyYear | "unknown";
  cgpa: string;
  skills: string[];
  projects: { name: string; summary: string; skills: string[] }[];
  experience: { role: string; org: string; period: string; summary: string }[];
  achievements: string[];
  suggestedRoles: string[];
  links: { linkedin: string; github: string; portfolio: string };
};

export type FitCheck = {
  verdict: "strong" | "good" | "stretch" | "poor";
  headline: string;
  meets: string[];
  gaps: string[];
  eligibility: { rule: string; status: "ok" | "fail" | "unclear" }[];
  redFlags: string[];
  scamRisk: "low" | "medium" | "high";
  scamReasons: string[];
  tips: string[];
  /** Set by the server when the listing text tried to instruct the AI. */
  injection?: boolean;
};

export type WriteKind = "internshala" | "cover" | "email" | "linkedin" | "followup";
export type WriteResult = { subject: string; body: string; extra: string };

export type CvReview = {
  score: number;
  verdict: string;
  strengths: string[];
  missingKeywords: string[];
  rewrites: { before: string; after: string; why: string }[];
  addSections: string[];
  fixes: string[];
};

export type SkillPlan = {
  summary: string;
  items: {
    skill: string;
    why: string;
    hours: number;
    steps: string[];
    project: string;
    resources: { title: string; kind: "docs" | "course" | "video" | "practice"; query: string }[];
  }[];
};

export type SearchParse = {
  roleId: string;
  customRole: string;
  workMode: "remote" | "onsite" | "hybrid" | "any";
  city: string;
  minStipend: number;
  kind: "internship" | "job" | "any";
  keywords: string[];
  sort: "match" | "newest" | "pay";
  summary: string;
};

export type JobExtract = {
  title: string;
  company: string;
  location: string;
  pay: string;
  deadline: string;
  kind: "internship" | "job";
  skills: string[];
};
