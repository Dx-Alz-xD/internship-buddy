"use client";

import { useState } from "react";
import { create } from "zustand";
import type { AiTask } from "./ai-types";
import { formatPay, rupees } from "./format";
import { useAppStore } from "./store";
import { COUNTRIES, getRole, YEARS } from "./taxonomy";
import type { CvVersion, Listing, ListingDetails, Profile } from "./types";

export class AiClientError extends Error {
  constructor(
    message: string,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}

export async function callAi<T>(task: AiTask, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/ai/${task}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiClientError("Could not reach the app server.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiClientError(data?.error ?? `AI request failed (${res.status}).`, data?.retryAfter ?? null);
  return data as T;
}

/* ------------------------------- consent ------------------------------- */

type ConsentState = { open: boolean; resolve: ((ok: boolean) => void) | null };
export const useConsentDialog = create<ConsentState>(() => ({ open: false, resolve: null }));

/** AI features send profile, CV and listing text to Groq. Ask once before the first one runs. */
export function requestAiConsent(): Promise<boolean> {
  if (useAppStore.getState().aiConsent) return Promise.resolve(true);
  return new Promise((resolve) => useConsentDialog.setState({ open: true, resolve }));
}

export function answerConsent(ok: boolean) {
  const { resolve } = useConsentDialog.getState();
  if (ok) useAppStore.getState().setAiConsent(true);
  useConsentDialog.setState({ open: false, resolve: null });
  resolve?.(ok);
}

/* ------------------------------- results hook ------------------------------- */

/**
 * Runs an AI task and keeps the answer in local storage under `key`, so reopening a listing
 * shows the earlier answer instead of spending another request.
 */
export function useAiResult<T>(key: string | null, task: AiTask) {
  const entry = useAppStore((s) => (key ? s.ai[key] : undefined));
  const saveAi = useAppStore((s) => s.saveAi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (body: Record<string, unknown> | (() => Promise<Record<string, unknown>>)) => {
    if (!(await requestAiConsent())) return null;
    setLoading(true);
    setError(null);
    try {
      const payload = typeof body === "function" ? await body() : body;
      const data = await callAi<T>(task, payload);
      if (key) saveAi(key, data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI request failed.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { data: entry?.data as T | undefined, at: entry?.at ?? null, loading, error, run };
}

/* ------------------------------- prompt material ------------------------------- */

export function profileBrief(p: Profile): string {
  const year = YEARS.find((y) => y.value === p.year)?.label ?? "";
  const x = p.extras;
  const lines = [
    `Name: ${p.name}`,
    `Studying: ${year}, ${p.degree} in ${p.branch} at ${p.college}, ${p.year === "grad" ? "graduated" : "graduating"} ${p.gradYear}${x?.cgpa ? ` (CGPA ${x.cgpa})` : ""}`,
    `Target roles: ${p.roles.map((r) => getRole(r).label).join(", ")}`,
    `Skills: ${p.skills.join(", ")}`,
  ];
  if (x?.projects.length) lines.push("Projects:", ...x.projects.map((pr) => `- ${pr.name}: ${pr.summary}${pr.skills.length ? ` [${pr.skills.join(", ")}]` : ""}`));
  if (x?.experience.length) lines.push("Experience:", ...x.experience.map((e) => `- ${e.role} at ${e.org}${e.period ? ` (${e.period})` : ""}: ${e.summary}`));
  if (x?.achievements.length) lines.push(`Achievements: ${x.achievements.join("; ")}`);
  const links = [p.links.github && `GitHub ${p.links.github}`, p.links.linkedin && `LinkedIn ${p.links.linkedin}`, p.links.portfolio && `Portfolio ${p.links.portfolio}`].filter(Boolean);
  if (links.length) lines.push(`Links: ${links.join(", ")}`);
  lines.push(
    `Looking for: ${{ remote: "remote", hybrid: "hybrid", onsite: "in-office", any: "any work mode" }[p.workMode]}; ${
      p.region === "abroad" ? COUNTRIES.find((c) => c.code === p.country)?.label : p.cities.join(", ") || "anywhere in India"
    }; ${p.minStipend ? `at least ${rupees(p.minStipend)}/month` : "any stipend"}${p.maxDuration ? `; up to ${p.maxDuration} months` : ""}${
      p.availableFrom ? `; available from ${p.availableFrom}` : ""
    }${p.partTime ? "; part-time is fine" : ""}${p.wantsJobs ? "; also open to full-time jobs" : ""}`,
  );
  return lines.join("\n");
}

export function listingBrief(l: Listing, d?: ListingDetails | null): string {
  const lines = [
    `Title: ${l.title}`,
    `Company: ${l.company}`,
    `Type: ${l.kind === "job" ? "full-time job" : "internship"}${l.partTime ? ", part-time" : ""}`,
    `Location: ${l.locationLabel} (${l.workMode})`,
    `${l.kind === "job" ? "Salary" : "Stipend"}: ${formatPay(l.pay) ?? "not listed"}`,
  ];
  if (l.duration) lines.push(`Duration: ${l.duration}`);
  if (d?.start) lines.push(`Start: ${d.start}`);
  if (d?.applyBy || l.deadline) lines.push(`Apply by: ${d?.applyBy ?? l.deadline?.slice(0, 10)}`);
  if (l.skills.length) lines.push(`Skills listed: ${l.skills.join(", ")}`);
  if (d?.whoCanApply.length) lines.push(`Who can apply: ${d.whoCanApply.join("; ")}`);
  if (d?.requirements) lines.push(`Other requirements: ${d.requirements.slice(0, 400)}`);
  if (d?.perks.length) lines.push(`Perks: ${d.perks.join(", ")}`);
  if (l.tags.length) lines.push(`Notes: ${l.tags.join("; ")}`);
  if (d?.openings) lines.push(`Openings: ${d.openings}`);
  return lines.join("\n");
}

export const listingDescription = (l: Listing, d?: ListingDetails | null) => d?.description ?? l.description ?? l.summary ?? "";

export const cvExcerpt = (cv: CvVersion | null) => (cv?.text ?? "").slice(0, 5000);
