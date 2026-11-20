"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { loadDraft, Quiz } from "@/components/onboarding/quiz";
import { useAppStore, useHydrated } from "@/lib/store";

export default function OnboardingPage() {
  const hydrated = useHydrated();
  const profile = useAppStore((s) => s.profile);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-6 pt-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  // Editing reuses the same questions, starting on the review step.
  return profile ? <Quiz initial={profile} editing /> : <Quiz initial={loadDraft()} editing={false} />;
}
