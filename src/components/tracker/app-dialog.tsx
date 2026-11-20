"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shortDate } from "@/lib/format";
import { STATUS_META } from "@/lib/taxonomy";
import { APP_STATUSES, type Application, type AppStatus } from "@/lib/types";

export type AppForm = Pick<
  Application,
  "title" | "company" | "url" | "status" | "appliedOn" | "deadline" | "nextStep" | "nextStepOn" | "contact" | "notes" | "locationLabel" | "payLabel"
>;

const blank: AppForm = {
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
};

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
  const [f, setF] = useState<AppForm>(app ? { ...app } : blank);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof AppForm>(k: K, v: AppForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const invalid = !f.title.trim() || !f.company.trim();

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!invalid) onSave({ ...f, title: f.title.trim(), company: f.company.trim() });
      }}
    >
      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-1 sm:grid-cols-2">
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
          <Label htmlFor="a-applied">Applied on</Label>
          <Input id="a-applied" type="date" value={f.appliedOn ?? ""} onChange={(e) => set("appliedOn", e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-deadline">Application deadline</Label>
          <Input id="a-deadline" type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-contact">Contact</Label>
          <Input id="a-contact" value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Recruiter name or email" />
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
          <Label htmlFor="a-notes">Notes</Label>
          <Textarea id="a-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Interview questions, who referred you, what to prepare" />
        </div>
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

export function AppDialog({
  open,
  app,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  app: Application | null;
  onOpenChange: (o: boolean) => void;
  onSave: (f: AppForm) => void;
  onDelete?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display-wide text-xl font-extrabold">{app ? `${app.title}` : "Add an application"}</DialogTitle>
          <DialogDescription>{app ? app.company : "For internships you found outside Internship Buddy, like referrals or college placement drives."}</DialogDescription>
        </DialogHeader>
        {open ? <Form key={app?.id ?? "new"} app={app} onSave={onSave} onDelete={onDelete} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
