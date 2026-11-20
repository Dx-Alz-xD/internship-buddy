"use client";

import { ThemeProvider } from "next-themes";
import { AiConsentDialog } from "@/components/ai-consent";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster position="bottom-center" />
        <AiConsentDialog />
      </TooltipProvider>
    </ThemeProvider>
  );
}
