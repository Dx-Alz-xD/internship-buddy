"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { ChipPicker } from "@/components/chip-picker";
import { CvUpload } from "@/components/cv-upload";
import { StudentCard } from "@/components/student-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { callAi, requestAiConsent } from "@/lib/ai-client";
import type { CvExtract } from "@/lib/ai-types";
import { rupees } from "@/lib/format";
import { slideStep } from "@/lib/motion";
import { dedupeSkills, SKILL_NAMES } from "@/lib/skills";
import { removeCvFile, useAppStore } from "@/lib/store";
import { BRANCHES, CITIES, COLLEGES, COUNTRIES, DEGREES, getRole, ROLE_DOMAINS, ROLES, YEARS } from "@/lib/taxonomy";
import type { Profile, StudyYear } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Draft = Omit<Profile, "year" | "gradYear" | "createdAt" | "updatedAt"> & {
  year: StudyYear | null;
  gradYear: number | null;
  createdAt?: string;
};

export const EMPTY_DRAFT: Draft = {
  name: "",
  status: "student",
  college: "",
  collegeCity: "",
  degree: "",
  branch: "",
  year: null,
  gradYear: null,
  roles: [],
  skills: [],
  workMode: "any",
  cities: [],
  region: "india",
  country: "us",
  minStipend: 0,
  maxDuration: null,
  availableFrom: "",
  partTime: true,
  wantsJobs: false,
  links: { linkedin: "", github: "", portfolio: "" },
  cvId: null,
};

const DRAFT_KEY = "internship-buddy:draft";
export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}
const saveDraft = (d: Draft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
};
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

/** Length of the programme in years, used to work out the graduation year. */
function programmeLength(degree: string) {
  if (/integrated|dual/i.test(degree)) return 5;
  if (/b\.tech|b\.e\.|b\.des/i.test(degree)) return 4;
  if (/^m\.|mca|mba|pgdm/i.test(degree)) return 2;
  return 3;
}

function expectedGradYear(degree: string, year: StudyYear | null) {
  const now = new Date();
  const sessionStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  if (!year) return null;
  if (year === "grad") return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const len = programmeLength(degree || "B.Tech / B.E.");
  return sessionStart + Math.max(1, len - Number(year) + 1);
}

const isFinalYear = (degree: string, year: StudyYear | null) =>
  year === "grad" || (year != null && Number(year) >= programmeLength(degree || "B.Tech / B.E."));

/** Inverse of expectedGradYear: which year a student is in, given when they graduate. */
function yearFromGrad(degree: string, gradYear: number): StudyYear {
  const now = new Date();
  const sessionStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const left = gradYear - sessionStart;
  if (left <= 0) return "grad";
  const len = programmeLength(degree || "B.Tech / B.E.");
  return String(Math.min(len, Math.max(1, len - left + 1))) as StudyYear;
}

/** Merges what the AI read from the CV into the answers, never overwriting what the student typed. */
function applyExtract(p: Draft, x: CvExtract): Draft {
  const degree = p.degree || x.degree;
  let year = p.year;
  if (!year) {
    if (x.currentYear !== "unknown") year = x.currentYear;
    else if (x.gradYear && degree) year = yearFromGrad(degree, x.gradYear);
  }
  const gradYear = p.gradYear ?? x.gradYear ?? (year ? expectedGradYear(degree, year) : null);
  return {
    ...p,
    name: p.name || x.name,
    college: p.college || x.college,
    collegeCity: p.collegeCity || x.collegeCity,
    degree,
    branch: p.branch || x.branch,
    year,
    gradYear,
    status: year === "grad" ? "graduate" : p.status,
    wantsJobs: year && !p.year ? isFinalYear(degree, year) : p.wantsJobs,
    skills: dedupeSkills([...p.skills, ...x.skills]),
    roles: p.roles.length ? p.roles : x.suggestedRoles.filter((id) => ROLES.some((r) => r.id === id)).slice(0, 3),
    links: {
      linkedin: p.links.linkedin || x.links.linkedin,
      github: p.links.github || x.links.github,
      portfolio: p.links.portfolio || x.links.portfolio,
    },
    extras: { cgpa: x.cgpa, projects: x.projects, experience: x.experience, achievements: x.achievements },
  };
}

