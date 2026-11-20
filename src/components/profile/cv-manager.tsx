"use client";

import { Download, FileText, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CvUpload } from "@/components/cv-upload";
import { CvReviewDialog } from "@/components/profile/cv-review-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortDate } from "@/lib/format";
import { dedupeSkills } from "@/lib/skills";
import { loadCvFile, removeCvFile, useAppStore } from "@/lib/store";
import type { CvVersion } from "@/lib/types";
import { cn } from "@/lib/utils";

async function download(cv: CvVersion) {
  const blob = await loadCvFile(cv.id);
  if (!blob) {
    toast.error("This file is not in this browser any more. Upload it again.");
    return;
  }
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: cv.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Several CVs (e.g. one for web roles, one for data roles); the main one drives matching and AI writing. */
export function CvManager() {
  const profile = useAppStore((s) => s.profile)!;
  const cvs = useAppStore((s) => s.cvs);
  const addCv = useAppStore((s) => s.addCv);
  const updateCv = useAppStore((s) => s.updateCv);
  const removeCv = useAppStore((s) => s.removeCv);
  const patchProfile = useAppStore((s) => s.patchProfile);
  const applications = useAppStore((s) => s.applications);
  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of applications) if (a.cvId) m[a.cvId] = (m[a.cvId] ?? 0) + 1;
    return m;
  }, [applications]);
  const [adding, setAdding] = useState(cvs.length === 0);
  const [label, setLabel] = useState("");
  const [reviewing, setReviewing] = useState<CvVersion | null>(null);

  return (
    <div className="space-y-3">
      {cvs.map((cv) => {
        const main = cv.id === profile.cvId;
        return (
          <div key={cv.id} className={cn("rounded-xl border p-3.5", main && "border-stamp/40 bg-stamp-soft/40")}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-stamp-soft text-stamp">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={cv.label}
                    onChange={(e) => updateCv(cv.id, { label: e.target.value })}
                    aria-label="CV name"
                    className="h-7 max-w-56 border-transparent bg-transparent px-1 font-semibold shadow-none hover:border-input focus-visible:border-ring"
                  />
                  {main ? <span className="font-stamp rounded-sm border-2 border-stamp px-1 text-[0.6rem] text-stamp">Main</span> : null}
                </div>
                <div className="px-1 font-mono text-[0.7rem] text-muted-foreground tabular">
                  {cv.name} · {cv.wordCount} words · {cv.skills.length} skills · added {shortDate(cv.uploadedAt)}
                  {usage[cv.id] ? ` · sent with ${usage[cv.id]} application${usage[cv.id] === 1 ? "" : "s"}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => setReviewing(cv)}>
                  <Sparkles /> Review
                </Button>
                {!main ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      patchProfile({ cvId: cv.id, skills: dedupeSkills([...profile.skills, ...cv.skills]) });
                      toast.success(`${cv.label} is now your main CV`);
                    }}
                  >
                    <Star /> Make main
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon-sm" onClick={() => download(cv)} aria-label={`Download ${cv.label}`}>
                  <Download />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${cv.label}`}
                  onClick={() => {
                    removeCv(cv.id);
                    void removeCvFile(cv.id);
                    toast(`${cv.label} deleted`);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="space-y-2 rounded-xl border border-dashed p-3.5">
          {cvs.length ? (
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this version, e.g. Data science CV" aria-label="New CV name" className="max-w-sm" />
          ) : null}
          <CvUpload
            cv={null}
            label={label.trim() || (cvs.length ? `CV ${cvs.length + 1}` : "Main CV")}
            emptyText={cvs.length ? "Drop another CV here, or choose a file" : "Drop your CV here, or choose a file"}
            onParsed={(cv) => {
              addCv(cv);
              const added = cv.skills.filter((s) => !profile.skills.some((p) => p.toLowerCase() === s.toLowerCase()));
              if (!profile.cvId) patchProfile({ cvId: cv.id, skills: dedupeSkills([...profile.skills, ...cv.skills]) });
              else if (added.length) patchProfile({ skills: dedupeSkills([...profile.skills, ...cv.skills]) });
              setAdding(false);
              setLabel("");
              toast.success(`Added ${cv.label}`, { description: added.length ? `New skills: ${added.slice(0, 5).join(", ")}` : undefined });
            }}
          />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Add another CV
        </Button>
      )}

      {reviewing ? <CvReviewDialog cv={reviewing} open onOpenChange={(o) => !o && setReviewing(null)} /> : null}
    </div>
  );
}
