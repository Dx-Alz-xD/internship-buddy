"use client";

import { Plus, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ChipPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options: string[];
  /** Shown first as one-tap chips (e.g. skills found in the CV). */
  suggestions?: string[];
  placeholder?: string;
  max?: number;
  allowCustom?: boolean;
  normalise?: (s: string) => string;
  label: string;
};

/** Pick several items from a list, or type your own. Keyboard: type, Enter adds, Backspace removes the last. */
export function ChipPicker({
  value,
  onChange,
  options,
  suggestions = [],
  placeholder = "Type to search",
  max,
  allowCustom = true,
  normalise = (s) => s.trim(),
  label,
}: ChipPickerProps) {
  const [text, setText] = useState("");
  const listId = useId();
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const full = max != null && value.length >= max;

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return options
      .filter((o) => !value.some((v) => v.toLowerCase() === o.toLowerCase()))
      .filter((o) => o.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
      .slice(0, 8);
  }, [text, options, value]);

  const add = (raw: string) => {
    const s = normalise(raw);
    if (!s || has(s) || full) return;
    onChange([...value, s]);
    setText("");
  };
  const remove = (s: string) => onChange(value.filter((v) => v !== s));

  const pending = suggestions.filter((s) => !has(s));
  const exact = matches.find((m) => m.toLowerCase() === text.trim().toLowerCase());

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        )}
      >
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-stamp-soft py-0.5 pr-1 pl-2 text-sm font-medium text-stamp">
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="rounded p-0.5 hover:bg-stamp/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Remove ${v}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          aria-label={label}
          aria-controls={listId}
          value={text}
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (exact) add(exact);
              else if (matches[0] && !allowCustom) add(matches[0]);
              else if (allowCustom && text.trim()) add(text);
              else if (matches[0]) add(matches[0]);
            } else if (e.key === "Backspace" && !text && value.length) {
              remove(value[value.length - 1]!);
            }
          }}
          placeholder={full ? `Up to ${max}` : value.length ? "Add another" : placeholder}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {text.trim() && !full ? (
        <div id={listId} role="listbox" aria-label={`${label} matches`} className="flex flex-wrap gap-1.5">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => add(m)}
              className="rounded-md border bg-card px-2 py-1 text-sm hover:border-stamp hover:text-stamp focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {m}
            </button>
          ))}
          {allowCustom && !exact ? (
            <button
              type="button"
              onClick={() => add(text)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-sm text-muted-foreground hover:border-stamp hover:text-stamp focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-3.5" /> Add “{text.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}

      {pending.length && !full ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {pending.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed bg-transparent px-2 py-1 text-sm text-muted-foreground transition-colors hover:border-stamp hover:bg-stamp-soft hover:text-stamp focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Plus className="size-3.5" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
