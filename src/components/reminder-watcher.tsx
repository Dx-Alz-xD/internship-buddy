"use client";

import { useEffect } from "react";
import { daysUntil } from "@/lib/format";
import { reminders } from "@/lib/reminders";
import { useAppStore } from "@/lib/store";

const EVERY_MS = 30 * 60 * 1000;

/**
 * Shows a device notification for anything due today or tomorrow, once per item.
 * Browsers only allow this while the site is open; the calendar export covers the rest.
 */
export function ReminderWatcher() {
  const enabled = useAppStore((s) => s.notify.enabled);

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;
    const check = () => {
      if (Notification.permission !== "granted") return;
      const { applications, notify, setNotify } = useAppStore.getState();
      const sent = { ...notify.sent };
      let changed = false;
      for (const r of reminders(applications)) {
        const d = daysUntil(r.date);
        if (d == null || d > 1 || sent[r.key]) continue;
        if (r.kind === "followup" && d > 0) continue;
        const when = r.kind === "followup" ? "" : d === 0 ? " · today" : " · tomorrow";
        try {
          new Notification(`${r.title}${when}`, { body: r.detail, tag: r.key, icon: "/icon.svg" });
        } catch {
          return;
        }
        sent[r.key] = new Date().toISOString();
        changed = true;
      }
      // Forget notifications older than 60 days.
      for (const [k, at] of Object.entries(sent)) {
        if (Date.now() - Date.parse(at) > 60 * 864e5) {
          delete sent[k];
          changed = true;
        }
      }
      if (changed) setNotify({ sent });
    };
    check();
    const t = setInterval(check, EVERY_MS);
    return () => clearInterval(t);
  }, [enabled]);

  return null;
}

export async function enableNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  useAppStore.getState().setNotify({ enabled: p === "granted" });
  return p === "granted" ? "granted" : "denied";
}
