"use client";

import { Bookmark, Check, ExternalLink, FileText, Loader2, Send, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { FitPanel, WritePanel } from "@/components/ai-panels";
import { CompanyLogo } from "@/components/company-logo";
import { MatchMeter, sourceLabel } from "@/components/discover/listing-card";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listingBrief, listingDescription } from "@/lib/ai-client";
import { dueText, formatPay, postedText, shortDate } from "@/lib/format";
import type { Match } from "@/lib/match";
import { scamSignals } from "@/lib/scam";
import { STATUS_META } from "@/lib/taxonomy";
import type { AppStatus, Listing } from "@/lib/types";
import { hasDetails, useListingDetails } from "@/lib/use-details";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="form-caption">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

type Tab = "overview" | "fit" | "write";

export function ListingSheet({
  listing,
  match,
  status,
  onClose,
  onTrack,
}: {
  listing: Listing | null;
  match: Match | null;
  status: AppStatus | null;
  onClose: () => void;
  onTrack: (s: AppStatus) => void;
}) {
  const open = !!listing && !!match;
  const [tab, setTab] = useState<Tab>("overview");
  const { details, loading, error, load } = useListingDetails(listing);
  const matched = new Set(match?.matchedSkills.map((s) => s.toLowerCase()) ?? []);
  const workMode = listing ? { remote: "Remote", hybrid: "Hybrid", onsite: "In office", unknown: null }[listing.workMode] : null;
  const scam = listing ? scamSignals(listing, details) : null;
  const description = listing ? listingDescription(listing, details) : "";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setTab("overview");
        }
      }}
    >
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        {listing && match ? (
          <>
            <SheetHeader className="border-b p-5 pr-12 pb-0">
              <div className="flex items-start gap-3">
                <CompanyLogo src={listing.logo} name={listing.company} className="size-12" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-display-wide text-xl leading-tight font-extrabold">{listing.title}</SheetTitle>
                  <SheetDescription className="mt-0.5">{listing.company}</SheetDescription>
                </div>
                {status ? (
                  <Stamp size="md" color={STATUS_META[status].color}>
                    {STATUS_META[status].stamp}
                  </Stamp>
                ) : null}
              </div>
              <div className="-mb-px mt-3 flex gap-1" role="tablist" aria-label="Listing sections">
                {(
                  [
                    ["overview", "Overview"],
                    ["fit", "Fit check"],
                    ["write", "Write application"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:bg-muted",
                      tab === id ? "border-stamp text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 p-5">
                {scam && scam.level !== "none" ? (
                  <div className={cn("flex gap-2 rounded-lg p-3 text-sm", scam.level === "high" ? "bg-reject/10 text-reject" : "bg-marigold-soft")}>
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">{scam.level === "high" ? "Possible scam. Never pay to get an internship." : "Check this one before applying"}</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {scam.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {tab === "overview" ? (
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Row label="Location" value={[listing.locationLabel, workMode && !listing.locationLabel.toLowerCase().includes(workMode.toLowerCase()) ? workMode : null].filter(Boolean).join(" · ")} />
                      <Row label={listing.kind === "job" ? "Salary" : "Stipend"} value={formatPay(listing.pay) ?? "Not listed"} />
                      <Row label="Duration" value={listing.duration} />
                      <Row label="Starts" value={details?.start} />
                      <Row label="Type" value={`${listing.kind === "job" ? "Full-time job" : "Internship"}${listing.partTime ? ", part-time" : ""}`} />
                      <Row label="Posted" value={postedText(listing.postedLabel, listing.postedAt)?.replace("Posted ", "")} />
                      <Row
                        label="Applications close"
                        value={(details?.applyBy ?? listing.deadline) ? `${shortDate(details?.applyBy ?? listing.deadline)} (${dueText((details?.applyBy ?? listing.deadline)!.slice(0, 10))})` : null}
                      />
                      <Row label="Openings" value={details?.openings ? String(details.openings) : null} />
                      <Row label="Applicants" value={details?.applicants ? String(details.applicants) : null} />
                      <Row
                        label="Found on"
                        value={[sourceLabel(listing.source), ...(listing.alsoOn ?? []).map(sourceLabel)].join(", ") + (listing.publisher && listing.source === "jsearch" ? ` (via ${listing.publisher})` : "")}
                      />
                    </div>

                    <section className="rounded-xl border bg-secondary/40 p-4">
                      <div className="flex items-center gap-3">
                        <MatchMeter score={match.score} size={52} />
                        <div>
                          <div className="font-semibold">{match.score >= 70 ? "Strong match" : match.score >= 45 ? "Worth a look" : "Weak match"}</div>
                          <div className="text-xs text-muted-foreground">Based on your role, skills, location and stipend answers</div>
                        </div>
                      </div>
                      {match.reasons.length || match.warnings.length ? (
                        <ul className="mt-3 space-y-1.5 text-sm">
                          {match.reasons.map((r) => (
                            <li key={r} className="flex gap-2">
                              <Check className="mt-0.5 size-4 shrink-0 text-offer" />
                              {r}
                            </li>
                          ))}
                          {match.warnings.map((w) => (
                            <li key={w} className="flex gap-2 text-reject">
                              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>

                    {listing.skills.length ? (
                      <section className="space-y-2">
                        <div className="form-caption">Skills asked for</div>
                        <div className="flex flex-wrap gap-1.5">
                          {listing.skills.map((s) => (
                            <span key={s} className={cn("rounded px-2 py-0.5 text-sm", matched.has(s.toLowerCase()) ? "bg-stamp-soft font-medium text-stamp" : "bg-secondary")}>
                              {matched.has(s.toLowerCase()) ? "✓ " : ""}
                              {s}
                            </span>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {listing.tags.length || details?.perks.length ? (
                      <section className="flex flex-wrap gap-1.5">
                        {[...listing.tags, ...(details?.perks ?? [])].map((t) => (
                          <span key={t} className="rounded-full border border-marigold/50 bg-marigold-soft px-2.5 py-0.5 text-xs font-medium text-foreground">
                            {t}
                          </span>
                        ))}
                      </section>
                    ) : null}

                    {details?.whoCanApply.length ? (
                      <section className="space-y-2">
                        <div className="form-caption">Who can apply</div>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm">
                          {details.whoCanApply.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    <section className="space-y-2">
                      <div className="form-caption">About the role</div>
                      {loading ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Loading the full description…
                        </p>
                      ) : description ? (
                        <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{description}</div>
                      ) : null}
                      {!details && hasDetails(listing) && !loading ? (
                        <Button variant="outline" size="sm" onClick={() => load()}>
                          <FileText /> Load full description
                          {listing.source === "linkedin" ? <span className="text-xs text-muted-foreground">(uses 1 free LinkedIn call)</span> : null}
                        </Button>
                      ) : null}
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                      {!hasDetails(listing) && !listing.description ? (
                        <p className="text-sm text-muted-foreground">The full description is on {listing.publisher ?? sourceLabel(listing.source)}.</p>
                      ) : null}
                    </section>
                  </>
                ) : null}

                {tab === "fit" ? <FitPanel listing={listing} details={details} ensureDetails={load} /> : null}

                {tab === "write" ? (
                  <WritePanel
                    cacheId={listing.id}
                    listing={listingBrief(listing, details)}
                    description={description}
                    ensureDescription={async () => listingDescription(listing, details ?? (hasDetails(listing) ? await load() : null))}
                    kinds={["internshala", "cover", "email", "linkedin"]}
                  />
                ) : null}
              </div>
            </ScrollArea>

            <div className="flex flex-wrap items-center gap-2 border-t p-4">
              <Button asChild size="lg" className="px-4">
                <a href={listing.url} target="_blank" rel="noopener noreferrer">
                  Open on {listing.publisher ?? sourceLabel(listing.source)} <ExternalLink />
                </a>
              </Button>
              {!status || status === "saved" ? (
                <Button variant="outline" size="lg" onClick={() => onTrack("applied")}>
                  <Send /> I applied
                </Button>
              ) : null}
              {!status ? (
                <Button variant="ghost" size="lg" onClick={() => onTrack("saved")}>
                  <Bookmark /> Save
                </Button>
              ) : (
                <span className="ml-auto text-sm text-muted-foreground">In your tracker as {STATUS_META[status].label.toLowerCase()}</span>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