const STEPS = [
  { id: "cv", title: "Your CV" },
  { id: "about", title: "About you" },
  { id: "college", title: "College" },
  { id: "roles", title: "Roles" },
  { id: "skills", title: "Skills" },
  { id: "prefs", title: "Preferences" },
  { id: "review", title: "Review" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

function stepError(step: StepId, d: Draft): string | null {
  switch (step) {
    case "about":
      return d.name.trim().length < 2 ? "Enter your name to continue." : null;
    case "college":
      if (!d.college.trim()) return "Choose or type your college.";
      if (!d.degree) return "Pick your degree.";
      if (!d.branch.trim()) return "Add your branch or major.";
      if (!d.year) return "Pick your current year.";
      return null;
    case "cv":
      return null;
    case "roles":
      return d.roles.length === 0 ? "Pick at least one role." : null;
    case "skills":
      return d.skills.length < 3 ? `Add at least 3 skills (${d.skills.length} so far).` : null;
    case "prefs":
      if (d.region === "india" && (d.workMode === "onsite" || d.workMode === "hybrid") && d.cities.length === 0)
        return "Add at least one city you can work from.";
      return null;
    default:
      return null;
  }
}

function Question({ eyebrow, title, hint, children }: { eyebrow: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="form-caption">{eyebrow}</div>
        <h1 className="font-display-wide text-3xl leading-[1.05] font-extrabold text-balance sm:text-4xl">{title}</h1>
        {hint ? <p className="max-w-prose text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  hint,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col items-start gap-0.5 rounded-lg border bg-card px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        selected ? "border-stamp bg-stamp-soft shadow-[inset_0_0_0_1px_var(--stamp)]" : "hover:border-foreground/30",
      )}
    >
      <span className={cn("pr-7 text-sm font-semibold", selected && "text-stamp")}>{title}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {badge ? <span className="absolute top-2.5 right-2.5">{badge}</span> : null}
    </button>
  );
}

function Suggest({ list, value, onPick }: { list: string[]; value: string; onPick: (s: string) => void }) {
  const q = value.trim().toLowerCase();
  if (q.length < 2) return null;
  const hits = list.filter((c) => c.toLowerCase().includes(q) && c.toLowerCase() !== q).slice(0, 5);
  if (!hits.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {hits.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onPick(h)}
          className="rounded-md border bg-card px-2 py-1 text-xs hover:border-stamp hover:text-stamp focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {h}
        </button>
      ))}
    </div>
  );
}

