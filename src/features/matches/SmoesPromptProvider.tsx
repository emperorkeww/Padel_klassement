// Smoes direct na het loggen (#296): meteen na een verloren groepsmatch sluit de
// log-sheet, dus de Smoesjesmachine kan daar niet blijven staan. Deze provider
// leeft app-breed: `promptSmoes(...)` toont een tikbare toast ("tik voor een
// smoes"), en bij een tik opent een compacte sheet met de Smoesjesmachine voor
// die match — zodat je de smoes niet hoeft op te zoeken.

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Sheet } from "@/ui/Sheet";
import { useToast } from "@/ui/ToastProvider";
import type { RoastCtx } from "@/features/coach/roastTone";
import { SmoesjesMachine } from "./SmoesjesMachine";

export interface SmoesPromptArgs {
  matchId: string;
  groupId: string;
  playerId: string;
  ctx: RoastCtx;
}

const SmoesPromptContext = createContext<
  ((args: SmoesPromptArgs) => void) | undefined
>(undefined);

export function SmoesPromptProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState<SmoesPromptArgs | null>(null);

  const promptSmoes = useCallback(
    (args: SmoesPromptArgs) => {
      toast.info("Verloren — tik voor een smoes 🙈", {
        onClick: () => setPrompt(args),
      });
    },
    [toast],
  );

  return (
    <SmoesPromptContext.Provider value={promptSmoes}>
      {children}
      {prompt && (
        <Sheet
          open
          compact
          onClose={() => setPrompt(null)}
          title="Verzin een smoes"
        >
          <SmoesjesMachine
            matchId={prompt.matchId}
            ctx={prompt.ctx}
            groupId={prompt.groupId}
            playerId={prompt.playerId}
          />
        </Sheet>
      )}
    </SmoesPromptContext.Provider>
  );
}

/** Toont na een verlies de "tik voor een smoes"-toast + smoes-sheet. Geeft een
 *  no-op terug buiten de provider, zodat losse tests/onderdelen niet crashen. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSmoesPrompt(): (args: SmoesPromptArgs) => void {
  return useContext(SmoesPromptContext) ?? (() => {});
}
