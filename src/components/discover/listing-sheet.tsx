"use client";

import { Bookmark, Check, ExternalLink, Send, TriangleAlert } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { MatchMeter, sourceLabel } from "@/components/discover/listing-card";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dueText, formatPay, postedText, shortDate } from "@/lib/format";
import type { Match } from "@/lib/match";
import { STATUS_META } from "@/lib/taxonomy";
import type { AppStatus, Listing } from "@/lib/types";
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
  const matched = new Set(match?.matchedSkills.map((s) => s.toLowerCase()) ?? []);
  const workMode = listing ? { remote: "Remote", hybrid: "Hybrid", onsite: "In office", unknown: null }[listing.workMode] : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        {listing && match ? (
          <>
            <SheetHeader className="border-b p-5 pr-12">
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
            </SheetHeader>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 p-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Row label="Location" value={[listing.locationLabel, workMode && !listing.locationLabel.toLowerCase().includes(workMode.toLowerCase()) ? workMode : null].filter(Boolean).join(" · ")} />
                  <Row label={listing.kind === "job" ? "Salary" : "Stipend"} value={formatPay(listing.pay) ?? "Not listed"} />
                  <Row label="Duration" value={listing.duration} />
                  <Row label="Type" value={`${listing.kind === "job" ? "Full-time job" : "Internship"}${listing.partTime ? ", part-time" : ""}`} />
                  <Row label="Posted" value={postedText(listing.postedLabel, listing.postedAt)?.replace("Posted ", "")} />
                  <Row label="Applications close" value={listing.deadline ? `${shortDate(listing.deadline)} (${dueText(listing.deadline.slice(0, 10))})` : null} />
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

                {listing.tags.length ? (
                  <section className="flex flex-wrap gap-1.5">
                    {listing.tags.map((t) => (
                      <span key={t} className="rounded-full border border-marigold/50 bg-marigold-soft px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {t}
                      </span>
                    ))}
                  </section>
                ) : null}

                <section className="space-y-2">
                  <div className="form-caption">About the role</div>
                  {listing.description ? (
                    <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{listing.description}</div>
                  ) : listing.summary ? (
                    <p className="text-sm leading-relaxed">{listing.summary}</p>
                  ) : null}
                  {!listing.description ? (
                    <p className="text-sm text-muted-foreground">The full description, eligibility and questions are on {listing.publisher ?? sourceLabel(listing.source)}.</p>
                  ) : null}
                </section>
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
