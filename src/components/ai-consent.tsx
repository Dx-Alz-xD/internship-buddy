"use client";

import { Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { answerConsent, useConsentDialog } from "@/lib/ai-client";

/** Asked once, before the first AI feature runs. The answer is remembered and can be changed on the profile page. */
export function AiConsentDialog() {
  const open = useConsentDialog((s) => s.open);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && answerConsent(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-stamp" /> Turn on AI features?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                AI features send your profile, the text of your CV and the listing you are looking at to Groq, which runs the
                model and returns the answer.
              </p>
              <p>Internship Buddy does not store any of it on its server. Answers are saved only in this browser.</p>
              <p>You can turn this off any time on your profile page.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answerConsent(false)}>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={() => answerConsent(true)}>Turn on AI</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
