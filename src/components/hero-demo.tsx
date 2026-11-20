"use client";

import { createTimeline } from "animejs";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { Stamp } from "@/components/stamp";
import { reducedMotion } from "@/lib/motion";
import { STATUS_META } from "@/lib/taxonomy";

const SEQUENCE = ["applied", "assessment", "interview", "offer"] as const;
// Where each stamp lands inside the "for office use" box.
const POSITIONS = [
  { left: "4%", top: "8%", rotate: -9 },
  { left: "34%", top: "40%", rotate: -4 },
  { left: "8%", top: "52%", rotate: -12 },
  { left: "26%", top: "12%", rotate: -6 },
];
const DATES = ["3 Dec", "9 Dec", "16 Dec", "23 Dec"];

/** An application form getting stamped at each stage, from applied to offer. Loops. */
export function HeroDemo() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stamps = Array.from(el.querySelectorAll<HTMLElement>("[data-stamp]"));
    const sheet = el.querySelector<HTMLElement>("[data-sheet]");
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-row]"));
    if (reducedMotion()) {
      stamps.forEach((s) => (s.style.opacity = "1"));
      rows.forEach((r) => (r.style.opacity = "1"));
      return;
    }
    const tl = createTimeline({ loop: true, loopDelay: 1600 });
    stamps.forEach((s, i) => {
      const rot = POSITIONS[i]!.rotate;
      tl.add(s, { opacity: [0, 1], scale: [2.6, 1], rotate: [rot - 10, rot], duration: 320, ease: "in(3)" }, i === 0 ? 500 : "+=900");
      if (sheet) tl.add(sheet, { y: [{ to: 4, duration: 50 }, { to: -1, duration: 90 }, { to: 0, duration: 140 }] }, "-=20");
      tl.add(rows[i]!, { opacity: [0, 1], x: [-8, 0], duration: 300, ease: "out(3)" }, "-=220");
      // Earlier stamps fade back like older ink once a new one lands.
      if (i > 0) tl.add(stamps.slice(0, i), { opacity: 0.28, duration: 300 }, "-=300");
    });
    tl.add([...stamps, ...rows], { opacity: 0, duration: 400, ease: "out(2)" }, "+=1800");
    return () => {
      tl.revert();
    };
  }, []);

  return (
    <div ref={root} className="relative mx-auto w-full max-w-md select-none" aria-hidden>
      <div className="absolute inset-x-6 -bottom-3 h-full rotate-[3deg] rounded-xl border bg-card/60" />
      <div data-sheet className="relative overflow-hidden rounded-xl border bg-card shadow-[0_24px_48px_-24px_rgba(24,32,58,0.45)]">
        <div className="flex items-center justify-between border-b border-dashed px-5 py-3">
          <span className="form-caption">Application · tracked</span>
          <span className="font-mono text-[0.65rem] text-muted-foreground">#IB-2048</span>
        </div>
        <div className="space-y-4 px-5 pt-4 pb-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-ink font-display-wide text-sm font-extrabold text-background">KL</div>
            <div>
              <div className="font-semibold">Frontend Development Intern</div>
              <div className="text-sm text-muted-foreground">Kirana Labs</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="form-caption">Stipend</div>
              <div className="font-mono text-[0.8rem]">₹25,000/mo</div>
            </div>
            <div>
              <div className="form-caption">Duration</div>
              <div className="font-mono text-[0.8rem]">6 months</div>
            </div>
            <div>
              <div className="form-caption">Match</div>
              <div className="font-mono text-[0.8rem] text-marigold">92</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> Bangalore · Hybrid
          </div>
          <div className="grid grid-cols-[1fr_1.25fr] gap-4 border-t border-dashed pt-3">
            <div className="space-y-2">
              <div className="form-caption">History</div>
              {SEQUENCE.map((s, i) => (
                <div key={s} data-row className="flex items-center gap-2 text-xs opacity-0">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_META[s].color }} />
                  <span className="truncate font-medium">{STATUS_META[s].label}</span>
                  <span className="ml-auto font-mono text-muted-foreground">{DATES[i]}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="form-caption">For office use</div>
              <div className="relative mt-2 h-36 rounded-md border border-dashed bg-paper/60">
                {SEQUENCE.map((s, i) => (
                  <div key={s} data-stamp className="absolute opacity-0" style={{ left: POSITIONS[i]!.left, top: POSITIONS[i]!.top, transform: `rotate(${POSITIONS[i]!.rotate}deg)` }}>
                    <Stamp size="md" color={STATUS_META[s].color} className="rotate-0 text-lg" sub={DATES[i]}>
                      {STATUS_META[s].stamp}
                    </Stamp>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
