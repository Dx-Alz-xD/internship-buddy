"use client";

import { RequireProfile } from "@/components/require-profile";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CalendarClock, CalendarPlus, Check, Mail, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppCard } from "@/components/tracker/app-card";
import { AppDialog } from "@/components/tracker/app-dialog";
import { SaveAnywhere } from "@/components/tracker/save-anywhere";
import { Button } from "@/components/ui/button";
import { daysUntil, dueText, shortDate } from "@/lib/format";
import { countUp } from "@/lib/motion";
import { downloadIcs, reminders } from "@/lib/reminders";
import { useAppStore } from "@/lib/store";
import { STATUS_META } from "@/lib/taxonomy";
import { APP_STATUSES, type Application, type AppStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function Stat({ label, value, suffix = "", hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (el.current) countUp(el.current, value, suffix);
  }, [value, suffix]);
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="form-caption">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span ref={el} className="font-display-wide text-3xl font-extrabold tabular">
          {value}
          {suffix}
        </span>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

function Column({
  status,
  apps,
  onOpen,
  onMove,
  lastMoved,
}: {
  status: AppStatus;
  apps: Application[];
  onOpen: (a: Application) => void;
  onMove: (a: Application, s: AppStatus) => void;
  lastMoved: { id: string; at: number } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label}, ${apps.length}`}
      className={cn(
        "flex w-[16.5rem] shrink-0 flex-col rounded-xl border border-transparent bg-secondary/60 p-2 transition-colors 2xl:w-auto",
        isOver && "border-stamp/50 bg-stamp-soft",
      )}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
        <span className="size-2 rounded-full" style={{ background: meta.color }} />
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular">{apps.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {apps.map((a) => (
          <AppCard key={a.id} app={a} onOpen={() => onOpen(a)} onMove={(s) => onMove(a, s)} stampNow={lastMoved?.id === a.id ? lastMoved.at : 0} />
        ))}
        {!apps.length ? <p className="px-2 py-4 text-center text-xs text-muted-foreground/80">{meta.description}</p> : null}
      </div>
    </section>
  );
}

function Tracker() {
  const applications = useAppStore((s) => s.applications);
  const addApplication = useAppStore((s) => s.addApplication);
  const updateApplication = useAppStore((s) => s.updateApplication);
  const moveApplication = useAppStore((s) => s.moveApplication);
  const removeApplication = useAppStore((s) => s.removeApplication);

  const [editing, setEditing] = useState<Application | null>(null);
  const [editTab, setEditTab] = useState<"details" | "prep" | "write">("details");
  const openApp = (a: Application, tab: "details" | "prep" | "write" = "details") => {
    setEditTab(tab);
    setEditing(a);
  };
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [lastMoved, setLastMoved] = useState<{ id: string; at: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const m = Object.fromEntries(APP_STATUSES.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>;
    for (const a of applications) m[a.status].push(a);
    for (const s of APP_STATUSES) m[s].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return m;
  }, [applications]);

  const stats = useMemo(() => {
    const sent = applications.filter((a) => a.status !== "saved");
    const heard = sent.filter((a) => a.status !== "applied");
    const interviews = applications.filter((a) => a.history.some((h) => h.status === "interview")).length;
    return {
      sent: sent.length,
      interviews,
      offers: byStatus.offer.length,
      rate: sent.length ? Math.round((heard.length / sent.length) * 100) : 0,
    };
  }, [applications, byStatus]);

  const allReminders = useMemo(() => reminders(applications), [applications]);
  const upcoming = useMemo(
    () => allReminders.filter((r) => (r.kind === "followup" ? (daysUntil(r.date) ?? 99) <= 0 : (daysUntil(r.date) ?? 99) <= 14)),
    [allReminders],
  );

  const markFollowedUp = (a: Application) => {
    const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    updateApplication(a.id, { nextStep: "Check for a reply", nextStepOn: inAWeek });
    toast.success("Marked as followed up", { description: "We will check back in a week." });
  };

  const move = (a: Application, status: AppStatus) => {
    if (a.status === status) return;
    moveApplication(a.id, status);
    setLastMoved({ id: a.id, at: Date.now() });
    if (status === "offer") toast.success("Offer! Congratulations.", { description: `${a.title} at ${a.company}` });
  };

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const app = applications.find((a) => a.id === e.active.id);
    const to = e.over?.id as AppStatus | undefined;
    if (app && to) move(app, to);
  };
  const dragging = dragId ? applications.find((a) => a.id === dragId) : null;

  return (
    <div className="mx-auto max-w-[96rem] px-4 pt-6 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="form-caption">Tracker</div>
          <h1 className="font-display-wide mt-1 text-3xl leading-none font-extrabold sm:text-[2.6rem]">Your applications</h1>
          <p className="mt-2 text-sm text-muted-foreground">Drag a card to a new column when something changes. Everything is saved in this browser.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveAnywhere />
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add an application
          </Button>
        </div>
      </header>

      {applications.length ? (
        <>
          <div className="mt-6 grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-4 sm:divide-y-0">
            <Stat label="Applied" value={stats.sent} />
            <Stat label="Heard back" value={stats.rate} suffix="%" hint={stats.sent ? `of ${stats.sent}` : undefined} />
            <Stat label="Interviews" value={stats.interviews} />
            <Stat label="Offers" value={stats.offers} />
          </div>

          {upcoming.length ? (
            <section className="mt-4 rounded-xl border border-marigold/40 bg-marigold-soft/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="size-4 text-marigold" /> Coming up
                </h2>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    downloadIcs(allReminders, "internship-buddy-reminders.ics");
                    toast.success("Calendar file downloaded", { description: "Open it to add every deadline, interview and follow-up to your calendar, with alerts." });
                  }}
                >
                  <CalendarPlus /> Add all to calendar
                </Button>
              </div>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.slice(0, 9).map((u) => (
                  <li key={u.key} className="flex items-center gap-1 rounded-lg bg-card pr-1.5">
                    <button
                      onClick={() => openApp(u.app, u.kind === "followup" ? "write" : "details")}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none hover:bg-secondary/50 focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span className={cn("w-14 shrink-0 font-mono text-xs font-semibold tabular", u.kind === "followup" && "text-stamp")}>
                        {u.kind === "followup" ? "Now" : shortDate(u.date)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{u.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{u.kind === "followup" ? u.detail : `${u.app.company} · ${dueText(u.date)}`}</span>
                      </span>
                    </button>
                    {u.kind === "followup" ? (
                      <>
                        <Button variant="ghost" size="icon-xs" onClick={() => openApp(u.app, "write")} aria-label={`Write a follow-up to ${u.app.company}`}>
                          <Mail />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => markFollowedUp(u.app)} aria-label={`Mark ${u.app.company} as followed up`}>
                          <Check />
                        </Button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
            <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
              <div className="flex gap-3 2xl:grid 2xl:grid-cols-6">
                {APP_STATUSES.map((s) => (
                  <Column key={s} status={s} apps={byStatus[s]} onOpen={(a) => openApp(a)} onMove={move} lastMoved={lastMoved} />
                ))}
              </div>
            </div>
            <DragOverlay dropAnimation={null}>{dragging ? <AppCard app={dragging} overlay /> : null}</DragOverlay>
          </DndContext>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
          <h2 className="font-display-wide text-2xl font-extrabold">Nothing tracked yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Save or mark listings as applied from Discover and they land here. Add ones you found elsewhere, like referrals or campus drives, by hand.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/discover">
                <Search /> Find internships
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus /> Add an application
            </Button>
          </div>
        </div>
      )}

      <AppDialog
        open={adding}
        app={null}
        onOpenChange={setAdding}
        onSave={(f) => {
          const a = addApplication(f);
          setAdding(false);
          setLastMoved({ id: a.id, at: Date.now() });
          toast.success("Added to your tracker", { description: `${a.title} · ${a.company}` });
        }}
      />
      <AppDialog
        open={!!editing}
        app={editing}
        initialTab={editTab}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(f) => {
          if (!editing) return;
          const { status, ...rest } = f;
          updateApplication(editing.id, rest);
          if (status !== editing.status) move(editing, status);
          setEditing(null);
          toast.success("Changes saved");
        }}
        onDelete={() => {
          if (!editing) return;
          const gone = editing;
          removeApplication(gone.id);
          setEditing(null);
          toast("Application deleted", {
            description: `${gone.title} · ${gone.company}`,
            action: {
              label: "Undo",
              onClick: () => useAppStore.setState((s) => ({ applications: [gone, ...s.applications] })),
            },
          });
        }}
      />
    </div>
  );
}

export default function TrackerPage() {
  return (
    <RequireProfile>
      <Tracker />
    </RequireProfile>
  );
}
