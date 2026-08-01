import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Klein ⋯-menu voor acties die er wél moeten zijn maar niet vooraan horen.
 *
 * Ontstaan in #918 voor de profielkop (die tot zes bedieningselementen naast
 * elkaar droeg) en in #919 gedeeld gemaakt, toen de vriendenrij hetzelfde nodig
 * had voor "verwijderen". Anders stonden er twee bijna-identieke disclosures
 * met dezelfde Escape-, klik-buiten- en focusherstel-logica.
 *
 * `children` krijgt `sluit` mee in plaats van dat het paneel op elke klik
 * dichtgaat: een blanket-onClick zou het openklappen van een `<select>` erin
 * al als keuze tellen. Elk item roept `sluit` zelf aan ná zijn eigen actie.
 */
export function OverflowMenu({
  label,
  children,
  className,
}: {
  /** Toegankelijke naam van de knop, bv. "Meer op dit profiel". */
  label: string;
  children: (sluit: () => void) => ReactNode;
  /** Extra class op de wikkel, voor plaatsing binnen een rij of kop. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wikkelRef = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);
  const paneelId = useId();

  // Escape sluit en geeft de focus terug aan de knop — je verliest je plek niet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      knopRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // `pointerdown` en niet `click`: zo sluit hij ook als je op iets tikt dat
  // zelf de focus opeist.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wikkelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div className={`overflow-menu ${className ?? ""}`} ref={wikkelRef}>
      <button
        type="button"
        ref={knopRef}
        className="btn btn--sm overflow-menu__btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={paneelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div className="overflow-menu__panel" id={paneelId}>
          {children(() => {
            setOpen(false);
            knopRef.current?.focus();
          })}
        </div>
      )}
    </div>
  );
}

export default OverflowMenu;
