import { daysUntil } from "./format";
import type { Application } from "./types";

export type Reminder = {
  key: string;
  kind: "deadline" | "next" | "followup";
  date: string; // YYYY-MM-DD
  title: string;
  detail: string;
  app: Application;
};

const FOLLOW_UP_AFTER_DAYS = 7;

const addDays = (iso: string, n: number) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Everything worth a nudge: deadlines for saved listings, scheduled next steps, and follow-ups after a week of silence. */
export function reminders(apps: Application[]): Reminder[] {
  const out: Reminder[] = [];
  for (const a of apps) {
    if (a.status === "saved" && a.deadline && (daysUntil(a.deadline) ?? -1) >= 0) {
      out.push({ key: `deadline:${a.id}:${a.deadline}`, kind: "deadline", date: a.deadline, title: `Apply: ${a.title}`, detail: `${a.company} closes applications`, app: a });
    }
    if (a.nextStepOn && a.status !== "rejected" && (daysUntil(a.nextStepOn) ?? -1) >= 0) {
      out.push({ key: `next:${a.id}:${a.nextStepOn}`, kind: "next", date: a.nextStepOn, title: a.nextStep || "Next step", detail: `${a.title} at ${a.company}`, app: a });
    }
    if (a.status === "applied" && !(a.nextStepOn && (daysUntil(a.nextStepOn) ?? -1) >= 0)) {
      const last = a.history[a.history.length - 1]?.at ?? a.appliedOn ?? a.createdAt;
      const due = addDays(last, FOLLOW_UP_AFTER_DAYS);
      out.push({ key: `followup:${a.id}:${due}`, kind: "followup", date: due, title: `Follow up with ${a.company}`, detail: `No reply on ${a.title} for a week`, app: a });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

/* ------------------------------- calendar ------------------------------- */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: string) => d.replace(/-/g, "");

/** RFC 5545 lines must be folded at 75 octets. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** An all-day calendar event with alerts at 9 am the day before and 9 am on the day. */
export function toIcs(items: Reminder[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Internship Buddy//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const r of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.key.replace(/[^A-Za-z0-9:-]/g, "")}@internship-buddy`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(r.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(r.date, 1))}`,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(`${r.detail}${r.app.url ? `\n${r.app.url}` : ""}${r.app.notes ? `\n\nNotes: ${r.app.notes}` : ""}`)}`,
      ...(r.app.url ? [`URL:${r.app.url}`] : []),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(items: Reminder[], filename: string) {
  const url = URL.createObjectURL(new Blob([toIcs(items)], { type: "text/calendar;charset=utf-8" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarLink(r: Reminder) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: r.title,
    dates: `${ymd(r.date)}/${ymd(addDays(r.date, 1))}`,
    details: `${r.detail}${r.app.url ? `\n${r.app.url}` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
