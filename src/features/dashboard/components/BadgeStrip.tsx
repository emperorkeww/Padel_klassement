import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { type Badge } from "@/features/profiles/badges";

/** Behaalde badges als emoji-rij in de hero. Tikken (of hoveren/focussen)
 *  toont de naam + uitleg in één gedeelde tooltip die links van de rij is
 *  verankerd, zodat de `overflow: hidden` van de hero hem niet afknipt.
 *  De badges zelf navigeren bewust niet (op touch bestaat hover niet, dus
 *  een tik moet de uitleg tonen); de collectie zit achter de pijl-link. */
export function BadgeStrip({ badges, to }: { badges: Badge[]; to: string }) {
  const [active, setActive] = useState<Badge | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shown = badges.slice(0, 6);
  const rest = badges.length - shown.length;
  const clear = (b: Badge) => setActive((cur) => (cur === b ? null : cur));

  // Tik buiten de rij sluit de tooltip (touch kent geen mouseleave).
  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setActive(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active]);

  return (
    <div
      ref={wrapRef}
      className="hero__badges-wrap"
      onMouseLeave={() => setActive(null)}
    >
      <div
        className="hero__badges"
        role="group"
        aria-label={`Behaalde badges: ${badges.map((b) => b.naam).join(", ")}`}
      >
        {shown.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`hero__badge ${active === b ? "is-active" : ""}`}
            onClick={() => setActive((cur) => (cur === b ? null : b))}
            onMouseEnter={() => setActive(b)}
            onFocus={() => setActive(b)}
            onBlur={() => clear(b)}
            aria-label={`${b.naam}: ${b.omschrijving}`}
            aria-expanded={active === b}
          >
            {b.emoji}
          </button>
        ))}
        {/* Alleen als overloop (#1242): past de kast, dan is deze link een
            tweede stille weg naar het profiel — de avatar is dé ingang. */}
        {rest > 0 && (
          <Link
            className="hero__badges-more"
            to={to}
            aria-label="Alle badges bekijken"
          >
            +{rest}
          </Link>
        )}
      </div>
      {active && (
        <span className="hero__badge-tip" role="tooltip">
          <span className="hero__badge-tip-name">
            {active.emoji} {active.naam}
          </span>
          <span className="hero__badge-tip-desc">{active.omschrijving}</span>
        </span>
      )}
    </div>
  );
}
