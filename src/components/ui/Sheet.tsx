import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

// Gedeelde dialoog/bottom-sheet (#72): backdrop + gecentreerde kaart (mobiel
// een bottom-sheet via de .sheet-CSS in ui.css). Centraliseert het focusbeheer
// (focus in de dialoog bij openen, terug naar de opener bij sluiten), Escape
// en de scroll-lock die eerder in elke popup los gedupliceerd stond.
//
// Geef een `title` mee voor de standaard-kop (titel + sluitknop), of laat 'm
// weg en render een eigen kop in `children` (bv. de wizard met stappen).

export function Sheet({
  open,
  onClose,
  title,
  ariaLabel,
  compact = false,
  className,
  onKeyDown,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Toont een standaard-kop met deze titel + sluitknop. */
  title?: string;
  /** Toegankelijke naam als er geen `title` is. */
  ariaLabel?: string;
  /** Compacte variant (kleine popup i.p.v. volle sheet). */
  compact?: boolean;
  className?: string;
  /** Extra toetsafhandeling op de dialoog (bv. pijltjes-navigatie). */
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  // Escape sluit; de pagina eronder scrollt niet mee.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${compact ? " sheet--compact" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {title != null && (
          <header className="sheet__head">
            <h2 className="sheet__title">{title}</h2>
            <button
              className="sheet__close"
              onClick={onClose}
              aria-label="Sluiten"
            >
              ✕
            </button>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

export default Sheet;
