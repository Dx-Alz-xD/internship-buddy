"use client";

import { Banknote, Bookmark, BookmarkCheck, CalendarClock, Clock3, EyeOff, MapPin, Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dueText, formatPay, postedText } from "@/lib/format";
import type { Match } from "@/lib/match";
import { slamStamp } from "@/lib/motion";
import { STATUS_META } from "@/lib/taxonomy";
import type { AppStatus, Listing } from "@/lib/types";
import { SOURCES } from "@/lib/use-listings";
import { cn } from "@/lib/utils";

export const sourceLabel = (id: string) => SOURCES.find((s) => s.id === id)?.label ?? id;

export function MatchMeter({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 70 ? "var(--marigold)" : score >= 45 ? "var(--stamp)" : "var(--muted-foreground)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.72rem] font-semibold tabular">{score}</span>
    </div>
  );
}

export function ListingCard({
  listing,
  match,
  status,
  onOpen,
  onTrack,
  onHide,
}: {
  listing: Listing;
  match: Match;
  status: AppStatus | null;
  onOpen: () => void;
  onTrack: (s: AppStatus) => void;
  onHide: () => void;
}) {
  const card = useRef<HTMLElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const prev = useRef(status);

  useEffect(() => {
    if (status && status !== prev.current && stamp.current) slamStamp(stamp.current, card.current);
    prev.current = status;
  }, [status]);

  const pay = formatPay(listing.pay);
  const posted = postedText(listing.postedLabel, listing.postedAt);
  const due = listing.deadline ? dueText(listing.deadline.slice(0, 10)) : null;
  const matched = new Set(match.matchedSkills.map((s) => s.toLowerCase()));
  const skills = [...listing.skills].sort((a, b) => Number(matched.has(b.toLowerCase())) - Number(matched.has(a.toLowerCase()))).slice(0, 6);

  return (
    <article
      ref={card}
      data-animate="card"
      className="group relative flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 opacity-0 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-[0_8px_24px_-14px_rgba(24,32,58,0.35)]"
    >
      <div className="flex items-start gap-3">
        <CompanyLogo src={listing.logo} name={listing.company} />
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-semibold">
            <button
              type="button"
              onClick={onOpen}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
            >
              {listing.title}
            </button>
          </h3>
          <p className="truncate text-sm text-muted-foreground">{listing.company}</p>
        </div>
        {status ? (
          <Stamp ref={stamp} size="sm" color={STATUS_META[status].color} className="mt-1">
            {STATUS_META[status].stamp}
          </Stamp>
        ) : (
          <MatchMeter score={match.score} />
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          <span className="max-w-[16rem] truncate">{listing.locationLabel}</span>
        </span>
        {pay ? (
          <span className="inline-flex items-center gap-1 text-foreground">
            <Banknote className="size-3.5 text-muted-foreground" />
            {pay}
          </span>
        ) : null}
        {listing.duration ? (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {listing.duration}
          </span>
        ) : null}
        {due ? (
          <span className="inline-flex items-center gap-1 text-reject">
            <CalendarClock className="size-3.5" />
            Closes {due}
          </span>
        ) : null}
      </div>

      {skills.length ? (
        <div className="flex flex-wrap gap-1">
          {skills.map((s) => (
            <span
              key={s}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                matched.has(s.toLowerCase()) ? "bg-stamp-soft font-medium text-stamp" : "bg-secondary text-secondary-foreground",
              )}
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {match.reasons.length || match.warnings.length ? (
        <p className="text-xs leading-relaxed">
          {match.reasons.slice(0, 3).map((r, i) => (
            <span key={r} className="text-foreground/80">
              {i > 0 ? " · " : ""}
              {r}
            </span>
          ))}
          {match.warnings.slice(0, 2).map((w, i) => (
            <span key={w} className="text-reject">
              {match.reasons.length || i > 0 ? " · " : ""}
              {w}
            </span>
          ))}
        </p>
      ) : null}

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[0.68rem] text-muted-foreground">
          <span className="truncate">
            {sourceLabel(listing.source)}
            {listing.alsoOn?.length ? ` +${listing.alsoOn.length}` : ""}
            {listing.publisher && listing.source === "jsearch" ? ` · via ${listing.publisher}` : ""}
            {posted ? ` · ${posted.replace("Posted ", "")}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onHide} aria-label="Hide this listing">
                <EyeOff />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide this listing</TooltipContent>
          </Tooltip>
          {status ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onTrack("saved")} aria-label="Save to tracker">
                  <Bookmark />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to tracker</TooltipContent>
            </Tooltip>
          )}
          {status === "saved" ? (
            <Button variant="ghost" size="icon-sm" disabled aria-label="Saved">
              <BookmarkCheck className="text-stamp" />
            </Button>
          ) : null}
          {!status || status === "saved" ? (
            <Button variant="outline" size="sm" onClick={() => onTrack("applied")}>
              <Send /> I applied
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
