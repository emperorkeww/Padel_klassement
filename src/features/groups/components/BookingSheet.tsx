import { useState, type KeyboardEvent } from "react";
import { Sheet } from "@/ui/Sheet";
import type { BookingDetails } from "../pollsApi";
import {
  MAX_ACCESS_CODE,
  MAX_COURTS,
  normalizeAccessCode,
  normalizeCourts,
} from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Gegevens van de boeking invullen: welke banen (#802) en de          */
/* toegangscode van de velden (#675). Dunne schil om Sheet, zoals      */
/* PollWizardSheet — beide velden mogen leeg blijven, dus overslaan    */
/* blijft één tik.                                                    */
/* ------------------------------------------------------------------ */

export function BookingSheet({
  open,
  onClose,
  onSubmit,
  busy = false,
  initial = {},
  title,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Genormaliseerde velden; null waar het veld leeg bleef. */
  onSubmit: (details: BookingDetails) => void;
  busy?: boolean;
  /** Bestaande waarden bij wijzigen; leeg bij het boeken. */
  initial?: BookingDetails;
  title: string;
  confirmLabel: string;
}) {
  const [banen, setBanen] = useState(initial.courts ?? "");
  const [code, setCode] = useState(initial.accessCode ?? "");

  // Leeg bevestigen mag altijd: een club zonder code — of een boeker die de
  // baannummers nog niet weet — mag hier geen drempel voelen. Enter doet
  // hetzelfde als de knop, ook (juist) in een leeg veld.
  function submit() {
    if (busy) return;
    onSubmit({
      courts: normalizeCourts(banen),
      accessCode: normalizeAccessCode(code),
    });
  }

  /** Enter bevestigt, in beide velden. */
  function onEnter(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  }

  return (
    <Sheet
      open={open}
      compact
      onClose={onClose}
      title={title}
      className="sheet--access-code"
    >
      {/* Banen eerst: dat is wat je bij het boeken al zwart-op-wit hebt staan;
          de code komt vaak pas later met de bevestigingsmail. */}
      <label className="access-code__field">
        <span>Banen</span>
        <input
          className="select"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={MAX_COURTS}
          placeholder="bv. 3 & 4 · laat leeg als je 't nog niet weet"
          value={banen}
          onChange={(e) => setBanen(e.target.value)}
          onKeyDown={onEnter}
          autoFocus
        />
      </label>
      <label className="access-code__field">
        <span>Toegangscode velden</span>
        <input
          className="select"
          type="text"
          inputMode="text"
          autoComplete="off"
          maxLength={MAX_ACCESS_CODE}
          placeholder="bv. 1234 · laat leeg als er geen code is"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onEnter}
        />
      </label>
      <p className="field-hint">
        Alleen groepsleden zien dit. Weet je het nog niet? Sla het over — je
        kunt het later toevoegen.
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

export default BookingSheet;