"use client";

import { Check, Copy, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MatchMeter } from "@/components/discover/listing-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { profileBrief, useAiResult } from "@/lib/ai-client";
import type { CvReview } from "@/lib/ai-types";
import { shortDate } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import { getRole } from "@/lib/taxonomy";
import type { CvVersion } from "@/lib/types";

function List({ title, items, icon }: { title: string; items: string[]; icon?: "ok" | "warn" }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="form-caption">{title}</h3>
      <ul className="space-y-1 text-sm">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            {icon === "ok" ? <Check className="mt-0.5 size-4 shrink-0 text-offer" /> : icon === "warn" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-marigold" /> : <span className="mt-2 size-1 shrink-0 rounded-full bg-foreground/50" />}
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CvReviewDialog({ cv, open, onOpenChange }: { cv: CvVersion; open: boolean; onOpenChange: (o: boolean) => void }) {
  const profile = useAppStore((s) => s.profile)!;
  const [roleId, setRoleId] = useState(profile.roles[0]!);
  const review = useAiResult<CvReview>(`cv-review:${cv.id}:${roleId}`, "cv-review");
  const r = review.data;
  const role = getRole(roleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-5">
          <DialogTitle className="font-display-wide text-xl font-extrabold">CV review</DialogTitle>
          <DialogDescription>
            {cv.label} · {cv.name}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Review it for</span>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger size="sm" className="min-w-48" aria-label="Target role">
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
            <Button
              size="sm"
              disabled={review.loading || cv.text.length < 200}
              onClick={() => review.run({ cv: cv.text, role: role.label, profile: profileBrief(profile).slice(0, 1200) })}
            >
              {review.loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {r ? "Review again" : "Review my CV"}
            </Button>
          </div>
          {cv.text.length < 200 ? (
            <p className="pt-2 text-xs text-destructive">Only a short preview of this CV is stored. Upload it again to review it.</p>
          ) : null}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-5 p-5">
            {review.error ? <p className="text-sm text-destructive">{review.error}</p> : null}
            {review.loading && !r ? (
              <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading your CV like a {role.label} recruiter would…
              </div>
            ) : null}
            {!r && !review.loading ? (
              <p className="py-6 text-sm text-muted-foreground">
                Get a score, missing keywords, sharper bullet points and fixes for {role.label} internships.
              </p>
            ) : null}
            {r ? (
              <>
                <div className="flex items-center gap-4">
                  <MatchMeter score={Math.max(0, Math.min(100, r.score))} size={64} />
                  <div className="min-w-0">
                    <div className="font-semibold">Ready for {role.label}?</div>
                    <p className="text-sm text-muted-foreground">{r.verdict}</p>
                    {review.at ? <p className="font-mono text-[0.68rem] text-muted-foreground">Reviewed {shortDate(review.at)}</p> : null}
                  </div>
                </div>
                <List title="What works" items={r.strengths} icon="ok" />
                {r.missingKeywords.length ? (
                  <section className="space-y-1.5">
                    <h3 className="form-caption">Missing keywords</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {r.missingKeywords.map((k) => (
                        <span key={k} className="rounded-md border border-marigold/50 bg-marigold-soft px-2 py-0.5 text-sm">
                          {k}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}
                {r.rewrites.length ? (
                  <section className="space-y-2">
                    <h3 className="form-caption">Sharper bullet points</h3>
                    {r.rewrites.map((w, i) => (
                      <div key={i} className="space-y-1.5 rounded-lg border p-3 text-sm">
                        <p className="text-muted-foreground line-through decoration-muted-foreground/40">{w.before}</p>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{w.after}</p>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Copy rewritten bullet"
                            onClick={() => navigator.clipboard.writeText(w.after).then(() => toast.success("Copied"))}
                          >
                            <Copy />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{w.why}</p>
                      </div>
                    ))}
                  </section>
                ) : null}
                <List title="Sections to add" items={r.addSections} />
                <List title="Fixes" items={r.fixes} icon="warn" />
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
