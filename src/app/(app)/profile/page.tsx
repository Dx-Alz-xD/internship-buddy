"use client";

import { Bell, BellOff, FileDown, FileUp, Pencil, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChipPicker } from "@/components/chip-picker";
import { CvManager } from "@/components/profile/cv-manager";
import { enableNotifications } from "@/components/reminder-watcher";
import { RequireProfile } from "@/components/require-profile";
import { StudentCard } from "@/components/student-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { rupees } from "@/lib/format";
import { dedupeSkills, SKILL_NAMES } from "@/lib/skills";
import { removeCvFile, useAppStore } from "@/lib/store";
import { COUNTRIES, getRole } from "@/lib/taxonomy";
import type { Application, CompanyPrep, CvVersion, Profile, QuotaInfo, SourceId } from "@/lib/types";

type Usage = { id: SourceId; label: string; configured: boolean; refreshHours: number; quota: QuotaInfo | null };

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
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

function ApiUsage() {
  const [rows, setRows] = useState<Usage[] | null>(null);
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d: { sources: Usage[]; ai: boolean }) => {
        setRows(d.sources);
        setAi(d.ai);
      })
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <div className="h-24 animate-pulse rounded-lg bg-secondary" />;
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const q = r.quota;
        const pct = q?.limit && q.remaining != null ? Math.max(0, Math.min(100, (q.remaining / q.limit) * 100)) : null;
        return (
          <li key={r.id} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-4 py-2.5 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              {pct != null ? <span className="block h-full rounded-full bg-stamp" style={{ width: `${pct}%` }} /> : null}
            </span>
            <span className="text-right font-mono text-xs text-muted-foreground tabular">
              {!r.configured ? "no key" : q?.remaining != null ? `${q.remaining}${q.limit ? `/${q.limit}` : ""} left` : "free, no limit shown"}
            </span>
          </li>
        );
      })}
      <li className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-4 py-2.5 text-sm">
        <span className="font-medium">Groq AI</span>
        <span />
        <span className="text-right font-mono text-xs text-muted-foreground">{ai == null ? "…" : ai ? "connected" : "no key"}</span>
      </li>
    </ul>
  );
}

