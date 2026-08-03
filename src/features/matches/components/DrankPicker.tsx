import { useMemo, useState } from "react";
import {
  BIEREN,
  DRANK_MAX_AANTAL,
  DRANK_MIN_AANTAL,
  FRISDRANKEN,
  drankLabel,
  zoekDranken,
  type DrankInfo,
} from "@/features/matches/drankkaart";
import "./DrankPicker.css";

/**
 * Drankje-inzet kiezen (#1004): waar de verliezers de winnaars op trakteren.
 *
 * Bewust géén chip-rij zoals de CourtPicker: die heeft vier opties, de
 * drankkaart vijfendertig. Vandaar een zoekveld met daaronder twee groepen —
 * en zolang er niet gezocht wordt tonen we alleen de kop van elke groep plus
 * de gekozen drank, zodat stap 2 van de wizard niet in één klap drie schermen
 * lang wordt. "Toon alles" klapt de volledige kaart open.
 *
 * Het aantal verschijnt pas ná een keuze: zonder drankje betekent een aantal
 * niets (de RPC negeert het dan ook).
 */
export function DrankPicker({
  value,
  aantal,
  onChange,
  onAantalChange,
  disabled = false,
}: {
  /** Gekozen slug, of null = er wordt nergens om gespeeld. */
  value: string | null;
  aantal: number;
  onChange: (slug: string | null) => void;
  onAantalChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [alles, setAlles] = useState(false);

  const zoekt = term.trim().length > 0;
  const bieren = useMemo(() => zoekDranken(term, BIEREN), [term]);
  const fris = useMemo(() => zoekDranken(term, FRISDRANKEN), [term]);
  // Ingeklapt: alleen de eerste handvol per groep, plus altijd de gekozen
  // drank — anders verdwijnt je eigen keuze uit beeld zodra je hem gemaakt hebt.
  const kort = (lijst: DrankInfo[]) =>
    zoekt || alles
      ? lijst
      : lijst
          .slice(0, 6)
          .concat(
            lijst.some((d) => d.slug === value) &&
              !lijst.slice(0, 6).some((d) => d.slug === value)
              ? lijst.filter((d) => d.slug === value)
              : [],
          );

  const leeg = bieren.length === 0 && fris.length === 0;

  return (
    <div className="drank-picker">
      <span className="drank-picker__label">Drankje-inzet (optioneel)</span>
      <p className="drank-picker__intro">
        De verliezers trakteren de winnaars. Kies waarom er gespeeld wordt — of
        laat het leeg en speel voor de eer.
      </p>

      <input
        className="input drank-picker__search"
        type="search"
        placeholder="Zoek een drankje…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        disabled={disabled}
        aria-label="Zoek een drankje"
      />

      {leeg ? (
        <p className="drank-picker__leeg">
          Niets gevonden. Staat het niet op de kaart, speel dan voor de eer.
        </p>
      ) : (
        <>
          <DrankGroep
            titel="🍺 Bieren"
            dranken={kort(bieren)}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
          <DrankGroep
            titel="🥤 Fris & water"
            dranken={kort(fris)}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </>
      )}

      {!zoekt && !alles && (
        <button
          type="button"
          className="drank-picker__meer"
          onClick={() => setAlles(true)}
          disabled={disabled}
        >
          Toon de hele kaart ({BIEREN.length + FRISDRANKEN.length} dranken)
        </button>
      )}

      {value && (
        <div className="drank-picker__aantal">
          <span className="drank-picker__aantal-label">
            Aantal per winnaar
          </span>
          <div className="drank-picker__stepper">
            <button
              type="button"
              className="drank-picker__step"
              onClick={() => onAantalChange(Math.max(DRANK_MIN_AANTAL, aantal - 1))}
              disabled={disabled || aantal <= DRANK_MIN_AANTAL}
              aria-label="Eén minder"
            >
              −
            </button>
            <output className="drank-picker__aantal-waarde">{aantal}</output>
            <button
              type="button"
              className="drank-picker__step"
              onClick={() => onAantalChange(Math.min(DRANK_MAX_AANTAL, aantal + 1))}
              disabled={disabled || aantal >= DRANK_MAX_AANTAL}
              aria-label="Eén meer"
            >
              +
            </button>
          </div>
          <p className="drank-picker__samenvatting">
            {aantal}× {drankLabel(value)} per winnaar
          </p>
        </div>
      )}
    </div>
  );
}

function DrankGroep({
  titel,
  dranken,
  value,
  onChange,
  disabled,
}: {
  titel: string;
  dranken: DrankInfo[];
  value: string | null;
  onChange: (slug: string | null) => void;
  disabled: boolean;
}) {
  if (dranken.length === 0) return null;
  return (
    <div className="drank-groep">
      <span className="drank-groep__titel">{titel}</span>
      <div className="drank-groep__opts" role="radiogroup" aria-label={titel}>
        {dranken.map((d) => {
          const active = value === d.slug;
          return (
            <button
              key={d.slug}
              type="button"
              role="radio"
              aria-checked={active}
              className={`drank-chip ${active ? "is-active" : ""}`}
              disabled={disabled}
              // Nogmaals tikken op de gekozen drank haalt de inzet er weer af —
              // zelfde gebaar als bij de CourtPicker.
              onClick={() => onChange(active ? null : d.slug)}
            >
              <span aria-hidden="true">{d.icon}</span> {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DrankPicker;
