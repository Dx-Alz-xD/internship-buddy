"use client";

import { CalendarPlus, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { WritePanel } from "@/components/ai-panels";
import { PrepNotes } from "@/components/tracker/prep-notes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shortDate } from "@/lib/format";
import { downloadIcs, googleCalendarLink, reminders } from "@/lib/reminders";
import { useAppStore } from "@/lib/store";
import { STATUS_META } from "@/lib/taxonomy";
import { APP_STATUSES, type Application, type AppStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AppForm = Pick<
  Application,
  "title" | "company" | "url" | "status" | "appliedOn" | "deadline" | "nextStep" | "nextStepOn" | "contact" | "notes" | "locationLabel" | "payLabel" | "cvId"
>;

const NO_CV = "none";

function Form({
  app,
  onSave,
  onDelete,
  onCancel,
}: {
  app: Application | null;
  onSave: (f: AppForm) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const cvs = useAppStore((s) => s.cvs);
  const mainCv = useAppStore((s) => s.profile?.cvId ?? null);
  const [f, setF] = useState<AppForm>(
    app
      ? { ...app, cvId: app.cvId ?? null }
      : {
          title: "",
          company: "",
          url: "",
          status: "applied",
          appliedOn: new Date().toISOString().slice(0, 10),
          deadline: null,
          nextStep: "",
          nextStepOn: null,
          contact: "",
          notes: "",
          locationLabel: "",
          payLabel: null,
          cvId: mainCv,
        },
  );
  const [tried, setTried] = useState(false);
  const set = <K extends keyof AppForm>(k: K, v: AppForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const invalid = !f.title.trim() || !f.company.trim();
  const events = app ? reminders([{ ...app, ...f }]).filter((r) => r.kind !== "followup") : [];

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!invalid) onSave({ ...f, title: f.title.trim(), company: f.company.trim() });
      }}
    >
      <div className="grid max-h-[58vh] gap-4 overflow-y-auto px-1 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a-title">Role</Label>
          <Input id="a-title" value={f.title} onChange={(e) => set("title", e.target.value)} aria-invalid={tried && !f.title.trim()} placeholder="e.g. Frontend Intern" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-company">Company</Label>
          <Input id="a-company" value={f.company} onChange={(e) => set("company", e.target.value)} aria-invalid={tried && !f.company.trim()} placeholder="e.g. Razorpay" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="a-url">Link to the listing</Label>
          <Input id="a-url" type="url" value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-status">Status</Label>
          <Select value={f.status} onValueChange={(v) => set("status", v as AppStatus)}>
            <SelectTrigger id="a-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-cv">CV sent</Label>
          <Select value={f.cvId ?? NO_CV} onValueChange={(v) => set("cvId", v === NO_CV ? null : v)}>
            <SelectTrigger id="a-cv" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CV}>Not recorded</SelectItem>
              {cvs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-applied">Applied on</Label>
          <Input id="a-applied" type="date" value={f.appliedOn ?? ""} onChange={(e) => set("appliedOn", e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-deadline">Application deadline</Label>
          <Input id="a-deadline" type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-next">Next step</Label>
          <Input id="a-next" value={f.nextStep} onChange={(e) => set("nextStep", e.target.value)} placeholder="e.g. HR round, submit assignment" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-next-on">Next step date</Label>
          <Input id="a-next-on" type="date" value={f.nextStepOn ?? ""} onChange={(e) => set("nextStepOn", e.target.value || null)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="a-contact">Contact</Label>
          <Input id="a-contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Recruiter name or email" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="a-notes">Notes</Label>
          <Textarea id="a-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Who referred you, salary discussed, anything to remember" />
        </div>
        {events.length ? (
          <div className="space-y-1.5 sm:col-span-2">
            <div className="form-caption">Add to calendar</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => downloadIcs(events, `${f.company}-${f.title}.ics`.replace(/[^\w.-]+/g, "-"))}>
                <CalendarPlus /> Calendar file
              </Button>
              {events.map((r) => (
                <Button key={r.key} type="button" variant="ghost" size="sm" asChild>
                  <a href={googleCalendarLink(r)} target="_blank" rel="noopener noreferrer">
                    Google Calendar: {r.kind === "deadline" ? "deadline" : r.title} <ExternalLink />
                  </a>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {app?.history.length ? (
          <div className="space-y-2 sm:col-span-2">
            <div className="form-caption">History</div>
            <ol className="space-y-1 border-l-2 border-dashed pl-4">
              {app.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium" style={{ color: STATUS_META[h.status].color }}>
                    {STATUS_META[h.status].label}
                  </span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{shortDate(h.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      {tried && invalid ? <p className="text-sm text-destructive">Add the role and the company.</p> : null}
      <DialogFooter className="items-center gap-2 sm:justify-between">
        <div className="flex gap-1">
          {onDelete ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 /> Delete
            </Button>
          ) : null}
          {app?.url ? (
            <Button type="button" variant="ghost" asChild>
              <a href={app.url} target="_blank" rel="noopener noreferrer">
                Open listing <ExternalLink />
              </a>
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{app ? "Save changes" : "Add to tracker"}</Button>
        </div>
      </DialogFooter>
    </form>
  );
}

type Tab = "details" | "prep" | "write";

export function AppDialog({
  open,
  app,
  onOpenChange,
  onSave,
  onDelete,
  initialTab = "details",
}: {
  open: boolean;
  app: Application | null;
  onOpenChange: (o: boolean) => void;
  onSave: (f: AppForm) => void;
  onDelete?: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lastKey, setLastKey] = useState<string | null>(null);
  // Reset to the requested tab whenever a different application is opened.
  const key = open ? `${app?.id ?? "new"}:${initialTab}` : null;
  if (key !== lastKey) {
    setLastKey(key);
    setTab(initialTab);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display-wide text-xl font-extrabold">{app ? app.title : "Add an application"}</DialogTitle>
          <DialogDescription>{app ? app.company : "For internships you found outside Internship Buddy, like referrals or college placement drives."}</DialogDescription>
          {app ? (
            <div className="-mb-2 flex gap-1 border-b pt-1" role="tablist" aria-label="Application sections">
              {(
                [
                  ["details", "Details"],
                  ["prep", "Prep notes"],
                  ["write", "Follow up"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:bg-muted",
                    tab === id ? "border-stamp text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </DialogHeader>
        {open && (tab === "details" || !app) ? <Form key={app?.id ?? "new"} app={app} onSave={onSave} onDelete={onDelete} onCancel={() => onOpenChange(false)} /> : null}
        {open && app && tab === "prep" ? (
          <div className="max-h-[62vh] overflow-y-auto px-1">
            <PrepNotes key={app.company} company={app.company} />
          </div>
        ) : null}
        {open && app && tab === "write" ? (
          <div className="max-h-[62vh] overflow-y-auto px-1">
            <WritePanel
              cacheId={app.id}
              listing={[
                `Title: ${app.title}`,
                `Company: ${app.company}`,
                app.locationLabel && `Location: ${app.locationLabel}`,
                app.payLabel && `Stipend: ${app.payLabel}`,
                `Status: ${STATUS_META[app.status].label}`,
                app.appliedOn && `Applied on: ${app.appliedOn}`,
                app.contact && `Contact: ${app.contact}`,
                app.nextStep && `Next step: ${app.nextStep}${app.nextStepOn ? ` on ${app.nextStepOn}` : ""}`,
              ]
                .filter(Boolean)
                .join("\n")}
              description={app.notes}
              kinds={app.status === "saved" ? ["email", "linkedin", "cover"] : ["followup", "email", "linkedin"]}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
