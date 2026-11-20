"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { callAi, requestAiConsent } from "@/lib/ai-client";
import type { JobExtract } from "@/lib/ai-types";
import { useAppStore, useHydrated } from "@/lib/store";
import type { AppStatus } from "@/lib/types";

type Ld = { t?: string; o?: string; l?: string; v?: string; s?: string; e?: string; d?: string };

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Pulls a readable place out of schema.org jobLocation JSON. */
function placeFrom(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const list = [].concat(JSON.parse(raw)) as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } }; name?: string }[];
    const names = list
      .map((x) => {
        const a = x?.address;
        if (!a) return x?.name ?? "";
        const country = typeof a.addressCountry === "string" ? a.addressCountry : a.addressCountry?.name;
        return [a.addressLocality, a.addressRegion, country].filter(Boolean).join(", ");
      })
      .filter(Boolean);
    return Array.from(new Set(names)).slice(0, 3).join(" · ");
  } catch {
    return "";
  }
}

function payFrom(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const s = JSON.parse(raw) as { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
    const v = s?.value;
    if (!v) return "";
    const amount = v.minValue && v.maxValue ? `${v.minValue.toLocaleString("en-IN")} – ${v.maxValue.toLocaleString("en-IN")}` : (v.value ?? v.minValue ?? v.maxValue)?.toLocaleString("en-IN");
    return amount ? `${s.currency === "INR" ? "₹" : `${s.currency ?? ""} `}${amount}${v.unitText ? ` per ${v.unitText.toLowerCase()}` : ""}` : "";
  } catch {
    return "";
  }
}

/** Strips " | LinkedIn", " - Naukri.com" and similar from page titles. */
const titleFrom = (t: string, site: string) =>
  clean(t.replace(new RegExp(`\\s*[|\\-–—]\\s*(${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|linkedin|naukri(\\.com)?|indeed|glassdoor|wellfound|internshala)\\s*$`, "i"), ""));

function SaveForm() {
  const addApplication = useAppStore((s) => s.addApplication);
  const applications = useAppStore((s) => s.applications);
  const cvs = useAppStore((s) => s.cvs);
  const mainCv = useAppStore((s) => s.profile?.cvId ?? null);

  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [ld] = useState<Ld>(() => {
    try {
      return JSON.parse(params.get("ld") || "{}") as Ld;
    } catch {
      return {};
    }
  });
  const site = params.get("site") ?? "";
  const pageText = clean(ld.d || params.get("text") || params.get("sel") || "");

  const [title, setTitle] = useState(clean(ld.t) || titleFrom(params.get("title") ?? "", site));
  const [company, setCompany] = useState(clean(ld.o));
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [location, setLocation] = useState(placeFrom(ld.l));
  const [pay, setPay] = useState(payFrom(ld.s));
  const [deadline, setDeadline] = useState(ld.v ? ld.v.slice(0, 10) : "");
  const [status, setStatus] = useState<AppStatus>("saved");
  const [cvId, setCvId] = useState<string | null>(mainCv);
  const [notes, setNotes] = useState(clean(params.get("sel") ?? ""));
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const autoRan = useRef(false);

  const existing = applications.find((a) => a.url && url && a.url.split("?")[0] === url.split("?")[0]);

  const fill = async () => {
    if (!(await requestAiConsent())) return;
    setBusy(true);
    setAiError(null);
    try {
      const x = await callAi<JobExtract>("job-extract", { page: `Page title: ${params.get("title") ?? ""}\nSite: ${site}\nURL: ${url}\n\n${pageText}`.slice(0, 6000) });
      setTitle((v) => v || x.title);
      setCompany((v) => v || x.company);
      setLocation((v) => v || x.location);
      setPay((v) => v || x.pay);
      setDeadline((v) => v || (/^\d{4}-\d{2}-\d{2}$/.test(x.deadline) ? x.deadline : ""));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not read the page.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // When the page had no structured job data and AI is already on, read it automatically.
    if (autoRan.current || !pageText || (title && company)) return;
    autoRan.current = true;
    if (!useAppStore.getState().aiConsent) return;
    const t = setTimeout(() => void fill(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (saved) {
    return (
      <div className="space-y-4 py-10 text-center">
        <span className="font-stamp mx-auto inline-block -rotate-6 rounded-md border-[3px] border-stamp px-4 py-2 text-2xl text-stamp">{status === "applied" ? "Applied" : "Saved"}</span>
        <p className="font-semibold">
          {title} · {company}
        </p>
        <p className="text-sm text-muted-foreground">It is in your tracker now.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => window.close()}>Close window</Button>
          <Button variant="outline" asChild>
            <Link href="/tracker">Open tracker</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !company.trim()) return;
        addApplication({
          title: title.trim(),
          company: company.trim(),
          url,
          locationLabel: location,
          payLabel: pay || null,
          deadline: deadline || null,
          notes,
          status,
          cvId: status === "saved" ? null : cvId,
        });
        setSaved(true);
      }}
    >
      {existing ? (
        <p className="rounded-lg bg-marigold-soft px-3 py-2 text-sm">
          This link is already in your tracker as <span className="font-semibold">{existing.title}</span>.
        </p>
      ) : null}
      {!title || !company ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-stamp/30 bg-stamp-soft/50 px-3 py-2">
          <span className="text-sm">{pageText ? "Some details are missing." : "Select the job text on the page and click the bookmark again for better results."}</span>
          {pageText ? (
            <Button type="button" size="sm" onClick={fill} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Fill with AI
            </Button>
          ) : null}
        </div>
      ) : null}
      {aiError ? <p className="text-sm text-destructive">{aiError}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor="s-title">Role</Label>
        <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="s-company">Company</Label>
          <Input id="s-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-location">Location</Label>
          <Input id="s-location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-pay">Stipend or salary</Label>
          <Input id="s-pay" value={pay} onChange={(e) => setPay(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-deadline">Deadline</Label>
          <Input id="s-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-url">Link</Label>
        <Input id="s-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {(["saved", "applied"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={`rounded-md border px-2 py-1.5 text-sm font-medium ${status === s ? "border-stamp bg-stamp-soft text-stamp" : "bg-card"}`}
              >
                {s === "saved" ? "Want to apply" : "Applied"}
              </button>
            ))}
          </div>
        </div>
        {status === "applied" && cvs.length ? (
          <div className="space-y-1.5">
            <Label htmlFor="s-cv">CV sent</Label>
            <Select value={cvId ?? cvs[0]!.id} onValueChange={setCvId}>
              <SelectTrigger id="s-cv" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cvs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-notes">Notes</Label>
        <Textarea id="s-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!title.trim() || !company.trim()}>
        <Check /> {status === "applied" ? "Save as applied" : "Save to tracker"}
      </Button>
    </form>
  );
}

export default function SavePage() {
  const hydrated = useHydrated();
  return (
    <div className="mx-auto max-w-md px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <Brand href="/tracker" />
        <span className="form-caption">Save to tracker</span>
      </div>
      {hydrated ? (
        <SaveForm />
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-24" />
        </div>
      )}
    </div>
  );
}
