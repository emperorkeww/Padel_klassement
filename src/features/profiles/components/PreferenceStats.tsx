import { courtPreference, timeOfDayPreference } from "@/features/profiles/trends";
import type { Match, Team } from "@/types";

// Baan- & tijdvoorkeuren (#471): win% per dagdeel en per baantype, elk met een
// balkje en een korte duiding van het sterkste segment. Cijfers uit trends.ts.

interface PrefRow {
  key: string;
  icon: string;
  label: string;
  rate: number;
  played: number;
  won: number;
  best: boolean;
}

function PrefGroup({ title, rows }: { title: string; rows: PrefRow[] }) {
  return (
    <div className="pref-group">
      <h3 className="pref-group__title">{title}</h3>
      <ul className="pref">
        {rows.map((r) => (
          <li key={r.key} className={`pref__row ${r.best ? "is-best" : ""}`}>
            <span className="pref__label">
              <span aria-hidden="true">{r.icon}</span> {r.label}
            </span>
            <span className="pref__bar" aria-hidden="true">
              <span
                className="pref__fill"
                style={{ width: `${Math.max(r.rate, 2)}%` }}
              />
            </span>
            <span className="pref__rate">{r.rate}%</span>
            <span className="pref__meta">
              {r.won}/{r.played}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreferenceStats({
  matches,
  teams,
  playerId,
}: {
  matches: Match[];
  teams: Record<string, Team>;
  playerId: string;
}) {
  const { parts, best: bestPart } = timeOfDayPreference(matches, teams, playerId);
  const { courts, best: bestCourt } = courtPreference(matches, teams, playerId);

  const timeRows: PrefRow[] = parts.map((p) => ({
    key: p.part,
    icon: p.icon,
    label: p.label,
    rate: p.rate,
    played: p.played,
    won: p.won,
    best: bestPart?.part === p.part,
  }));
  const courtRows: PrefRow[] = courts.map((c) => ({
    key: c.type,
    icon: c.icon,
    label: c.label,
    rate: c.rate,
    played: c.played,
    won: c.won,
    best: bestCourt?.type === c.type,
  }));

  if (timeRows.length === 0 && courtRows.length === 0) return null;

  return (
    <section className="card">
      <h2 className="card__title">Voorkeuren</h2>
      <p className="card__subtitle">
        Wanneer en waar draait je spel — je sterkste moment staat uitgelicht.
      </p>
      {timeRows.length > 0 && <PrefGroup title="Tijdstip" rows={timeRows} />}
      {courtRows.length > 0 && <PrefGroup title="Baantype" rows={courtRows} />}
    </section>
  );
}

export default PreferenceStats;
