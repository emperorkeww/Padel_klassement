import { useEffect, useRef } from "react";

// Vergrote profielfoto (#572): donkere backdrop met de foto groot en gecentreerd.
// De foto draagt dezelfde `viewTransitionName: "player-avatar"` als de hero-avatar,
// zodat hij er vloeiend naartoe morpht en bij sluiten weer terugkrimpt. Sluiten
// kan via Escape, klik op de achtergrond én klik op de foto zelf (alles bubbelt
// naar de backdrop). Focus gaat naar de foto bij openen en keert bij sluiten
// terug naar de opener (de avatar-knop) — zelfde patroon als de Sheet.

export function AvatarLightbox({
  open,
  onClose,
  url,
  name,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  /** Naam van de speler, voor de alt-tekst. */
  name: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    imgRef.current?.focus?.();
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
    <div
      className="avatar-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Vergrote profielfoto"
      onClick={onClose}
    >
      <img
        ref={imgRef}
        src={url}
        alt={`Profielfoto van ${name}`}
        className="avatar-lightbox__img"
        tabIndex={-1}
      />
    </div>
  );
}

export default AvatarLightbox;
