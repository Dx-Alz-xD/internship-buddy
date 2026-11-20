"use client";

import { RequireProfile } from "@/components/require-profile";
import { CircleAlert, CircleCheck, Clock, KeyRound, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ListingCard } from "@/components/discover/listing-card";
import { ListingSheet } from "@/components/discover/listing-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { daysAgo, monthlyInr, rupees } from "@/lib/format";
import { type Match, scoreListing } from "@/lib/match";
import { riseIn } from "@/lib/motion";
import { useAppStore } from "@/lib/store";
import { getRole } from "@/lib/taxonomy";
import type { AppStatus, Listing, SourceId } from "@/lib/types";
import { SOURCES, type SourceState, useListings } from "@/lib/use-listings";
import { cn } from "@/lib/utils";

type Sort = "match" | "newest" | "pay";
type Mode = "all" | "remote" | "office";

const ago = (iso: string | null) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
};

function SourceChip({
  id,
  label,
  state,
  on,
  onToggle,
}: {
  id: SourceId;
  label: string;
  state: SourceState;
  on: boolean;
  onToggle: () => void;
}) {
  const r = state.result;
  const count = r?.listings.length ?? 0;
  const icon = state.loading ? (
    <Loader2 className="size-3.5 animate-spin" />
  ) : r?.status === "live" || r?.status === "cached" ? (
    <CircleCheck className="size-3.5 text-offer" />
  ) : r?.status === "stale" ? (
    <Clock className="size-3.5 text-marigold" />
  ) : r?.status === "missing-key" ? (
    <KeyRound className="size-3.5 text-muted-foreground" />
  ) : (
    <CircleAlert className="size-3.5 text-reject" />
  );
  const detail = state.loading
    ? `Asking ${label}…`
    : r?.message ??
      (r?.status === "live" ? `Fetched just now.` : r?.fetchedAt ? `Saved copy from ${ago(r.fetchedAt)}; refreshes automatically.` : "");
  const quota = r?.quota?.remaining != null ? ` ${r.quota.remaining}${r.quota.limit ? ` of ${r.quota.limit}` : ""} free calls left this month.` : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={on}
          onClick={onToggle}
          data-source={id}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            on ? "bg-card" : "bg-transparent text-muted-foreground line-through decoration-1 opacity-70",
          )}
        >
          {icon}
          {label}
          <span className="font-mono text-xs text-muted-foreground tabular">{state.loading ? "…" : count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {detail}
        {quota}
        <span className="mt-1 block opacity-70">Click to {on ? "hide" : "show"} {label} listings.</span>
      </TooltipContent>
    </Tooltip>
  );
}

