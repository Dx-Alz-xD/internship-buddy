"use client";

import { KanbanSquare, Moon, Search, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/format";
import { useAppStore, useHydrated } from "@/lib/store";
import { YEARS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/tracker", label: "Tracker", icon: KanbanSquare },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const profile = useAppStore((s) => s.profile);
  const active = useAppStore((s) => s.applications.filter((a) => a.status !== "saved" && a.status !== "rejected" && a.status !== "offer").length);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !profile) router.replace("/onboarding");
  }, [hydrated, profile, router]);

  const year = YEARS.find((y) => y.value === profile?.year)?.label;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-4 py-5 lg:flex">
        <Brand href="/discover" />
        <nav aria-label="Main" className="mt-8 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  on ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", on && "text-stamp")} />
                {label}
                {href === "/tracker" && hydrated && active > 0 ? (
                  <span className="ml-auto rounded-full bg-stamp-soft px-1.5 font-mono text-[0.65rem] font-semibold text-stamp tabular">{active}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          {hydrated && profile ? (
            <Link href="/profile" className="flex items-center gap-3 rounded-lg border bg-card p-2.5 outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/40">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-stamp-soft font-display-wide text-sm font-extrabold text-stamp">
                {initials(profile.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{profile.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {year} · {profile.college}
                </span>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-14 w-full" />
          )}
          <div className="flex items-center justify-between px-1">
            <span className="form-caption">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-2.5 backdrop-blur lg:hidden">
          <Brand href="/discover" />
          <ThemeToggle />
        </header>
        <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/95 backdrop-blur lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-medium outline-none focus-visible:bg-muted", on ? "text-stamp" : "text-muted-foreground")}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

