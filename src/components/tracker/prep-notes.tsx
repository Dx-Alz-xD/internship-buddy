"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shortDate } from "@/lib/format";
import { companyKey, uid, useAppStore } from "@/lib/store";

const ROUNDS = ["HR", "Technical", "Managerial", "Assignment", "Other"];

/** Notes and a question bank per company, shared by every application to that company. */
export function PrepNotes({ company }: { company: string }) {
  const prep = useAppStore((s) => s.prep[companyKey(company)]);
  const savePrep = useAppStore((s) => s.savePrep);
  const others = useAppStore((s) => s.applications.filter((a) => companyKey(a.company) === companyKey(company)).length);
  const [notes, setNotes] = useState(prep?.notes ?? "");
  const [q, setQ] = useState("");
  const [round, setRound] = useState("Technical");
  const [open, setOpen] = useState<string | null>(null);
  const questions = prep?.questions ?? [];

  const setQuestions = (next: typeof questions) => savePrep(company, { questions: next });

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="prep-notes" className="text-sm font-medium">
            About {company}
          </label>
          {prep?.updatedAt ? <span className="font-mono text-[0.68rem] text-muted-foreground">saved {shortDate(prep.updatedAt)}</span> : null}
        </div>
        <Textarea
          id="prep-notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (prep?.notes ?? "") && savePrep(company, { notes })}
          placeholder="What they build, their tech stack, recent news, who you spoke to, why you want to work there"
        />
        <p className="text-xs text-muted-foreground">
          Shared by {others > 1 ? `all ${others} of your applications` : "every application"} to {company}.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Interview questions</div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            const id = uid();
            setQuestions([...questions, { id, q: q.trim(), a: "", round, practised: false }]);
            setQ("");
            setOpen(id);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A question you were asked or expect" aria-label="New question" className="min-w-48 flex-1" />
          <Select value={round} onValueChange={setRound}>
            <SelectTrigger className="w-32" aria-label="Round">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUNDS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" disabled={!q.trim()}>
            <Plus /> Add
          </Button>
        </form>

        {questions.length ? (
          <ul className="divide-y rounded-lg border">
            {questions.map((item) => (
              <li key={item.id} className="space-y-2 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    checked={item.practised}
                    onCheckedChange={(v) => setQuestions(questions.map((x) => (x.id === item.id ? { ...x, practised: !!v } : x)))}
                    aria-label="Practised"
                    className="mt-0.5"
                  />
                  <button type="button" className="min-w-0 flex-1 text-left text-sm outline-none focus-visible:underline" onClick={() => setOpen(open === item.id ? null : item.id)}>
                    <span className={item.practised ? "text-muted-foreground line-through" : "font-medium"}>{item.q}</span>
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{item.round}</span>
                    {item.a && open !== item.id ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.a}</span> : null}
                  </button>
                  <Button variant="ghost" size="icon-xs" aria-label="Delete question" onClick={() => setQuestions(questions.filter((x) => x.id !== item.id))}>
                    <Trash2 />
                  </Button>
                </div>
                {open === item.id ? (
                  <Textarea
                    rows={4}
                    defaultValue={item.a}
                    onBlur={(e) => e.target.value !== item.a && setQuestions(questions.map((x) => (x.id === item.id ? { ...x, a: e.target.value } : x)))}
                    placeholder="Your answer, in bullet points you can glance at before the call"
                    aria-label={`Answer to: ${item.q}`}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Add questions as you hear about them from seniors, Glassdoor or your own rounds, then tick them off once practised.</p>
        )}
      </div>
    </div>
  );
}