export function Quiz({ initial, editing }: { initial: Draft; editing: boolean }) {
  const router = useRouter();
  const setProfile = useAppStore((s) => s.setProfile);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const addCv = useAppStore((s) => s.addCv);
  const removeCv = useAppStore((s) => s.removeCv);
  const saveAi = useAppStore((s) => s.saveAi);
  const [d, setD] = useState<Draft>(initial);
  const currentCv = useAppStore((s) => s.cvs.find((c) => c.id === d.cvId) ?? null);
  const aiExtract = useAppStore((s) => (d.cvId ? (s.ai[`cv-extract:${d.cvId}`]?.data as CvExtract | undefined) : undefined));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fillWithAi = async (cvId: string, text: string) => {
    if (!(await requestAiConsent())) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const x = await callAi<CvExtract>("cv-extract", { text });
      saveAi(`cv-extract:${cvId}`, x);
      setD((p) => applyExtract(p, x));
      toast.success("Filled in your answers from the CV", { description: "Check each step; anything you type wins." });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The AI could not read this CV.");
    } finally {
      setAiBusy(false);
    }
  };
  const [stepIndex, setStepIndex] = useState(editing ? STEPS.length - 1 : 0);
  const [showError, setShowError] = useState(false);
  const [customRole, setCustomRole] = useState("");
  const direction = useRef<1 | -1>(1);
  const panel = useRef<HTMLDivElement>(null);
  const step = STEPS[stepIndex]!.id;
  const error = stepError(step, d);

  useEffect(() => {
    if (!editing) saveDraft(d);
  }, [d, editing]);

  useEffect(() => {
    if (panel.current) slideStep(panel.current, direction.current);
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [stepIndex]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const go = (to: number) => {
    direction.current = to > stepIndex ? 1 : -1;
    setShowError(false);
    setStepIndex(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    if (error) {
      setShowError(true);
      return;
    }
    if (stepIndex < STEPS.length - 1) go(stepIndex + 1);
    else finish();
  };

  const finish = () => {
    const firstBad = STEPS.findIndex((s) => stepError(s.id, d));
    if (firstBad !== -1) {
      go(firstBad);
      setShowError(true);
      return;
    }
    const now = new Date().toISOString();
    const profile: Profile = {
      ...d,
      name: d.name.trim(),
      college: d.college.trim(),
      branch: d.branch.trim(),
      year: d.year!,
      gradYear: d.gradYear ?? expectedGradYear(d.degree, d.year) ?? new Date().getFullYear(),
      createdAt: d.createdAt ?? now,
      updatedAt: now,
    };
    setProfile(profile);
    setActiveRole(profile.roles[0]!);
    clearDraft();
    toast.success(editing ? "Profile updated" : "Profile saved", {
      description: editing ? "Matches now use your new answers." : "Here are the openings that fit you.",
    });
    router.push(editing ? "/profile" : "/discover");
  };

  const setYear = (year: StudyYear) =>
    setD((prev) => ({
      ...prev,
      year,
      gradYear: expectedGradYear(prev.degree, year),
      wantsJobs: isFinalYear(prev.degree, year),
      status: year === "grad" ? "graduate" : prev.status === "graduate" ? "student" : prev.status,
    }));

  const toggleRole = (id: string) =>
    setD((prev) => {
      if (prev.roles.includes(id)) return { ...prev, roles: prev.roles.filter((r) => r !== id) };
      if (prev.roles.length >= 5) {
        toast.message("You can pick up to 5 roles", { description: "Remove one to add another." });
        return prev;
      }
      return { ...prev, roles: [...prev.roles, id] };
    });

  const roleSkillSuggestions = dedupeSkills(d.roles.flatMap((r) => getRole(r).skills));
  const cvSkills = currentCv?.skills ?? [];
  const gradOptions = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <Brand href={editing ? "/profile" : "/"} />
        <div className="font-mono text-xs text-muted-foreground tabular">
          Step {stepIndex + 1} of {STEPS.length}
        </div>
      </header>

      <nav aria-label="Progress" className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
        <ol className="grid grid-cols-7 gap-1.5">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const reachable = editing || i <= stepIndex;
            return (
              <li key={s.id} className="min-w-0">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => go(i)}
                  aria-current={i === stepIndex ? "step" : undefined}
                  className="group w-full text-left outline-none disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      i === stepIndex ? "bg-stamp" : done || editing ? "bg-ink/70" : "bg-border",
                    )}
                  />
                  <span
                    className={cn(
                      "mt-1.5 hidden truncate text-xs sm:block",
                      i === stepIndex ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-32 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:pt-12">
        <div ref={panel} className="max-w-2xl">
          {step === "about" && (
            <Question eyebrow="About you" title="First, what should we call you?" hint="Your answers stay in this browser. They decide which listings you see and how they are ranked.">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  data-autofocus
                  value={d.name}
                  autoComplete="name"
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder="e.g. Aarav Sharma"
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Which describes you best?</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <OptionCard selected={d.status === "student"} onClick={() => set("status", "student")} title="College student" hint="Currently enrolled" />
                  <OptionCard selected={d.status === "graduate"} onClick={() => set("status", "graduate")} title="Recent graduate" hint="Finished in the last 2 years" />
                  <OptionCard selected={d.status === "switcher"} onClick={() => set("status", "switcher")} title="Switching fields" hint="Studying or working, changing track" />
                </div>
              </div>
            </Question>
          )}

          {step === "college" && (
            <Question eyebrow="College" title="Where do you study, and which year are you in?" hint="Your year decides whether you see only internships or full-time roles too.">
              <div className="space-y-2">
                <Label htmlFor="college">College or university</Label>
                <Input id="college" data-autofocus value={d.college} onChange={(e) => set("college", e.target.value)} placeholder="Start typing, e.g. NIT Trichy" className="h-11" />
                <Suggest list={COLLEGES} value={d.college} onPick={(c) => set("college", c)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="degree">Degree</Label>
                  <Select
                    value={d.degree}
                    onValueChange={(v) => setD((p) => ({ ...p, degree: v, gradYear: expectedGradYear(v, p.year), wantsJobs: isFinalYear(v, p.year) }))}
                  >
                    <SelectTrigger id="degree" className="h-11! w-full">
                      <SelectValue placeholder="Choose degree" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEGREES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch or major</Label>
                  <Input id="branch" value={d.branch} onChange={(e) => set("branch", e.target.value)} placeholder="e.g. Computer Science" className="h-11" />
                  <Suggest list={BRANCHES} value={d.branch} onPick={(b) => set("branch", b)} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Current year</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {YEARS.map((y) => (
                    <OptionCard key={y.value} selected={d.year === y.value} onClick={() => setYear(y.value)} title={y.label} hint={y.hint} />
                  ))}
                </div>
              </div>
              {d.year ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-card/60 px-3.5 py-3 text-sm">
                  <span className="text-muted-foreground">{d.year === "grad" ? "Graduated in" : "Graduating in"}</span>
                  <Select value={d.gradYear ? String(d.gradYear) : undefined} onValueChange={(v) => set("gradYear", Number(v))}>
                    <SelectTrigger size="sm" className="w-24 font-mono" aria-label="Graduation year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">Change it if your course is shorter or longer.</span>
                </div>
              ) : null}
            </Question>
          )}

          {step === "cv" && (
            <Question
              eyebrow="Your CV"
              title="Start with your CV and we'll fill in the rest"
              hint="The file stays in this browser. Its text is read on the server to find your skills and links, and is not stored there."
            >
              <CvUpload
                cv={currentCv}
                onParsed={(cv, result) => {
                  if (d.cvId && d.cvId !== cv.id) {
                    removeCv(d.cvId);
                    void removeCvFile(d.cvId);
                  }
                  addCv(cv);
                  setD((p) => ({
                    ...p,
                    cvId: cv.id,
                    skills: dedupeSkills([...p.skills, ...result.skills]),
                    links: {
                      linkedin: p.links.linkedin || result.links.linkedin,
                      github: p.links.github || result.links.github,
                      portfolio: p.links.portfolio || result.links.portfolio,
                    },
                  }));
                  toast.success(`Read ${cv.name}`, {
                    description: result.skills.length ? `Found ${result.skills.length} skills.` : "No skills were recognised. You can add them later.",
                  });
                  // With AI already allowed, go straight on to filling in the other answers.
                  if (useAppStore.getState().aiConsent && cv.text) void fillWithAi(cv.id, cv.text);
                }}
                onRemove={() => {
                  if (d.cvId) {
                    removeCv(d.cvId);
                    void removeCvFile(d.cvId);
                  }
                  set("cvId", null);
                }}
              />
              {currentCv ? (
                <div className="rounded-xl border border-stamp/30 bg-stamp-soft/50 p-4">
                  {aiBusy ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-stamp">
                      <Loader2 className="size-4 animate-spin" /> Reading your education, projects and experience…
                    </div>
                  ) : aiExtract ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stamp">
                        <Sparkles className="size-4" /> Filled in from your CV
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {[
                          aiExtract.name && "Name",
                          aiExtract.college && "College",
                          aiExtract.degree && "Degree",
                          aiExtract.branch && "Branch",
                          (aiExtract.gradYear || aiExtract.currentYear !== "unknown") && "Year",
                          aiExtract.cgpa && `CGPA ${aiExtract.cgpa}`,
                          `${aiExtract.skills.length} skills`,
                          aiExtract.projects.length && `${aiExtract.projects.length} projects`,
                          aiExtract.experience.length && `${aiExtract.experience.length} experience`,
                          aiExtract.suggestedRoles.length && `${aiExtract.suggestedRoles.length} suggested roles`,
                        ]
                          .filter(Boolean)
                          .map((t) => (
                            <span key={String(t)} className="rounded-md bg-card px-2 py-0.5 font-medium">
                              ✓ {t}
                            </span>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Continue to check each answer. Anything you type replaces what the AI found.</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="size-4 text-stamp" /> Fill in my answers with AI
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Reads your college, degree, year, projects and experience. Sends the CV text to Groq.</p>
                      </div>
                      <Button type="button" onClick={() => fillWithAi(currentCv.id, currentCv.text)}>
                        <Sparkles /> Fill in with AI
                      </Button>
                    </div>
                  )}
                  {aiError ? <p className="mt-2 text-sm text-destructive">{aiError}</p> : null}
                </div>
              ) : null}
              {cvSkills.length ? (
                <div className="space-y-2">
                  <div className="form-caption">Skills found in your CV</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cvSkills.map((s) => (
                      <span key={s} className="rounded-md bg-stamp-soft px-2 py-0.5 text-sm text-stamp">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-3">
                {(["linkedin", "github", "portfolio"] as const).map((k) => (
                  <div key={k} className="space-y-2">
                    <Label htmlFor={k}>{k === "linkedin" ? "LinkedIn" : k === "github" ? "GitHub" : "Portfolio"} <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id={k} type="url" value={d.links[k]} onChange={(e) => set("links", { ...d.links, [k]: e.target.value })} placeholder="https://" />
                  </div>
                ))}
              </div>
              {!d.cvId ? <p className="text-sm text-muted-foreground">No CV right now? Skip this step and add it later from your profile. Matching works from the skills you pick.</p> : null}
            </Question>
          )}

          {step === "roles" && (
            <Question eyebrow="Roles" title="What kind of internship are you after?" hint="Pick up to 5, most wanted first. The first one is searched by default; you can switch between them on the listings page.">
              {ROLE_DOMAINS.map((domain) => (
                <div key={domain} className="space-y-2">
                  <div className="form-caption">{domain}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLES.filter((r) => r.domain === domain).map((r) => {
                      const rank = d.roles.indexOf(r.id);
                      return (
                        <OptionCard
                          key={r.id}
                          selected={rank !== -1}
                          onClick={() => toggleRole(r.id)}
                          title={r.label}
                          badge={rank !== -1 ? <span className="font-mono text-[0.65rem] font-semibold text-stamp tabular">#{rank + 1}</span> : null}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="custom-role">Not listed? Add your own</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-role"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customRole.trim()) {
                        toggleRole(`custom:${customRole.trim()}`);
                        setCustomRole("");
                      }
                    }}
                    placeholder="e.g. Game development"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={!customRole.trim()}
                    onClick={() => {
                      toggleRole(`custom:${customRole.trim()}`);
                      setCustomRole("");
                    }}
                  >
                    Add role
                  </Button>
                </div>
                {d.roles.filter((r) => r.startsWith("custom:")).length ? (
                  <div className="flex flex-wrap gap-2">
                    {d.roles
                      .filter((r) => r.startsWith("custom:"))
                      .map((r) => (
                        <OptionCard key={r} selected onClick={() => toggleRole(r)} title={getRole(r).label} badge={<span className="font-mono text-[0.65rem] font-semibold text-stamp">#{d.roles.indexOf(r) + 1}</span>} />
                      ))}
                  </div>
                ) : null}
              </div>
            </Question>
          )}

          {step === "skills" && (
            <Question
              eyebrow="Skills"
              title="Which skills can you show on a project or in an interview?"
              hint={cvSkills.length ? "Skills from your CV are already added. Remove anything you would not want to be tested on." : "Add at least 3. Listings that ask for these rank higher."}
            >
              <ChipPicker
                label="Skills"
                value={d.skills}
                onChange={(skills) => set("skills", dedupeSkills(skills))}
                options={SKILL_NAMES}
                suggestions={roleSkillSuggestions}
                placeholder="Type a skill, e.g. React"
              />
              {roleSkillSuggestions.some((s) => !d.skills.includes(s)) ? (
                <p className="-mt-3 text-xs text-muted-foreground">Dashed chips are common for the roles you picked. Tap to add.</p>
              ) : null}
            </Question>
          )}

          {step === "prefs" && (
            <Question eyebrow="Preferences" title="Where, when and for how much?" hint="These rank listings rather than hide them, so you still see a great match that pays a little less.">
              <div className="space-y-2">
                <div className="text-sm font-medium">Where do you want to work?</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["remote", "Remote", "From home"],
                      ["hybrid", "Hybrid", "Some office days"],
                      ["onsite", "In office", "Full time on site"],
                      ["any", "Any", "Show me all"],
                    ] as const
                  ).map(([v, t, h]) => (
                    <OptionCard key={v} selected={d.workMode === v} onClick={() => set("workMode", v)} title={t} hint={h} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Country</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                    <OptionCard selected={d.region === "india"} onClick={() => set("region", "india")} title="India" />
                    <OptionCard selected={d.region === "abroad"} onClick={() => set("region", "abroad")} title="Abroad" />
                  </div>
                  {d.region === "abroad" ? (
                    <Select value={d.country} onValueChange={(v) => set("country", v)}>
                      <SelectTrigger className="h-11! w-48" aria-label="Country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>

              {d.region === "india" && d.workMode !== "remote" ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Cities you can work from{" "}
                    <span className="font-normal text-muted-foreground">{d.workMode === "any" ? "(optional, up to 5)" : "(up to 5, first one is searched)"}</span>
                  </div>
                  <ChipPicker label="Cities" value={d.cities} onChange={(cities) => set("cities", cities)} options={CITIES} suggestions={d.cities.length ? [] : CITIES.slice(0, 6)} max={5} placeholder="e.g. Bangalore" />
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-medium">Lowest monthly stipend you would take</div>
                  <div className="font-mono text-sm font-semibold tabular">{d.minStipend === 0 ? "Any, even unpaid" : rupees(d.minStipend)}</div>
                </div>
                <Slider value={[d.minStipend]} min={0} max={50000} step={1000} onValueChange={([v]) => set("minStipend", v ?? 0)} aria-label="Minimum monthly stipend" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Longest internship you can do</Label>
                  <Select value={d.maxDuration ? String(d.maxDuration) : "any"} onValueChange={(v) => set("maxDuration", v === "any" ? null : Number(v))}>
                    <SelectTrigger id="duration" className="h-10! w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">No limit</SelectItem>
                      {[1, 2, 3, 6].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} {m === 1 ? "month" : "months"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="from">Available from</Label>
                  <Input id="from" type="month" value={d.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} className="h-10" />
                </div>
              </div>

              <div className="divide-y rounded-lg border bg-card">
                <label className="flex items-center justify-between gap-4 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">Part-time is fine</span>
                    <span className="block text-xs text-muted-foreground">Useful alongside classes</span>
                  </span>
                  <Switch checked={d.partTime} onCheckedChange={(v) => set("partTime", v)} />
                </label>
                <label className="flex items-center justify-between gap-4 px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">Also show full-time jobs</span>
                    <span className="block text-xs text-muted-foreground">
                      {isFinalYear(d.degree, d.year) ? "On by default for final year and graduates" : "Usually for final year and graduates"}
                    </span>
                  </span>
                  <Switch checked={d.wantsJobs} onCheckedChange={(v) => set("wantsJobs", v)} />
                </label>
              </div>
            </Question>
          )}

          {step === "review" && (
            <Question eyebrow="Review" title={editing ? "Your answers" : "Check your answers"} hint="Edit anything that looks off. You can change all of this later from your profile.">
              <dl className="divide-y rounded-xl border bg-card">
                {[
                  { at: 1, label: "You", value: `${d.name || "—"} · ${d.status === "student" ? "College student" : d.status === "graduate" ? "Recent graduate" : "Switching fields"}` },
                  { at: 2, label: "College", value: [d.college, [d.degree, d.branch].filter(Boolean).join(", "), YEARS.find((y) => y.value === d.year)?.label, d.gradYear ? `graduating ${d.gradYear}` : ""].filter(Boolean).join(" · ") || "—" },
                  { at: 0, label: "CV", value: currentCv ? `${currentCv.name} (${currentCv.skills.length} skills found)` : "Not added" },
                  { at: 3, label: "Roles", value: d.roles.map((r) => getRole(r).label).join(", ") || "—" },
                  { at: 4, label: "Skills", value: d.skills.join(", ") || "—" },
                  {
                    at: 5,
                    label: "Preferences",
                    value: [
                      { remote: "Remote", hybrid: "Hybrid", onsite: "In office", any: "Any work mode" }[d.workMode],
                      d.region === "abroad" ? COUNTRIES.find((c) => c.code === d.country)?.label : d.cities.join(", ") || "Anywhere in India",
                      d.minStipend ? `from ${rupees(d.minStipend)}/month` : "any stipend",
                      d.maxDuration ? `up to ${d.maxDuration} months` : null,
                      d.wantsJobs ? "jobs included" : "internships only",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  },
                ].map((row) => {
                  const bad = stepError(STEPS[row.at]!.id, d);
                  return (
                    <div key={row.label} className="grid grid-cols-[6.5rem_1fr_auto] items-start gap-3 px-4 py-3">
                      <dt className="form-caption pt-0.5">{row.label}</dt>
                      <dd className="min-w-0 text-sm">
                        <span className="line-clamp-3">{row.value}</span>
                        {bad ? <span className="mt-1 block text-xs text-destructive">{bad}</span> : null}
                      </dd>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => go(row.at)} aria-label={`Edit ${row.label}`}>
                        <Pencil />
                      </Button>
                    </div>
                  );
                })}
              </dl>
            </Question>
          )}

          {showError && error ? (
            <p role="alert" className="mt-5 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-10 space-y-3">
            <div className="form-caption">Your card, filled in as you answer</div>
            <StudentCard profile={{ ...d, year: d.year ?? undefined, gradYear: d.gradYear ?? undefined }} className="rotate-[1.2deg]" />
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="lg" onClick={() => go(stepIndex - 1)} disabled={stepIndex === 0}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex items-center gap-2">
            {step === "cv" && !d.cvId ? (
              <Button type="button" variant="ghost" size="lg" onClick={() => go(stepIndex + 1)}>
                Skip for now
              </Button>
            ) : null}
            <Button type="button" size="lg" onClick={next} className="min-w-36 px-4">
              {step === "review" ? (
                <>
                  <Check /> {editing ? "Save changes" : "Save and find internships"}
                </>
              ) : (
                <>
                  Continue <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
