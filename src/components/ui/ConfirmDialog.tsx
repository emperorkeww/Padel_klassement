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
  } = options;

  // Bewust géén auto-focus op de bevestig-knop: <Sheet> zet de focus in de
  // dialoog, en bij een destructieve actie voorkomt dat een per ongeluk
  // ingedrukte Enter direct verwijdert.
  return (
    <Sheet open onClose={onCancel} title={title} compact className="confirm">
      {body != null && <div className="confirm__body">{body}</div>}
      <div className="confirm__actions">
        <button type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export default ConfirmDialog;