function Discover() {
  const profile = useAppStore((s) => s.profile)!;
  const applications = useAppStore((s) => s.applications);
  const hidden = useAppStore((s) => s.hidden);
  const storedRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const trackListing = useAppStore((s) => s.trackListing);
  const hideListing = useAppStore((s) => s.hideListing);
  const unhideAll = useAppStore((s) => s.unhideAll);

  const roleId = storedRole && profile.roles.includes(storedRole) ? storedRole : profile.roles[0]!;
  const { sources, listings, loading, refresh } = useListings(profile, roleId);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>(profile.workMode === "remote" ? "remote" : "all");
  const [kind, setKind] = useState<"all" | "internship" | "job">("all");
  const [sort, setSort] = useState<Sort>("match");
  const [payOnly, setPayOnly] = useState(false);
  const [off, setOff] = useState<SourceId[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const statusByListing = useMemo(() => new Map(applications.filter((a) => a.listingId).map((a) => [a.listingId!, a.status])), [applications]);

  const scored = useMemo(() => {
    const hiddenSet = new Set(hidden);
    return listings.filter((l) => !hiddenSet.has(l.id)).map((l) => ({ listing: l, match: scoreListing(l, profile, roleId) }));
  }, [listings, hidden, profile, roleId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = scored.filter(({ listing: l }) => {
      if (off.includes(l.source)) return false;
      if (mode === "remote" && l.workMode !== "remote") return false;
      if (mode === "office" && l.workMode === "remote") return false;
      if (kind !== "all" && l.kind !== kind) return false;
      if (payOnly) {
        const m = monthlyInr(l.pay);
        if (m == null || m < profile.minStipend || m === 0) return false;
      }
      if (needle && !`${l.title} ${l.company} ${l.skills.join(" ")} ${l.locationLabel}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const posted = (l: Listing) => daysAgo(l.postedAt) ?? 999;
    out.sort((a, b) => {
      if (sort === "newest") return posted(a.listing) - posted(b.listing) || b.match.score - a.match.score;
      if (sort === "pay") return (monthlyInr(b.listing.pay) ?? -1) - (monthlyInr(a.listing.pay) ?? -1) || b.match.score - a.match.score;
      return b.match.score - a.match.score || posted(a.listing) - posted(b.listing);
    });
    return out;
  }, [scored, q, mode, kind, payOnly, off, sort, profile.minStipend]);

  // Cards rise in whenever the visible set changes.
  const grid = useRef<HTMLDivElement>(null);
  const visibleKey = visible.map((v) => v.listing.id).join(",");
  useEffect(() => {
    if (!grid.current) return;
    riseIn(grid.current.querySelectorAll('[data-animate="card"]'), { delay: 28 });
  }, [visibleKey]);

  const track = (l: Listing, status: AppStatus) => {
    trackListing(l, status);
    toast.success(status === "applied" ? `Marked as applied` : `Saved to your tracker`, {
      description: `${l.title} · ${l.company}`,
    });
  };

  const open = openId ? scored.find((s) => s.listing.id === openId) ?? null : null;
  const role = getRole(roleId);
  const where = profile.workMode === "remote" ? "remote" : profile.region === "abroad" ? "abroad" : profile.cities[0] ? `in ${profile.cities[0]}` : "across India";
  const strong = visible.filter((v) => v.match.score >= 70).length;
  const anyLoaded = SOURCES.some((s) => sources[s.id].result);
  const filtersActive = q || mode !== (profile.workMode === "remote" ? "remote" : "all") || kind !== "all" || payOnly || off.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="form-caption">Discover</div>
            <h1 className="font-display-wide mt-1 text-3xl leading-none font-extrabold sm:text-[2.6rem]">
              {role.label} <span className="text-muted-foreground">{where}</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {loading && !anyLoaded
                ? "Checking four job boards…"
                : `${visible.length} openings${strong ? `, ${strong} strong matches` : ""}${loading ? " · still loading some boards" : ""}`}
            </p>
          </div>
          <Button variant="outline" onClick={() => refresh("all")} disabled={loading}>
            <RefreshCw className={cn(loading && "animate-spin")} /> Check for new
          </Button>
        </div>

        {profile.roles.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Role">
            {profile.roles.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={r === roleId}
                onClick={() => setActiveRole(r)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  r === roleId ? "border-ink bg-ink text-background" : "bg-card hover:border-foreground/30",
                )}
              >
                {getRole(r).label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCES.map((s) => (
            <SourceChip
              key={s.id}
              id={s.id}
              label={s.label}
              state={sources[s.id]}
              on={!off.includes(s.id)}
              onToggle={() => setOff((o) => (o.includes(s.id) ? o.filter((x) => x !== s.id) : [...o, s.id]))}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title, company or skill" className="h-9 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0" aria-label="Filter listings" />
          </div>
          <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <SlidersHorizontal /> Filters
          </Button>
          <div className={cn("w-full flex-wrap items-center gap-2 sm:flex sm:w-auto", showFilters ? "flex" : "hidden")}>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger size="sm" aria-label="Work mode" className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any work mode</SelectItem>
                <SelectItem value="remote">Remote only</SelectItem>
                <SelectItem value="office">Office and hybrid</SelectItem>
              </SelectContent>
            </Select>
            {profile.wantsJobs ? (
              <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                <SelectTrigger size="sm" aria-label="Listing type" className="min-w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Internships and jobs</SelectItem>
                  <SelectItem value="internship">Internships</SelectItem>
                  <SelectItem value="job">Jobs</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger size="sm" aria-label="Sort" className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Best match</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="pay">Highest stipend</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 px-2 text-sm whitespace-nowrap">
              <Switch checked={payOnly} onCheckedChange={setPayOnly} size="sm" />
              {profile.minStipend ? `Pays ${rupees(profile.minStipend)}+` : "Paid only"}
            </label>
          </div>
        </div>
      </header>

      <section ref={grid} className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy={loading}>
        {visible.map(({ listing, match }) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            match={match}
            status={statusByListing.get(listing.id) ?? null}
            onOpen={() => setOpenId(listing.id)}
            onTrack={(s) => track(listing, s)}
            onHide={() => {
              hideListing(listing.id);
              toast("Listing hidden", { action: { label: "Show all hidden", onClick: unhideAll } });
            }}
          />
        ))}
        {loading && !visible.length
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-44 animate-pulse rounded-xl border bg-card/70" />)
          : null}
      </section>

      {!loading && !visible.length ? (
        <div className="mt-6 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <h2 className="font-display-wide text-xl font-extrabold">{scored.length ? "Nothing matches these filters" : "No openings came back for this search"}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {scored.length
              ? "Clear the filters to see everything that was found."
              : "Try another role from your list, add more cities, or switch work mode to Any on your profile."}
          </p>
          {filtersActive ? (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setQ("");
                setMode("all");
                setKind("all");
                setPayOnly(false);
                setOff([]);
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {hidden.length ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {hidden.length} hidden ·{" "}
          <button className="underline underline-offset-2 hover:text-foreground" onClick={unhideAll}>
            show them again
          </button>
        </p>
      ) : null}

      <ListingSheet
        listing={open?.listing ?? null}
        match={(open?.match as Match) ?? null}
        status={open ? (statusByListing.get(open.listing.id) ?? null) : null}
        onClose={() => setOpenId(null)}
        onTrack={(s) => open && track(open.listing, s)}
      />
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <RequireProfile>
      <Discover />
    </RequireProfile>
  );
}
