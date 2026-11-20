"use client";

import { useState } from "react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Company logo with an initials fallback for boards that do not send one (LinkedIn, broken URLs). */
export function CompanyLogo({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card", className);
  if (!src || failed) {
    return (
      <div aria-hidden className={cn(base, "bg-secondary font-mono text-xs font-semibold text-muted-foreground")}>
        {initials(name)}
      </div>
    );
  }
  return (
    <div aria-hidden className={base}>
      {/* Logos come from many third-party hosts, so a plain img avoids configuring each domain. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="size-full object-contain p-1" onError={() => setFailed(true)} />
    </div>
  );
}
