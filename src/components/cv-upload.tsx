"use client";

import { animate } from "animejs";
import { FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { reducedMotion } from "@/lib/motion";
import { saveCvFile } from "@/lib/store";
import type { CvMeta, CvParseResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** A sheet being read: a highlighter line sweeps down the page while the CV is parsed. */
function ReadingSheet() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bar.current || reducedMotion()) return;
    const a = animate(bar.current, { y: [0, 52], duration: 900, ease: "inOut(2)", loop: true, alternate: true });
    return () => {
      a.revert();
    };
  }, []);
  return (
    <div className="relative h-16 w-12 overflow-hidden rounded-sm border bg-card shadow-sm" aria-hidden>
      <div className="space-y-1.5 p-2">
        {[80, 60, 90, 70, 50, 85].map((w, i) => (
          <div key={i} className="h-0.5 rounded bg-muted-foreground/30" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div ref={bar} className="absolute inset-x-0 top-1 h-2 bg-marigold/40" />
    </div>
  );
}

export function CvUpload({
  cv,
  onParsed,
  onRemove,
}: {
  cv: CvMeta | null;
  onParsed: (meta: CvMeta, result: CvParseResult) => void;
  onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is over 5 MB. Export a smaller PDF and try again.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/cv", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "This file could not be read.");
      const result = data as CvParseResult;
      await saveCvFile(file);
      onParsed(
        {
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
          skills: result.skills,
          wordCount: result.wordCount,
          preview: result.text.slice(0, 600),
        },
        result,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "This file could not be read.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => handle(e.target.files?.[0])}
    />
  );

  if (cv && !busy) {
    return (
      <div className="rounded-xl border bg-card p-4">
        {picker}
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-stamp-soft text-stamp">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{cv.name}</div>
            <div className="font-mono text-xs text-muted-foreground tabular">
              {kb(cv.size)} · {cv.wordCount} words · {cv.skills.length} skills found
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
              <RefreshCw /> Replace
            </Button>
            {onRemove ? (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove CV">
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {picker}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card/60 px-6 py-10 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          dragging ? "border-stamp bg-stamp-soft" : "hover:border-stamp/60",
          busy && "cursor-progress",
        )}
      >
        {busy ? (
          <>
            <ReadingSheet />
            <span className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" /> Reading your CV…
            </span>
          </>
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-stamp-soft text-stamp">
              <Upload className="size-5" />
            </span>
            <span className="font-medium">Drop your CV here, or choose a file</span>
            <span className="max-w-sm text-sm text-muted-foreground">PDF, DOCX or TXT, up to 5 MB.</span>
          </>
        )}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
