import { useEffect, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import {
  pushSupported,
  enablePush,
  getPushSubscription,
} from "@/lib/supabase/push";
import { errorMessage } from "@/lib/utils/errors";
import { readFlag, writeFlag } from "../flags";

/** Eenmalige, wegklikbare uitnodiging om pushmeldingen aan te zetten. Toont
 *  niets als push niet ondersteund wordt, al aan staat, of eerder geweigerd/
 *  weggeklikt is. */
export function PushPrompt({ userId }: { userId: string }) {
  const toast = useToast();
  const supported = pushSupported();
  const [dismissed, setDismissed] = useState(() => readFlag("push-prompt-dismissed"));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // null = nog aan het controleren; false = geen abonnement; true = al aan.
  const [alreadyOn, setAlreadyOn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supported) return;
    getPushSubscription()
      .then((sub) => setAlreadyOn(!!sub))
      .catch(() => setAlreadyOn(false));
  }, [supported]);

  const permission =
    supported && typeof Notification !== "undefined"
      ? Notification.permission
      : "denied";

  if (
    !supported ||
    dismissed ||
    done ||
    alreadyOn !== false ||
    permission !== "default"
  ) {
    return null;
  }

  async function enable() {
    setBusy(true);
    try {
      await enablePush(userId);
      toast.success("Meldingen staan aan — vamos!");
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    writeFlag("push-prompt-dismissed");
  }

  return (
    <section className="card push-prompt">
      <div className="push-prompt__body">
        <span className="push-prompt__icon" aria-hidden="true">
          🔔
        </span>
        <div>
          <h2 className="card__title card__title--tight">Mis niks</h2>
          <p className="card__subtitle push-prompt__sub">
            Krijg een seintje bij nieuwe wedstrijden, uitslagen van jouw matches en
            vriendschapsverzoeken — ook als de app dicht is.
          </p>
        </div>
      </div>
      <div className="push-prompt__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={enable}
          disabled={busy}
        >
          {busy ? "Aanzetten…" : "Meldingen aanzetten"}
        </button>
        <button className="btn btn--sm" onClick={dismiss}>
          Niet nu
        </button>
      </div>
    </section>
  );
}
