import type { ReactNode } from "react";
import { Sheet } from "@/ui/Sheet";

/* ------------------------------------------------------------------ */
/* Wizard in een bottom-sheet (#349): geen inline-uitklap en dus geen  */
/* layout-shift. Dunne schil om Sheet; de PollWizard komt als children */
/* mee zodat aanmaken (PlanTab) en bewerken (PollCard) 'm delen.       */
/* ------------------------------------------------------------------ */

export function PollWizardSheet({
  open,
  onClose,
  title,
  headerExtra,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Extra rij onder de kop, bv. de ClubPicker bij het aanmaken. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} className="sheet--wizard">
      {headerExtra != null && (
        <div className="wizard-sheet__club">{headerExtra}</div>
      )}
      {children}
    </Sheet>
  );
}
