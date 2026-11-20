"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, GripVertical, MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Stamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { daysUntil, dueText, shortDate } from "@/lib/format";
import { slamStamp } from "@/lib/motion";
import { STATUS_META } from "@/lib/taxonomy";
import { APP_STATUSES, type Application, type AppStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppCard({
  app,
  onOpen,
  onMove,
  overlay = false,
  stampNow = 0,
}: {
  app: Application;
  onOpen?: () => void;
  onMove?: (s: AppStatus) => void;
  overlay?: boolean;
  /** Changes whenever this card has just been moved, so the stamp comes down even after the card remounts in its new column. */
  stampNow?: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id, disabled: overlay });
  const sheet = useRef<HTMLDivElement | null>(null);
  const stamp = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (stampNow && Date.now() - stampNow < 1500 && stamp.current) slamStamp(stamp.current, sheet.current);
  }, [stampNow]);

  const meta = STATUS_META[app.status];
  const upcoming =
    app.nextStepOn && (daysUntil(app.nextStepOn) ?? -1) >= 0
      ? { text: `${app.nextStep || "Next step"} ${dueText(app.nextStepOn)}`, soon: (daysUntil(app.nextStepOn) ?? 99) <= 2 }
      : app.status === "saved" && app.deadline && (daysUntil(app.deadline) ?? -1) >= 0
        ? { text: `Apply by ${shortDate(app.deadline)} (${dueText(app.deadline)})`, soon: (daysUntil(app.deadline) ?? 99) <= 3 }
        : null;

  return (
    <div
      ref={(n) => {
        setNodeRef(n);
        sheet.current = n;
      }}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-[0_1px_0_rgba(24,32,58,0.05)] transition-shadow",
        isDragging && "opacity-30",
        overlay && "rotate-2 shadow-xl ring-1 ring-stamp/40",
      )}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          aria-label={`Drag ${app.title} to another column`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <CompanyLogo src={app.logo} name={app.company} className="size-8" />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left outline-none focus-visible:underline">
          <div className="line-clamp-2 text-sm leading-snug font-semibold">{app.title}</div>
          <div className="truncate text-xs text-muted-foreground">{app.company}</div>
        </button>
        {onMove ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="-mr-1 opacity-60 group-hover:opacity-100" aria-label={`Move ${app.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {APP_STATUSES.filter((s) => s !== app.status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                  <span className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                  {STATUS_META[s].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpen}>Edit details</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0 space-y-0.5 text-[0.7rem]">
          {upcoming ? (
            <div className={cn("flex items-center gap-1", upcoming.soon ? "font-medium text-reject" : "text-muted-foreground")}>
              <CalendarClock className="size-3 shrink-0" />
              <span className="truncate">{upcoming.text}</span>
            </div>
          ) : null}
          <div className="font-mono text-muted-foreground">
            {app.appliedOn && app.status !== "saved" ? `Applied ${shortDate(app.appliedOn)}` : `Added ${shortDate(app.createdAt)}`}
          </div>
        </div>
        {app.status !== "saved" ? (
          <Stamp ref={stamp} size="sm" color={meta.color}>
            {meta.stamp}
          </Stamp>
        ) : (
          <span ref={stamp} />
        )}
      </div>
    </div>
  );
}
