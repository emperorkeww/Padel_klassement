import { useState } from "react";
import { Sheet } from "@/ui/Sheet";
import { MAX_ACCESS_CODE, normalizeAccessCode } from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Toegangscode van de velden invoeren (#675). Dunne schil om Sheet,   */
/* zoals PollWizardSheet — één veld, en overslaan blijft één tik.      */
/* ------------------------------------------------------------------ */

export function AccessCodeSheet({
  open,
  onClose,
  onSubmit,
  busy = false,
  initial = null,
  title,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Genormaliseerde code, of null als het veld leeg bleef. */
  onSubmit: (code: string | null) => void;
  busy?: boolean;
  /** Bestaande code bij wijzigen; null bij het boeken. */
  initial?: string | null;
  title: string;
  confirmLabel: string;
}) {
  const [value, setValue] = useState(initial ?? "");

  // Leeg bevestigen mag altijd: een club zonder code mag hier geen drempel
  // voelen. Enter doet hetzelfde als de knop, ook (juist) in een leeg veld.
  function submit() {
    if (busy) return;
    onSubmit(normalizeAccessCode(value));
  }

  return (
    <Sheet
      open={open}
      compact
      onClose={onClose}
      title={title}
      className="sheet--access-code"
    >
      <label className="access-code__field">
        <span>Toegangscode velden</span>
        <input
          className="select"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={MAX_ACCESS_CODE}
          placeholder="bv. 1234 · laat leeg als er geen code is"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          autoFocus
        />
      </label>
      <p className="field-hint">
        Alleen groepsleden zien de code. Weet je 'm nog niet? Sla dit over — je
        kunt hem later toevoegen.
      </p>
      <div className="access-code__actions">
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={busy}
          onClick={submit}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy}
          onClick={onClose}
        >
          Annuleer
        </button>
      </div>
    </Sheet>
  );
}

export default AccessCodeSheet;
