import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Overflow-menu in de profielkop (#918).
 *
 * De kop stapelde tot zes bedieningselementen — terug, seizoenskiezer,
 * vergelijken, jaar-Wrapped, kwartaal-Wrapped en delen — die op telefoonbreedte
 * een blok knoppen boven de eigenlijke inhoud werden. Terug en Delen blijven
 * zichtbaar; de rest zit hierachter.
 *
 * Zelfde gedrag als het filtermenu van het klassement (#913): Escape sluit en
 * geeft de focus terug, een klik buiten sluit, en na een keuze gaat hij dicht.
 * De aanroeper rendert dit alleen als er ook echt iets in zit — een lege ⋯ is
 * erger dan geen ⋯.
 */
export function ProfileMenu({
  children,
}: {
  /** Krijgt `sluit` mee: elk item roept dat aan ná zijn eigen actie. Bewust
   *  geen blanket-onClick op het paneel — dan zou het openklappen van de
   *  seizoens-select het menu meteen dichtgooien. */
  children: (sluit: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wikkelRef = useRef<HTMLDivElement>(null);
  const knopRef = useRef<HTMLButtonElement>(null);
  const paneelId = useId();

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
    <div className="profile-menu" ref={wikkelRef}>
      <button
        type="button"
        ref={knopRef}
        className="btn btn--sm profile-menu__btn"
        aria-label="Meer op dit profiel"
        aria-expanded={open}
        aria-controls={paneelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div className="profile-menu__panel" id={paneelId}>
          {children(() => {
            setOpen(false);
            knopRef.current?.focus();
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;
