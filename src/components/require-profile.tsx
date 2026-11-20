"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, useHydrated } from "@/lib/store";

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8 sm:px-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-3 pt-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pages always render (so Next can prerender their shell); the content waits until the saved
 * profile has loaded from IndexedDB. The app shell redirects to onboarding when there is none.
 */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const hasProfile = useAppStore((s) => !!s.profile);
  return hydrated && hasProfile ? <>{children}</> : <PageSkeleton />;
}
