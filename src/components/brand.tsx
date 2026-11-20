import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-stamp inline-flex size-8 -rotate-6 items-center justify-center rounded-[5px] border-2 border-stamp text-[0.8rem] text-stamp",
        className,
      )}
      style={{ boxShadow: "inset 0 0 0 1.5px var(--background), inset 0 0 0 2.5px var(--stamp)" }}
    >
      IB
    </span>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      <BrandMark className="transition-transform group-hover:rotate-0" />
      <span className="font-display-wide text-[1.05rem] font-extrabold tracking-tight">Internship Buddy</span>
    </Link>
  );
}