function ProfileView() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile)!;
  const applications = useAppStore((s) => s.applications);
  const cvs = useAppStore((s) => s.cvs);
  const prep = useAppStore((s) => s.prep);
  const aiConsent = useAppStore((s) => s.aiConsent);
  const setAiConsent = useAppStore((s) => s.setAiConsent);
  const notifyOn = useAppStore((s) => s.notify.enabled);
  const setNotify = useAppStore((s) => s.setNotify);
  const patchProfile = useAppStore((s) => s.patchProfile);
  const importData = useAppStore((s) => s.importData);
  const reset = useAppStore((s) => s.reset);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const data = { app: "internship-buddy", version: 2, exportedAt: new Date().toISOString(), profile, applications, cvs, prep };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `internship-buddy-${new Date().toISOString().slice(0, 10)}.json` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Backup downloaded", { description: "It holds your answers, tracker, prep notes and CV text. CV files themselves are not included." });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as {
        app?: string;
        profile?: Profile & { cv?: unknown };
        applications?: Application[];
        cvs?: CvVersion[];
        prep?: Record<string, CompanyPrep>;
      };
      if (data.app !== "internship-buddy" || !data.profile || !Array.isArray(data.applications)) throw new Error();
      const { cv: _old, ...profileRest } = data.profile;
      void _old;
      importData({ profile: { ...profileRest, cvId: profileRest.cvId ?? null }, applications: data.applications, cvs: data.cvs ?? [], prep: data.prep ?? {} });
      toast.success("Backup restored", { description: `${data.applications.length} applications loaded.` });
    } catch {
      toast.error("That file is not an Internship Buddy backup.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const prefs = [
    { remote: "Remote", hybrid: "Hybrid", onsite: "In office", any: "Any work mode" }[profile.workMode],
    profile.region === "abroad" ? COUNTRIES.find((c) => c.code === profile.country)?.label : profile.cities.join(", ") || "Anywhere in India",
    profile.minStipend ? `from ${rupees(profile.minStipend)}/month` : "any stipend",
    profile.maxDuration ? `up to ${profile.maxDuration} months` : "any duration",
    profile.partTime ? "part-time OK" : "full-time only",
    profile.wantsJobs ? "jobs included" : "internships only",
  ];
  const x = profile.extras;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="form-caption">Profile</div>
          <h1 className="font-display-wide mt-1 text-3xl leading-none font-extrabold sm:text-[2.6rem]">{profile.name}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/onboarding">
            <Pencil /> Edit answers
          </Link>
        </Button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <StudentCard profile={profile} />
          <dl className="space-y-3 rounded-xl border bg-card p-4 text-sm">
            <div>
              <dt className="form-caption">Roles, in order</dt>
              <dd className="mt-1">{profile.roles.map((r, i) => `${i + 1}. ${getRole(r).label}`).join("  ")}</dd>
            </div>
            <div>
              <dt className="form-caption">Preferences</dt>
              <dd className="mt-1">{prefs.filter(Boolean).join(" · ")}</dd>
            </div>
            {x?.projects.length ? (
              <div>
                <dt className="form-caption">Projects from your CV</dt>
                <dd className="mt-1 space-y-1">
                  {x.projects.map((p) => (
                    <p key={p.name}>
                      <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{p.summary}</span>
                    </p>
                  ))}
                </dd>
              </div>
            ) : null}
            {profile.links.linkedin || profile.links.github || profile.links.portfolio ? (
              <div>
                <dt className="form-caption">Links</dt>
                <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {(["linkedin", "github", "portfolio"] as const)
                    .filter((k) => profile.links[k])
                    .map((k) => (
                      <a key={k} href={profile.links[k]} target="_blank" rel="noopener noreferrer" className="text-stamp underline underline-offset-2">
                        {k === "linkedin" ? "LinkedIn" : k === "github" ? "GitHub" : "Portfolio"}
                      </a>
                    ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="space-y-6">
          <Section title="CVs" hint="Keep a version per kind of role. The main CV is used for matching and AI writing; the tracker records which one you sent.">
            <CvManager />
          </Section>

          <Section title="Skills" hint="Listings asking for these rank higher. Changes apply straight away.">
            <ChipPicker label="Skills" value={profile.skills} onChange={(skills) => patchProfile({ skills: dedupeSkills(skills) })} options={SKILL_NAMES} placeholder="Add a skill" />
          </Section>

          <Section title="AI and reminders">
            <div className="divide-y rounded-lg border">
              <label className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="flex gap-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-stamp" />
                  <span>
                    <span className="block text-sm font-medium">AI features</span>
                    <span className="block text-xs text-muted-foreground">Fit checks, writing help, CV review and search send your profile, CV text and listings to Groq.</span>
                  </span>
                </span>
                <Switch checked={aiConsent} onCheckedChange={setAiConsent} />
              </label>
              <label className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="flex gap-3">
                  {notifyOn ? <Bell className="mt-0.5 size-4 shrink-0 text-stamp" /> : <BellOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span>
                    <span className="block text-sm font-medium">Notify me on this device</span>
                    <span className="block text-xs text-muted-foreground">
                      Deadlines, interviews and follow-ups due today or tomorrow, while Internship Buddy is open. For reminders when it is closed, add them to your calendar from the tracker.
                    </span>
                  </span>
                </span>
                <Switch
                  checked={notifyOn}
                  onCheckedChange={async (on) => {
                    if (!on) return setNotify({ enabled: false });
                    const r = await enableNotifications();
                    if (r === "denied") toast.error("Notifications are blocked for this site. Allow them in your browser's site settings.");
                    if (r === "unsupported") toast.error("This browser does not support notifications.");
                    if (r === "granted") toast.success("Reminders are on for this device");
                  }}
                />
              </label>
            </div>
          </Section>

          <Section title="Job board usage" hint="Free plans have monthly caps, so results are cached and reused until they go stale.">
            <ApiUsage />
          </Section>

          <Section title="Your data" hint="Everything lives in this browser. Download a backup before switching laptops or clearing browser data.">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportData}>
                <FileDown /> Download backup
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp /> Restore from backup
              </Button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => importFile(e.target.files?.[0])} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 /> Delete everything
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your profile, CVs and tracker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes your answers, {cvs.length} CV{cvs.length === 1 ? "" : "s"}, prep notes and all {applications.length} tracked applications from this browser. It cannot be undone unless you have a backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my data</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        cvs.forEach((c) => void removeCvFile(c.id));
                        reset();
                        router.replace("/");
                        toast("All data deleted");
                      }}
                    >
                      Delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireProfile>
      <ProfileView />
    </RequireProfile>
  );
}
