import type { Listing, ListingDetails } from "./types";

export type ScamSignals = { level: "none" | "caution" | "high"; reasons: string[] };

/**
 * Cheap, rule-based warning signs for fake or exploitative internships, checked on every card
 * without any API call. The AI fit check adds a deeper read on top of this.
 */
const HIGH: [RegExp, string][] = [
  [/\b(registration|training|joining|enrol?ment|onboarding|processing|kit|certificate|security|course)\s*(fee|fees|charge|charges|deposit|amount)\b/i, "Mentions a fee or deposit you would have to pay"],
  [/\bpay\s*(?:₹|rs\.?|inr)\s*\d/i, "Asks you to pay money"],
  [/\brefundable\s+(deposit|amount|fee)/i, "Asks for a refundable deposit"],
  [/\b(investment|invest)\s+(required|needed)\b/i, "Asks for an investment"],
  [/\b(share|send)\s+(your\s+)?(bank|aadhaar|aadhar|pan)\s*(card|details|account)?/i, "Asks for bank or ID details up front"],
];

const CAUTION: [RegExp, string][] = [
  [/\b(whatsapp|telegram)\b/i, "Contact through WhatsApp or Telegram"],
  [/[a-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.com/i, "Recruiter uses a personal email address"],
  [/\b(earn|income)\s+(up\s*to\s+)?(₹|rs\.?|inr)?\s?\d[\d,]*\s*(\+\s*)?(per|\/|a)\s*(day|week)\b/i, "Promises daily or weekly earnings"],
  [/\b(no interview|direct joining|100% (job|placement) guarantee)/i, "Promises a job without an interview"],
  [/\b(unlimited|uncapped)\s+(earning|income|incentive)|\bcommission[-\s](only|based)\b/i, "Pay is commission only"],
  [/\b(mlm|network marketing|referral income|chain marketing)\b/i, "Looks like network marketing"],
  [/\b(data entry|typing|copy[-\s]paste|form filling)\b.*\b(work from home|wfh|online)\b|\b(work from home|wfh)\b.*\b(data entry|typing|copy[-\s]paste|form filling)\b/i, "Work-from-home typing or data entry, a common scam pattern"],
];

export function scamSignals(l: Listing, d?: ListingDetails | null): ScamSignals {
  const text = [l.title, l.company, l.summary, l.description ?? "", d?.description ?? "", d?.requirements ?? "", l.tags.join(" "), l.pay?.label ?? ""].join("\n");
  const high = HIGH.filter(([re]) => re.test(text)).map(([, r]) => r);
  const caution = CAUTION.filter(([re]) => re.test(text)).map(([, r]) => r);
  if (l.pay && /performance|incentive/i.test(l.pay.label) && !l.pay.min) caution.push("Stipend depends only on performance");
  if (high.length) return { level: "high", reasons: [...high, ...caution] };
  if (caution.length >= 2) return { level: "caution", reasons: caution };
  if (caution.length === 1) return { level: "caution", reasons: caution };
  return { level: "none", reasons: [] };
}
