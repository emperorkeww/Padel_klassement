import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useSleepSluiten } from "@/lib/hooks/useSleepSluiten";

// Gedeelde dialoog/bottom-sheet (#72): backdrop + gecentreerde kaart (mobiel
// een bottom-sheet via de .sheet-CSS in ui.css). Centraliseert het focusbeheer
// (focus in de dialoog bij openen, terug naar de opener bij sluiten), Escape
// en de scroll-lock die eerder in elke popup los gedupliceerd stond.
//
// Geef een `title` mee voor de standaard-kop (titel + sluitknop), of laat 'm
// weg en render een eigen kop in `children` (bv. de wizard met stappen).

/* ------------------------------------------------------------------ */
/* De pagina eronder stilzetten (#1308).                               */
/*                                                                     */
/* `body { overflow: hidden }` was hiervoor genoeg gedacht, maar op iOS */
/* houdt dat de dócumentscroll niet tegen: veeg je in een sheet die zelf */
/* niets te scrollen heeft, dan schuift de pagina eráchter. In de       */
/* speeldag-wizard viel dat meteen op — hij past bij het openen precies  */
/* in beeld, en pas als je "verder vooruit" uitklapt heeft hij eigen     */
/* scroll en gedraagt hij zich wél.                                     */
/*                                                                     */
/* De bekende oplossing: het document vastzetten op zijn huidige plek en */
/* die bij het sluiten teruggeven. Een teller eromheen, want een sheet   */
/* kan er een tweede openen (de momentkiezer boven de speeldagkaart) en  */
/* dan mag alleen de buitenste de scrollpositie bewaren en herstellen.   */
/* ------------------------------------------------------------------ */
let vergrendeld = 0;
let bewaardeY = 0;

function vergrendelPagina(): () => void {
  if (vergrendeld === 0) {
    // Alleen als de pagina echt nog los staat. React draait effecten in
    // ontwikkelmodus twee keer (StrictMode: opzetten, opruimen, opnieuw
    // opzetten), en in dat tweede rondje is de scrollpositie nog niet
    // teruggezet — dan zouden we hier een 0 bewaren en na het sluiten bovenaan
    // de pagina uitkomen (#1308).
    if (document.body.style.position !== "fixed") bewaardeY = window.scrollY;
    const s = document.body.style;
    s.position = "fixed";
    s.top = `-${bewaardeY}px`;
    s.left = "0";
    s.right = "0";
    s.width = "100%";
    s.overflow = "hidden";
  }
  vergrendeld += 1;
  return () => {
    vergrendeld -= 1;
    if (vergrendeld > 0) return;
    const s = document.body.style;
    s.position = "";
    s.top = "";
    s.left = "";
    s.right = "";
    s.width = "";
    s.overflow = "";
    // Eerst de pagina opnieuw laten opmeten: zolang de browser nog met de
    // vastgezette hoogte rekent, klemt `scrollTo` op 0 en land je bovenaan
    // (#1308). Een leesbeurt op de scrollhoogte van het document dwingt die
    // herberekening af.
    void document.documentElement.scrollHeight;
    // Terug naar waar je stond; `scrollTo` bestaat niet in elke testomgeving.
    window.scrollTo?.(0, bewaardeY);
  };
}

export function Sheet({
  open,
  onClose,
  title,
  ariaLabel,
  compact = false,
  initialFocus,
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
  /** CSS-selector binnen de dialoog die de focus krijgt bij openen (#1271).
   *  Zonder waarde landt de focus op de dialoog zelf. Gebruik dit in plaats van
   *  `autoFocus` op een kind: dat wordt door het focus-effect hieronder stil
   *  overschreven. */
  initialFocus?: string;
  className?: string;
  /** Extra toetsafhandeling op de dialoog (bv. pijltjes-navigatie). */
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Omlaag vegen sluit (#1180). Zit hier en niet per sheet: alle 25 sheets
  // gedragen zich dan hetzelfde, en twee ervan hadden helemaal geen knop.
  useSleepSluiten(dialogRef, backdropRef, onClose, open);

  // De pagina eronder vastzetten. Bewust vóór het focus-effect hieronder:
  // effecten draaien in volgorde van declaratie, en focussen kan de pagina zelf
  // verschuiven — dan zouden we de verkeerde scrollpositie bewaren (#1308).
  useEffect(() => {
    if (!open) return;
    return vergrendelPagina();
  }, [open]);

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  //
  // `initialFocus` is een selector binnen de dialoog en gaat vóór (#1271).
  // Een `autoFocus` op een veld in het sheet hielp niet: React past die toe in
  // de commit-fase, en deze passive effect draait dáárna en zette de focus stil
  // terug op de dialoog. In de score-sheet betekende dat: geen toetsenbord op de
  // baan, en altijd een extra tik voordat je kon typen. Via het sheet zelf
  // regelen houdt bovendien het teruggeven aan de opener intact — met autoFocus
  // stond de focus hier al ín de dialoog en was de opener niet meer te vinden.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialoog = dialogRef.current;
    const doel = initialFocus
      ? (dialoog?.querySelector<HTMLElement>(initialFocus) ?? null)
      : null;
    // `preventScroll`: het paneel staat al in beeld (het hangt aan een vaste
    // backdrop), dus de browser hoeft er niet heen te scrollen — en dat scheelt
    // een sprong van de pagina eronder (#1308).
    (doel ?? dialoog)?.focus({ preventScroll: true });
    return () => opener?.focus?.();
  }, [open, initialFocus]);

  // Escape sluit.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose} ref={backdropRef}>
      <div
        className={`sheet glas glas--sterk glas--scrollbaar${compact ? " sheet--compact" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Sleepgreep: laat zien dát je hem weg kunt vegen. Bewust geen knop —
            dat zou naast de X een tweede control met dezelfde naam geven — en
            bewust niet sticky: hij scrolt weg op precies het moment dat het
            gebaar ook uit gaat (de sheet scrollt dan zelf). */}
        <div className="sheet__greep" aria-hidden="true" />
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
