"use client";

import { RequireProfile } from "@/components/require-profile";
import { Download, FileDown, FileUp, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChipPicker } from "@/components/chip-picker";
import { CvUpload } from "@/components/cv-upload";
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
import { rupees } from "@/lib/format";
import { dedupeSkills, SKILL_NAMES } from "@/lib/skills";
import { loadCvFile, removeCvFile, useAppStore } from "@/lib/store";
import { COUNTRIES, getRole } from "@/lib/taxonomy";
import type { Application, Profile, QuotaInfo, SourceId } from "@/lib/types";

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
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d: { sources: Usage[] }) => setRows(d.sources))
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <div className="h-24 animate-pulse rounded-lg bg-secondary" />;
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const q = r.quota;
        const pct = q?.limit && q.remaining != null ? Math.max(0, Math.min(100, (q.remaining / q.limit) * 100)) : null;
        return (
          <li key={r.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-4 py-2.5 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
              {pct != null ? <span className="block h-full rounded-full bg-stamp" style={{ width: `${pct}%` }} /> : null}
            </span>
            <span className="text-right font-mono text-xs text-muted-foreground tabular">
              {!r.configured ? "no key" : q?.remaining != null ? `${q.remaining}${q.limit ? `/${q.limit}` : ""} left` : "not used yet"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ProfileView() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile)!;
  const applications = useAppStore((s) => s.applications);
  const patchProfile = useAppStore((s) => s.patchProfile);
  const importData = useAppStore((s) => s.importData);
  const reset = useAppStore((s) => s.reset);
  const fileInput = useRef<HTMLInputElement>(null);

  const downloadCv = async () => {
    const blob = await loadCvFile();
    if (!blob || !profile.cv) {
      toast.error("The CV file is not in this browser any more. Upload it again.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: profile.cv.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportData = () => {
    const data = { app: "internship-buddy", version: 1, exportedAt: new Date().toISOString(), profile, applications };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `internship-buddy-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Backup downloaded", { description: "It holds your answers and tracker. The CV file is not included." });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { app?: string; profile?: Profile; applications?: Application[] };
      if (data.app !== "internship-buddy" || !data.profile || !Array.isArray(data.applications)) throw new Error();
      importData({ profile: data.profile, applications: data.applications });
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
          <Section
            title="CV"
            hint="Stored only in this browser. Replacing it adds any newly found skills."
            action={
              profile.cv ? (
                <Button variant="outline" size="sm" onClick={downloadCv}>
                  <Download /> Download
                </Button>
              ) : null
            }
          >
            <CvUpload
              cv={profile.cv}
              onParsed={(cv, result) => {
                const added = result.skills.filter((s) => !profile.skills.some((p) => p.toLowerCase() === s.toLowerCase()));
                patchProfile({ cv, skills: dedupeSkills([...profile.skills, ...result.skills]) });
                toast.success(`CV updated`, { description: added.length ? `Added ${added.length} new skills: ${added.slice(0, 5).join(", ")}` : "No new skills found." });
              }}
              onRemove={() => {
                void removeCvFile();
                patchProfile({ cv: null });
                toast("CV removed");
              }}
            />
          </Section>

          <Section title="Skills" hint="Listings asking for these rank higher. Changes apply straight away.">
            <ChipPicker label="Skills" value={profile.skills} onChange={(skills) => patchProfile({ skills: dedupeSkills(skills) })} options={SKILL_NAMES} placeholder="Add a skill" />
          </Section>

          <Section title="Job board usage" hint="Each board's free plan has a monthly cap, so results are cached and reused until they go stale.">
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
                    <AlertDialogTitle>Delete your profile, CV and tracker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes your answers, your CV file and all {applications.length} tracked applications from this browser. It cannot be undone unless you have a backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my data</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        void removeCvFile();
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
