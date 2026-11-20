"use client";

import { Check, CircleHelp, Copy, Loader2, RefreshCw, ShieldAlert, Sparkles, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cvExcerpt, listingBrief, listingDescription, profileBrief, useAiResult } from "@/lib/ai-client";
import type { FitCheck, WriteKind, WriteResult } from "@/lib/ai-types";
import { canonicalSkill } from "@/lib/skills";
import { primaryCv, useAppStore } from "@/lib/store";
import { hasDetails } from "@/lib/use-details";
import type { Listing, ListingDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICT = {
  strong: { stamp: "Apply now", color: "var(--offer)" },
  good: { stamp: "Good fit", color: "var(--stamp)" },
  stretch: { stamp: "Stretch", color: "var(--marigold)" },
  poor: { stamp: "Skip", color: "var(--reject)" },
} as const;

export function FitPanel({
  listing,
  details,
  ensureDetails,
}: {
  listing: Listing;
  details: ListingDetails | null;
  ensureDetails: () => Promise<ListingDetails | null>;
}) {
  const profile = useAppStore((s) => s.profile)!;
  const fit = useAiResult<FitCheck>(`fit:${listing.id}`, "fit");
  const r = fit.data;

  const run = () =>
    fit.run(async () => {
      const d = details ?? (hasDetails(listing) ? await ensureDetails() : null);
      return { profile: profileBrief(profile), listing: listingBrief(listing, d), description: listingDescription(listing, d) };
    });

  if (!r) {
    return (
      <div className="rounded-xl border border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-stamp" /> AI fit check
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Reads the full listing against your profile: what you meet, what you miss, eligibility rules and warning signs.
            </p>
          </div>
          <Button onClick={run} disabled={fit.loading}>
            {fit.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} Check my fit
          </Button>
        </div>
        {fit.error ? <p className="mt-2 text-sm text-destructive">{fit.error}</p> : null}
      </div>
    );
  }

  const v = VERDICT[r.verdict];
  // Models occasionally list a skill the student has as missing; the profile is the source of truth.
  const mine = new Set(profile.skills.map((s) => canonicalSkill(s).toLowerCase()));
  const gaps = r.gaps.filter((g) => !mine.has(canonicalSkill(g.replace(/s*(.*)s*$/, "")).toLowerCase()));
  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Stamp size="md" color={v.color}>
          {v.stamp}
        </Stamp>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.headline}</p>
          <p className="text-xs text-muted-foreground">AI fit check</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={run} disabled={fit.loading} aria-label="Check again">
          {fit.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>

      {r.scamRisk !== "low" ? (
        <div className={cn("flex gap-2 rounded-lg p-3 text-sm", r.scamRisk === "high" ? "bg-reject/10 text-reject" : "bg-marigold-soft")}>
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">{r.scamRisk === "high" ? "High scam risk. Do not pay anything." : "Some warning signs"}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {r.scamReasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {r.meets.length ? (
          <div>
            <div className="form-caption mb-1">You have</div>
            <ul className="space-y-1 text-sm">
              {r.meets.map((m) => (
                <li key={m} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-offer" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {gaps.length ? (
          <div>
            <div className="form-caption mb-1">Missing</div>
            <ul className="space-y-1 text-sm">
              {gaps.map((m) => (
                <li key={m} className="flex gap-2">
                  <X className="mt-0.5 size-4 shrink-0 text-reject" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {r.eligibility.length ? (
        <div>
          <div className="form-caption mb-1">Eligibility</div>
          <ul className="divide-y rounded-lg border text-sm">
            {r.eligibility.map((e) => (
              <li key={e.rule} className="flex items-start gap-2 px-3 py-2">
                {e.status === "ok" ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-offer" />
                ) : e.status === "fail" ? (
                  <X className="mt-0.5 size-4 shrink-0 text-reject" />
                ) : (
                  <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span>{e.rule}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.redFlags.length ? (
        <div>
          <div className="form-caption mb-1">Worth knowing</div>
          <ul className="space-y-1 text-sm">
            {r.redFlags.map((m) => (
              <li key={m} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-marigold" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.tips.length ? (
        <div className="rounded-lg bg-stamp-soft/60 p-3">
          <div className="form-caption mb-1">When you apply, highlight</div>
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {r.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {fit.error ? <p className="text-sm text-destructive">{fit.error}</p> : null}
    </section>
  );
}

const KIND_LABEL: Record<WriteKind, string> = {
  internshala: "Application answers",
  cover: "Cover letter",
  email: "Email to recruiter",
  linkedin: "LinkedIn note",
  followup: "Follow-up email",
};

function CopyBox({ label, value, onChange, rows = 8, limit }: { label: string; value: string; onChange: (v: string) => void; rows?: number; limit?: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="form-caption">{label}</span>
        <span className="flex items-center gap-2">
          <span className={cn("font-mono text-[0.68rem] tabular", limit && value.length > limit ? "text-destructive" : "text-muted-foreground")}>
            {limit ? `${value.length}/${limit}` : `${value.trim().split(/\s+/).filter(Boolean).length} words`}
          </span>
          <Button variant="ghost" size="xs" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success("Copied"))}>
            <Copy /> Copy
          </Button>
        </span>
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-sm leading-relaxed" />
    </div>
  );
}

/** Drafts application text from the student's real profile and CV; everything stays editable. */
export function WritePanel({
  cacheId,
  listing,
  description,
  kinds,
  ensureDescription,
}: {
  cacheId: string;
  listing: string;
  description: string;
  kinds: WriteKind[];
  ensureDescription?: () => Promise<string>;
}) {
  const profile = useAppStore((s) => s.profile)!;
  const cv = useAppStore(primaryCv);
  const [kind, setKind] = useState<WriteKind>(kinds[0]!);
  const [note, setNote] = useState("");
  const key = `write:${kind}:${cacheId}`;
  const w = useAiResult<WriteResult>(key, "write");
  // Edits belong to one generated answer; a new answer (or another tab) starts from the AI text again.
  const [edits, setEdits] = useState<{ key: string; at: string | null; value: WriteResult } | null>(null);
  const draft = edits && edits.key === key && edits.at === w.at ? edits.value : (w.data ?? null);
  const setDraft = (value: WriteResult) => setEdits({ key, at: w.at, value });

  const generate = () =>
    w.run(async () => ({
      kind,
      profile: profileBrief(profile),
      cv: cvExcerpt(cv),
      listing,
      description: ensureDescription ? await ensureDescription() : description,
      note,
    }));

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-stamp" /> Write with AI
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What to write">
        {kinds.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === kind}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              k === kind ? "border-ink bg-ink text-background" : "bg-card hover:border-foreground/30",
            )}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to mention? e.g. my hackathon win" aria-label="Extra instructions" className="h-9" />
        <Button onClick={generate} disabled={w.loading} className="h-9 shrink-0">
          {w.loading ? <Loader2 className="animate-spin" /> : draft ? <RefreshCw /> : <Sparkles />}
          {draft ? "Rewrite" : "Write"}
        </Button>
      </div>
      {w.error ? <p className="text-sm text-destructive">{w.error}</p> : null}
      {!cv ? <p className="text-xs text-muted-foreground">Tip: add your CV on the profile page for more specific writing.</p> : null}

      {draft ? (
        <div className="space-y-3">
          {draft.subject ? <CopyBox label="Subject" value={draft.subject} onChange={(subject) => setDraft({ ...draft, subject })} rows={1} /> : null}
          <CopyBox
            label={kind === "internshala" ? "Why should you be hired for this role?" : KIND_LABEL[kind]}
            value={draft.body}
            onChange={(body) => setDraft({ ...draft, body })}
            rows={kind === "linkedin" ? 4 : 9}
            limit={kind === "linkedin" ? 300 : undefined}
          />
          {draft.extra ? <CopyBox label="Confirm your availability" value={draft.extra} onChange={(extra) => setDraft({ ...draft, extra })} rows={3} /> : null}
          <p className="text-xs text-muted-foreground">Read it before you send it. The AI only uses facts from your profile and CV, but check every claim.</p>
        </div>
      ) : null}
    </section>
  );
}
