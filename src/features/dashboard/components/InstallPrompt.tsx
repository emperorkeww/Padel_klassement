import { useState } from "react";
import { clearInstallPromptEvent, isIos } from "@/lib/utils/pwa";
import { readFlag, writeFlag } from "../flags";
import {
  useInstallPromptEvent,
  useInstallPromptZichtbaar,
} from "../installPrompt";

/** Eenmalige, wegklikbare uitnodiging om de app te installeren (#75).
 *  Op iOS een "Zet op beginscherm"-instructie (daar bestaat geen prompt),
 *  elders een knop die de native installatieprompt opent zodra de browser
 *  een beforeinstallprompt-event gaf. Verdwijnt zodra de app standalone
 *  draait. Deelt de kaartlayout (push-prompt-klassen) met PushPrompt. */
export function InstallPrompt() {
  const [dismissed, setDismissed] = useState(() =>
    readFlag("install-prompt-dismissed"),
  );
  const [busy, setBusy] = useState(false);
  const promptEvent = useInstallPromptEvent();
  const zichtbaar = useInstallPromptZichtbaar();

  const ios = isIos();
  if (dismissed || !zichtbaar) return null;

  async function install() {
    if (!promptEvent) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      // Chrome staat één prompt() per event toe; daarna is het event op.
      clearInstallPromptEvent();
      if (choice.outcome === "dismissed") dismiss();
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    writeFlag("install-prompt-dismissed");
  }

  return (
    <section className="card push-prompt">
      <div className="push-prompt__body">
        <span className="push-prompt__icon" aria-hidden="true">
          📲
        </span>
        <div>
          <h2 className="card__title card__title--tight">Zet op je beginscherm</h2>
          <p className="card__subtitle push-prompt__sub">
            {ios
              ? "Tik in Safari op Deel (het vierkantje met pijl) en kies " +
                "“Zet op beginscherm” — dan open je de app met één tik " +
                "en werken ook meldingen."
              : "Installeer de app voor snelle toegang met één tik — ook zonder " +
                "browser eromheen."}
          </p>
        </div>
      </div>
      <div className="push-prompt__actions">
        {!ios && (
          <button
            className="btn btn--primary btn--sm"
            onClick={install}
            disabled={busy}
          >
            {busy ? "Installeren…" : "Installeer de app"}
          </button>
        )}
        <button className="btn btn--sm" onClick={dismiss}>
          Niet nu
        </button>
      </div>
    </section>
  );
}
