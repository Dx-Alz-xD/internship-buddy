"use client";

import { ExternalLink, Loader2, Sparkles, Table2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireProfile } from "@/components/require-profile";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiResult } from "@/lib/ai-client";
import type { SkillPlan } from "@/lib/ai-types";
import { shortDate } from "@/lib/format";
import { scoreListing } from "@/lib/match";
import { canonicalSkill } from "@/lib/skills";
import { useAppStore } from "@/lib/store";
import { getRole } from "@/lib/taxonomy";
import type { Application, AppStatus } from "@/lib/types";
import { SOURCES, useListings } from "@/lib/use-listings";
import { cn } from "@/lib/utils";

const RESPONDED: AppStatus[] = ["assessment", "interview", "offer", "rejected"];
const DAY = 864e5;

const everApplied = (a: Application) => a.status !== "saved" || a.history.some((h) => h.status !== "saved");
const heardBack = (a: Application) => a.history.some((h) => RESPONDED.includes(h.status));
const interviewed = (a: Application) => a.history.some((h) => h.status === "interview" || h.status === "offer");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Days between applying and the first reply of any kind. */
function daysToReply(a: Application): number | null {
  const appliedAt = a.history.find((h) => h.status === "applied")?.at ?? (a.appliedOn ? `${a.appliedOn}T00:00:00` : null);
  const reply = a.history.find((h) => RESPONDED.includes(h.status))?.at;
  if (!appliedAt || !reply) return null;
  return Math.max(0, Math.round((Date.parse(reply) - Date.parse(appliedAt)) / DAY));
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="form-caption">{label}</div>
      <div className="mt-1 font-display-wide text-3xl font-extrabold tabular">{value}</div>
      {hint ? <div className="truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Card({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display-wide text-lg font-extrabold">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A row of a bar-in-table: label, a thin bar from a shared baseline, then the numbers as text. */
function BarRow({ label, value, max, text, sub }: { label: React.ReactNode; value: number; max: number; text: string; sub?: string }) {
  const w = max ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 py-1.5 text-sm">
      <span className="truncate">{label}</span>
      <span className="relative h-3" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-bar" style={{ width: `${Math.max(w, value ? 1.5 : 0)}%` }} />
      </span>
      <span className="text-right font-mono text-xs tabular">
        {text}
        {sub ? <span className="ml-1.5 text-muted-foreground">{sub}</span> : null}
      </span>
    </div>
  );
}

function WeeklyChart({ apps }: { apps: Application[] }) {
  const [table, setTable] = useState(false);
  const weeks = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
    const out = Array.from({ length: 12 }, (_, i) => {
      const from = new Date(start.getTime() - (11 - i) * 7 * DAY);
      return { from, count: 0 };
    });
    for (const a of apps) {
      if (!everApplied(a) || !a.appliedOn) continue;
      const t = Date.parse(`${a.appliedOn}T00:00:00`);
      const idx = out.findIndex((w, i) => t >= w.from.getTime() && (i === 11 || t < out[i + 1]!.from.getTime()));
      if (idx !== -1) out[idx]!.count++;
    }
    return out;
  }, [apps]);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const peak = weeks.reduce((best, w, i) => (w.count > weeks[best]!.count ? i : best), 0);
  const H = 140;

  return (
    <Card
      title="Applications per week"
      hint="By the date you applied, last 12 weeks."
      action={
        <Button variant="ghost" size="xs" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          <Table2 /> {table ? "Chart" : "Table"}
        </Button>
      }
    >
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="form-caption py-1 font-normal">Week of</th>
              <th className="form-caption py-1 text-right font-normal">Applications</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.from.toISOString()} className="border-t">
                <td className="py-1">{shortDate(w.from.toISOString())}</td>
                <td className="py-1 text-right font-mono tabular">{w.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <div className="relative flex items-end gap-[2px] border-b border-chart-grid" style={{ height: H }}>
            {weeks.map((w, i) => {
              const h = (w.count / max) * (H - 22);
              return (
                <Tooltip key={w.from.toISOString()}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group relative flex h-full flex-1 items-end justify-center outline-none focus-visible:bg-secondary"
                      aria-label={`Week of ${shortDate(w.from.toISOString())}: ${w.count} applications`}
                    >
                      <span className="w-full max-w-6 rounded-t-[4px] bg-chart-bar transition-opacity group-hover:opacity-80" style={{ height: w.count ? Math.max(h, 3) : 0 }} />
                      {i === peak && w.count ? (
                        <span className="absolute font-mono text-[0.68rem] text-muted-foreground tabular" style={{ bottom: h + 4 }}>
                          {w.count}
                        </span>
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Week of {shortDate(w.from.toISOString())}: <span className="font-semibold">{w.count}</span> {w.count === 1 ? "application" : "applications"}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[2px] font-mono text-[0.65rem] text-muted-foreground">
            {weeks.map((w, i) => (
              <span key={i} className="flex-1 text-center">
                {i % 3 === 0 || i === 11 ? shortDate(w.from.toISOString()) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const searchUrl = (kind: string, q: string) =>
  kind === "video" ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` : `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function SkillGap() {
  const profile = useAppStore((s) => s.profile)!;
  const [roleId, setRoleId] = useState(profile.roles[0]!);
  const [hours, setHours] = useState("8");
  const { listings, loading } = useListings(profile, roleId);
  const role = getRole(roleId);

  const gaps = useMemo(() => {
    const mine = new Set(profile.skills.map((s) => canonicalSkill(s).toLowerCase()));
    // Only listings that are actually for this role, so unrelated openings do not suggest unrelated skills.
    const titled = listings.filter((l) => l.source !== "programs" && role.keywords.some((k) => l.title.toLowerCase().includes(k)));
    const relevant = titled.length >= 8 ? titled : listings.filter((l) => l.source !== "programs" && scoreListing(l, profile, roleId).score >= 55);
    const counts = new Map<string, number>();
    for (const l of relevant) {
      for (const s of new Set(l.skills.map(canonicalSkill))) {
        if (!mine.has(s.toLowerCase())) counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return {
      total: relevant.length,
      top: Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    };
  }, [listings, profile, roleId, role]);

  const plan = useAiResult<SkillPlan>(`skill-plan:${roleId}:${hours}:${gaps.top.map(([s]) => s).join(",")}`, "skill-plan");
  const max = gaps.top[0]?.[1] ?? 1;

  return (
    <Card
      title="Skills to learn next"
      hint={`Skills that ${role.label} listings ask for that are not on your profile, from ${gaps.total} relevant listings.`}
      action={
        profile.roles.length > 1 ? (
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger size="sm" className="min-w-44" aria-label="Role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profile.roles.map((id) => (
                <SelectItem key={id} value={id}>
                  {getRole(id).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      {loading && !gaps.total ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading current listings…
        </p>
      ) : gaps.top.length ? (
        <div className="space-y-5">
          <div>
            {gaps.top.map(([skill, n]) => (
              <BarRow key={skill} label={skill} value={n} max={max} text={`${n}`} sub={`${Math.round((n / gaps.total) * 100)}%`} />
            ))}
            <p className="mt-1 text-xs text-muted-foreground">Count of listings asking for the skill, and the share of relevant listings.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stamp/30 bg-stamp-soft/50 p-3">
            <Sparkles className="size-4 text-stamp" />
            <span className="text-sm font-medium">Learning plan with free resources</span>
            <span className="ml-auto flex items-center gap-2 text-sm">
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger size="sm" className="w-32" aria-label="Hours per week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["4", "8", "12", "20"].map((h) => (
                    <SelectItem key={h} value={h}>
                      {h} hours/week
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={plan.loading}
                onClick={() =>
                  plan.run({
                    role: role.label,
                    have: profile.skills.join(", "),
                    gaps: gaps.top.map(([s, n]) => `${s}: ${n} of ${gaps.total}`).join("; "),
                    hoursPerWeek: Number(hours),
                  })
                }
              >
                {plan.loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {plan.data ? "Make a new plan" : "Make my plan"}
              </Button>
            </span>
          </div>
          {plan.error ? <p className="text-sm text-destructive">{plan.error}</p> : null}

          {plan.data ? (
            <div className="space-y-3">
              <p className="text-sm">{plan.data.summary}</p>
              <ol className="grid gap-3 md:grid-cols-2">
                {plan.data.items.map((it, i) => (
                  <li key={it.skill} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold">
                        <span className="mr-1.5 font-mono text-xs text-stamp">{i + 1}</span>
                        {it.skill}
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground tabular">~{it.hours}h</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{it.why}</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-sm">
                      {it.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <p className="text-sm">
                      <span className="font-medium">Build:</span> {it.project}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {it.resources.map((r) => (
                        <a
                          key={r.title}
                          href={searchUrl(r.kind, r.query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:border-stamp hover:text-stamp"
                        >
                          {r.title} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">Resource links open a search, so you always land on the current version of each course or doc.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You already cover every skill the current listings ask for. Check again after the next refresh.</p>
      )}
    </Card>
  );
}

function Insights() {
  const apps = useAppStore((s) => s.applications);
  const cvs = useAppStore((s) => s.cvs);

  const s = useMemo(() => {
    const applied = apps.filter(everApplied);
    const heard = applied.filter(heardBack);
    const inter = applied.filter(interviewed);
    const offers = apps.filter((a) => a.status === "offer");
    const replyDays = applied.map(daysToReply).filter((d): d is number => d != null).sort((a, b) => a - b);
    const median = replyDays.length ? replyDays[Math.floor(replyDays.length / 2)]! : null;

    const bySource = [...SOURCES.map((x) => ({ id: x.id as string, label: x.label })), { id: "manual", label: "Added by hand" }]
      .map((src) => {
        const list = applied.filter((a) => a.source === src.id);
        return { ...src, applied: list.length, heard: list.filter(heardBack).length, interviews: list.filter(interviewed).length };
      })
      .filter((r) => r.applied > 0);

    const byCv = cvs
      .map((cv) => {
        const list = applied.filter((a) => a.cvId === cv.id);
        return { id: cv.id, label: cv.label, applied: list.length, heard: list.filter(heardBack).length, interviews: list.filter(interviewed).length };
      })
      .filter((r) => r.applied > 0);

    return { tracked: apps.length, applied: applied.length, heard: heard.length, interviews: inter.length, offers: offers.length, median, bySource, byCv };
  }, [apps, cvs]);

  const funnel = [
    { label: "Tracked", n: s.tracked },
    { label: "Applied", n: s.applied },
    { label: "Heard back", n: s.heard },
    { label: "Interview", n: s.interviews },
    { label: "Offer", n: s.offers },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <header>
        <div className="form-caption">Insights</div>
        <h1 className="font-display-wide mt-1 text-3xl leading-none font-extrabold sm:text-[2.6rem]">How your search is going</h1>
        <p className="mt-2 text-sm text-muted-foreground">Worked out from your tracker. Move cards as replies come in to keep it accurate.</p>
      </header>

      <div className="mt-6 grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-5 sm:divide-y-0">
        <Tile label="Applied" value={String(s.applied)} />
        <Tile label="Heard back" value={`${pct(s.heard, s.applied)}%`} hint={s.applied ? `${s.heard} of ${s.applied}` : undefined} />
        <Tile label="Interview rate" value={`${pct(s.interviews, s.applied)}%`} hint={s.applied ? `${s.interviews} interviews` : undefined} />
        <Tile label="Offers" value={String(s.offers)} />
        <Tile label="Typical reply" value={s.median == null ? "–" : `${s.median}d`} hint={s.median == null ? "No replies yet" : "median days to first reply"} />
      </div>

      {s.applied === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
          Charts fill in once you mark applications as applied.{" "}
          <Link href="/discover" className="text-stamp underline underline-offset-2">
            Find internships
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Funnel" hint="Each stage counts applications that reached it at any point.">
          {funnel.map((f, i) => (
            <BarRow key={f.label} label={f.label} value={f.n} max={Math.max(1, s.tracked)} text={String(f.n)} sub={i >= 2 && s.applied ? `${pct(f.n, s.applied)}% of applied` : undefined} />
          ))}
        </Card>

        <WeeklyChart apps={apps} />

        <Card title="Which boards get replies" hint="Reply rate for applications you found on each board.">
          {s.bySource.length ? (
            s.bySource.map((r) => (
              <BarRow key={r.id} label={r.label} value={pct(r.heard, r.applied)} max={100} text={`${pct(r.heard, r.applied)}%`} sub={`${r.applied} applied · ${r.interviews} interviews`} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          )}
        </Card>

        <Card title="Which CV gets replies" hint="Record the CV you sent on each application to compare versions.">
          {s.byCv.length ? (
            s.byCv.map((r) => (
              <BarRow key={r.id} label={r.label} value={pct(r.heard, r.applied)} max={100} text={`${pct(r.heard, r.applied)}%`} sub={`${r.applied} sent · ${r.interviews} interviews`} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No CV recorded on applications yet. Add CV versions on your{" "}
              <Link href="/profile" className="text-stamp underline underline-offset-2">
                profile
              </Link>{" "}
              and pick the one you sent in each application.
            </p>
          )}
        </Card>
      </div>

      <div className={cn("mt-6")}>
        <SkillGap />
      </div>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <RequireProfile>
      <Insights />
    </RequireProfile>
  );
}
