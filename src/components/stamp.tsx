import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Speckle mask so the stamp reads as ink pressed onto paper rather than a flat label. */
const INK_MASK =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.05'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

type StampProps = {
  children: React.ReactNode;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  sub?: string;
};

export const Stamp = forwardRef<HTMLSpanElement, StampProps>(function Stamp(
  { children, color = "var(--stamp)", size = "md", className, sub },
  ref,
) {
  return (
    <span
      ref={ref}
      aria-label={typeof children === "string" ? children : undefined}
      className={cn(
        "font-stamp pointer-events-none inline-flex shrink-0 -rotate-[7deg] flex-col items-center justify-center rounded-[4px] border-[2.5px] leading-none select-none",
        size === "sm" && "px-1.5 py-1 text-[0.7rem]",
        size === "md" && "px-2.5 py-1.5 text-sm",
        size === "lg" && "border-[3.5px] px-4 py-2.5 text-3xl",
        className,
      )}
      style={{
        color,
        borderColor: color,
        boxShadow: `inset 0 0 0 1.5px var(--card), inset 0 0 0 ${size === "lg" ? 3 : 2.5}px ${color}`,
        WebkitMaskImage: INK_MASK,
        maskImage: INK_MASK,
        WebkitMaskSize: "140px 140px",
        maskSize: "140px 140px",
      }}
    >
      <span>{children}</span>
      {sub ? <span className="mt-1 font-mono text-[0.5em] tracking-normal normal-case opacity-80">{sub}</span> : null}
    </span>
  );
});
