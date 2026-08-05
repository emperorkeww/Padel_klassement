import { useCallback, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";

// Gedeelde bevestiging voor onomkeerbare acties (#68). Vervangt de OS-afhankelijke
// `window.confirm` door een gestylede sheet die past bij de PWA. Toegankelijkheid
// (focus in de dialoog, Escape annuleert, scroll-lock) komt van <Sheet>.
//
// Provider-vrij en imperatief: `const [confirm, confirmUi] = useConfirm()` geeft
// een promise-based `confirm(opts)` én de te renderen dialoog terug. De call-site
// blijft bijna 1-op-1 met het oude `window.confirm`:
//
//   if (!(await confirm({ title: "…", confirmLabel: "Verwijderen", danger: true })))
//     return;

export type ConfirmOptions = {
  /** Kop van de dialoog; ook de toegankelijke naam. */
  title: string;
  /** Uitleg onder de titel (optioneel). */
  body?: ReactNode;
  /** Label van de bevestig-knop. Standaard "Bevestigen". */
  confirmLabel?: string;
  /** Label van de annuleer-knop. Standaard "Annuleren". */
  cancelLabel?: string;
  /** Kleurt de bevestig-knop rood voor destructieve acties. */
  danger?: boolean;
  /** Type-to-confirm (#1036): de bevestig-knop blijft uit tot de gebruiker
   *  exact deze tekst intikt. Voor acties waarbij "even doorklikken" niet mag —
   *  accountverwijdering, en liefst verder niets. Hoofdlettergevoelig: het is
   *  meestal een gebruikersnaam, en een soepele vergelijking haalt de rem eruit. */
  bevestigWoord?: string;
};

/**
 * Imperatieve bevestiging zonder provider. Retourneert de `confirm`-functie en
 * de dialoog-node; render die node ergens in je component. Escape of de
 * annuleer-knop resolven `false`, de bevestig-knop `true`.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): [
  (opts: ConfirmOptions) => Promise<boolean>,
  ReactNode,
] {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    // Een nog openstaande vraag telt als geannuleerd voor de nieuwe opent.
    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending(opts);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  }, []);

  const ui = pending ? (
    <ConfirmDialog
      options={pending}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return [confirm, ui];
}

function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    title,
    body,
    confirmLabel = "Bevestigen",
    cancelLabel = "Annuleren",
    danger = false,
    bevestigWoord,
  } = options;

  // Lokale state; de dialoog wordt bij elk openen opnieuw gemonteerd, dus er
  // valt niets te resetten.
  const [getikt, setGetikt] = useState("");
  const geblokkeerd = bevestigWoord != null && getikt.trim() !== bevestigWoord;

  // Bewust géén auto-focus op de bevestig-knop: <Sheet> zet de focus in de
  // dialoog, en bij een destructieve actie voorkomt dat een per ongeluk
  // ingedrukte Enter direct verwijdert. Het invoerveld hieronder mag wél
  // autofocus: de focus staat dan op een tekstveld, niet op de gevaarknop.
  return (
    <Sheet open onClose={onCancel} title={title} compact className="confirm">
      {body != null && <div className="confirm__body">{body}</div>}
      {bevestigWoord != null && (
        <label className="confirm__bevestig">
          <span className="field__label">
            Typ <code>{bevestigWoord}</code> om te bevestigen
          </span>
          <input
            className="input"
            value={getikt}
            onChange={(e) => setGetikt(e.target.value)}
            onKeyDown={(e) => {
              // Enter bevestigt alleen als het woord al klopt; anders zou de
              // toets de rem omzeilen die het veld nu juist is.
              if (e.key === "Enter" && !geblokkeerd) {
                e.preventDefault();
                onConfirm();
              }
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label={`Typ ${bevestigWoord} om te bevestigen`}
          />
        </label>
      )}
      <div className="confirm__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          onClick={onConfirm}
          disabled={geblokkeerd}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export default ConfirmDialog;
