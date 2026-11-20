"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { HeroDemo } from "@/components/hero-demo";
import { Button } from "@/components/ui/button";
import { useAppStore, useHydrated } from "@/lib/store";

const BOARDS = ["Internshala", "Unstop", "LinkedIn", "Google Jobs", "Company career pages", "Himalayas"];

export default function Home() {
  const hydrated = useHydrated();
  const profile = useAppStore((s) => s.profile);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && profile) router.replace("/discover");
  }, [hydrated, profile, router]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-6">
        <Brand />
        <Button asChild variant="ghost">
          <Link href="/onboarding">Set up my profile</Link>
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="form-caption">For college students in India</p>
          <h1 className="font-display-wide mt-4 text-[2.6rem] leading-[0.98] font-extrabold text-balance sm:text-6xl">
            Internships that fit your year, skills and city.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Answer seven questions and add your CV. Internship Buddy searches job boards and company career pages, ranks every opening against your profile, and tracks each
            application from the day you apply to the offer.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-11 px-5 text-base">
              <Link href="/onboarding">
                Set up my profile <ArrowRight />
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">About 3 minutes. Your answers stay in this browser.</span>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed pt-5">
            <span className="form-caption">Searches</span>
            {BOARDS.map((b) => (
              <span key={b} className="font-mono text-sm text-foreground/80">
                {b}
              </span>
            ))}
          </div>
        </div>
        <HeroDemo />
      </main>
    </div>
  );
}
