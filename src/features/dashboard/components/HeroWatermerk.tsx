/** Het divisiemotief als watermerk op de dashboard player card (#771).
 *
 *  De paden komen letterlijk uit het register van de divisiekaart (#710) — het
 *  windmotief van de Blaaskaak, de tactische pijlen, de seizoensringen. Dezelfde
 *  reden als bij de Schandpaal (piasOrnamenten.tsx): zou dit bestand eigen paden
 *  dragen, dan drijven kaart en dashboard stil uit elkaar.
 *
 *  De renderlus is een kopie van FutKaartMotief, met opzet: die zit in
 *  FutKaart.tsx, en dat bestand meenemen zou de kaartcomponent plus zijn hele
 *  stylesheet in de dashboard-chunk trekken voor twintig regels JSX.
 *
 *  Puur decoratief — `aria-hidden`, geen pointer-events (staat op de laag). */
import type { OrnamentPad } from "@/features/rating/components/futKaartOrnamenten";

export function HeroWatermerk({
  paden,
  kleur,
  breedte,
  className,
}: {
  paden: readonly OrnamentPad[];
  kleur: string;
  /** Breedte als fractie van de doos (uit het register); default 0.92. */
  breedte?: number;
  /** Extra klasse wanneer een thema zijn eigen plaatsing of dekking wil. */
  className?: string;
}) {
  return (
    <svg
      className={`hero__watermerk${className ? ` ${className}` : ""}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ ["--hero-watermerk-b" as string]: `${(breedte ?? 0.92) * 100}%` }}
    >
      {paden.map((p) =>
        p.soort === "vlak" ? (
          <path key={p.d} d={p.d} fill={p.kleur ?? kleur} opacity={p.alpha} />
        ) : (
          <path
            key={p.d}
            d={p.d}
            fill="none"
            stroke={p.kleur ?? kleur}
            strokeWidth={p.breedte}
            opacity={p.alpha}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

export default HeroWatermerk;
