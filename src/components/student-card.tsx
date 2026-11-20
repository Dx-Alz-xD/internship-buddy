import { FileCheck2, FileX2 } from "lucide-react";
import { initials } from "@/lib/format";
import { getRole, YEARS } from "@/lib/taxonomy";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic barcode, like the strip on the back of a college ID. */
function Barcode({ seed }: { seed: string }) {
  let h = hash(seed || "internship-buddy");
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 150) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const w = 1 + (h % 3);
    bars.push({ x, w });
    x += w + 1 + ((h >>> 4) % 3);
  }
  return (
    <svg viewBox="0 0 150 28" className="h-7 w-[150px] text-foreground/80" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={28} fill="currentColor" />
      ))}
    </svg>
  );
}

function Field({ label, value, placeholder, className }: { label: string; value?: string; placeholder: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="form-caption">{label}</div>
      <div
        className={cn(
          "truncate border-b border-dashed pb-0.5 text-sm transition-colors",
          value ? "font-medium text-foreground" : "text-muted-foreground/60 italic",
        )}
      >
        {value || placeholder}
      </div>
    </div>
  );
}

export function StudentCard({ profile, className }: { profile: Partial<Profile>; className?: string }) {
  const year = YEARS.find((y) => y.value === profile.year);
  const programme = [profile.degree, profile.branch].filter(Boolean).join(" · ");
  const roles = (profile.roles ?? []).map((r) => getRole(r).label);
  const skills = profile.skills ?? [];
  const idNo = (hash(`${profile.name ?? ""}${profile.college ?? ""}`) % 900000) + 100000;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-[0_1px_0_rgba(24,32,58,0.04),0_12px_32px_-12px_rgba(24,32,58,0.25)]",
        className,
      )}
    >
      <div className="flex items-center justify-between bg-ink px-4 py-2 text-[0.65rem] text-background">
        <span className="font-stamp tracking-[0.2em]">Student card</span>
        <span className="font-mono tabular opacity-80">No. {idNo}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 p-4">
        <div className="flex size-[72px] items-center justify-center rounded-md border-2 border-dashed border-stamp/40 bg-stamp-soft font-display-wide text-2xl font-extrabold text-stamp">
          {profile.name ? initials(profile.name) : "?"}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="form-caption">Name</div>
          <div className={cn("-mt-1.5 truncate font-display-wide text-xl leading-tight font-extrabold", !profile.name && "text-muted-foreground/50")}>
            {profile.name || "Your name"}
          </div>
          <Field label="College" value={profile.college} placeholder="Where you study" />
        </div>

        <Field className="col-span-2" label="Programme" value={programme} placeholder="Degree and branch" />
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <Field label="Year" value={year?.label} placeholder="Which year" />
          <Field label="Graduates" value={profile.gradYear ? String(profile.gradYear) : undefined} placeholder="Year" />
        </div>
        <Field
          className="col-span-2"
          label="Looking for"
          value={roles.length ? roles.slice(0, 3).join(", ") + (roles.length > 3 ? ` +${roles.length - 3}` : "") : undefined}
          placeholder="Roles you want"
        />
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-dashed px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            {profile.cv ? (
              <FileCheck2 className="size-3.5 text-offer" />
            ) : (
              <FileX2 className="size-3.5 text-muted-foreground" />
            )}
            <span className={profile.cv ? "text-foreground" : "text-muted-foreground"}>
              {profile.cv ? "CV on file" : "No CV yet"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[0.7rem] text-muted-foreground tabular">{skills.length} skills</span>
          </div>
          <Barcode seed={`${profile.name ?? ""}|${profile.college ?? ""}`} />
        </div>
        {profile.year ? (
          <span className="font-stamp -rotate-6 rounded-sm border-2 border-marigold px-1.5 py-0.5 text-[0.65rem] text-marigold">
            {profile.year === "grad" ? "Alumni" : `Batch ${profile.gradYear ?? ""}`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
