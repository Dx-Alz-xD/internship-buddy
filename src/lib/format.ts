import type { Pay } from "./types";

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", GBP: "£", EUR: "€", SGD: "S$", CAD: "C$", AUD: "A$", AED: "AED " };
const PER: Record<string, string> = { monthly: "/month", yearly: "/year", hourly: "/hour", weekly: "/week", daily: "/day" };

const compact = (n: number, currency: string | null) =>
  currency === "INR"
    ? n >= 100000
      ? `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`
      : n.toLocaleString("en-IN")
    : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : String(n);

export function formatPay(pay: Pay | null): string | null {
  if (!pay) return null;
  if (pay.unpaid) return "Unpaid";
  if (pay.label) return pay.label;
  if (pay.min == null && pay.max == null) return null;
  const sym = SYMBOL[pay.currency ?? ""] ?? "";
  const range =
    pay.min != null && pay.max != null && pay.min !== pay.max
      ? `${compact(pay.min, pay.currency)} – ${compact(pay.max, pay.currency)}`
      : compact((pay.max ?? pay.min) as number, pay.currency);
  return `${sym}${range}${PER[pay.period ?? ""] ?? ""}`;
}

/** Monthly stipend in rupees, when the listing gives enough to work it out. */
export function monthlyInr(pay: Pay | null): number | null {
  if (!pay || pay.unpaid) return pay?.unpaid ? 0 : null;
  if (pay.currency && pay.currency !== "INR") return null;
  const v = pay.max ?? pay.min;
  if (v == null) return null;
  if (pay.period === "monthly") return v;
  if (pay.period === "yearly") return Math.round(v / 12);
  return null;
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const DAY = 86_400_000;

export function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / DAY)) : null;
}

export function postedText(label: string | null, iso: string | null): string | null {
  const d = daysAgo(iso);
  if (d == null) return label;
  if (d === 0) return "Posted today";
  if (d === 1) return "Posted yesterday";
  if (d < 30) return `Posted ${d} days ago`;
  return label ? `Posted ${label}` : `Posted ${Math.floor(d / 30)} mo ago`;
}

/** Whole days from today to a YYYY-MM-DD or ISO date; negative when it has passed. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / DAY);
}

export function dueText(date: string | null): string | null {
  const d = daysUntil(date);
  if (d == null) return null;
  if (d < -1) return `${-d} days ago`;
  if (d === -1) return "yesterday";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

export function shortDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function initials(name: string) {
  return (
    name
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}
