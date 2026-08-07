import { useMemo, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { lijstGroepen, lijstMatches } from "../api";
import { MatchActies } from "./MatchActies";
import type { AdminMatch } from "../types";

// Alle matches, over alle groepen heen (#1159).
//
// Dit is de plek waar je terechtkomt met "die match van vorige dinsdag klopt
// niet" zonder eerst te moeten uitvissen in welke groep hij hangt. De lijst komt
// van `admin-content` met de service-role; de gewone matchqueries van de app
// blijven gebonden aan RLS, zodat het dashboard van de beheerder er niet van
// verandert.

const PERIODEN = [
  { id: "alles", label: "Alles" },
  { id: "30d", label: "Laatste 30 dagen" },
  { id: "jaar", label: "Dit jaar" },
] as const;

type PeriodeId = (typeof PERIODEN)[number]["id"];

const STATUSSEN = [
  { id: "", label: "Alle statussen" },
  { id: "scheduled", label: "Gepland" },
  { id: "completed", label: "Afgerond" },
  { id: "cancelled", label: "Geannuleerd" },
] as const;

/** Ondergrens van de gekozen periode als ISO, of null voor "alles". */
function vanaf(periode: PeriodeId, nu: number): string | null {
  if (periode === "30d") return new Date(nu - 30 * 86_400_000).toISOString();
  if (periode === "jaar") return new Date(new Date(nu).getFullYear(), 0, 1).toISOString();
  return null;
}

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uitslag(m: AdminMatch): string {
  if (m.score_a == null || m.score_b == null) return "—";
  return `${m.score_a}–${m.score_b}`;
}

const LIMIET = 200;

export function MatchesTab() {
  const [groep, setGroep] = useState("");
  const [status, setStatus] = useState("");
  const [periode, setPeriode] = useState<PeriodeId>("30d");
  const [zoek, setZoek] = useState("");
  // De zoekterm gaat pas naar de server als je hem indient: elke toetsaanslag
  // een RPC over alle matches van alle groepen is te duur voor een paneel dat
  // ook op een telefoon aan de bar geopend wordt.
  const [zoekActief, setZoekActief] = useState("");
  const [gekozen, setGekozen] = useState<AdminMatch | null>(null);

  // Vast ijkmoment per filterwijziging: anders schuift de ondergrens bij elke
  // render een paar milliseconden op en herlaadt de lijst zichzelf.
  const van = useMemo(() => vanaf(periode, Date.now()), [periode]);

  const matches = useAsync(
    () =>
      lijstMatches({
        groupId: groep || null,
        status: status || null,
        van,
        zoek: zoekActief,
        limiet: LIMIET,
      }),
    [groep, status, van, zoekActief],
  );

  const groepen = useAsync(lijstGroepen, []);

  const rijen = matches.data?.matches ?? [];
  const totaal = matches.data?.totaal ?? 0;

  return (
    <>
      <div className="admin-matches__filters">
        <label>
          <span className="sr-only">Groep</span>
          <select
            className="input"
            value={groep}
            onChange={(e) => setGroep(e.target.value)}
          >
            <option value="">Alle groepen</option>
            {(groepen.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Status</span>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSSEN.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Periode</span>
          <select
            className="input"
            value={periode}
            onChange={(e) => setPeriode(e.target.value as PeriodeId)}
          >
            {PERIODEN.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <form
          className="admin-matches__zoek"
          onSubmit={(e) => {
            e.preventDefault();
            setZoekActief(zoek.trim());
          }}
        >
          <label>
            <span className="sr-only">Zoek op speler of groep</span>
            <input
              className="input"
              type="search"
              placeholder="Zoek op speler of groep…"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn--sm">
            Zoek
          </button>
        </form>
      </div>

      {matches.loading && <Skeleton rows={6} />}
      {matches.error && (
        <ErrorRetry melding={matches.error} onRetry={matches.reload} />
      )}

      {!matches.loading && !matches.error && (
        <>
          <p className="admin__telling" role="status">
            {totaal <= rijen.length
              ? `${totaal} match${totaal === 1 ? "" : "es"}`
              : // Geen stille afkap: wie hier "743" leest maar 200 rijen ziet,
                // moet weten dat de rest achter een filter zit.
                `${rijen.length} van ${totaal} getoond — verfijn je filter om de rest te zien`}
          </p>

          {rijen.length === 0 ? (
            <EmptyState icon="🔍" title="Geen match gevonden">
              Geen wedstrijd die aan deze filters voldoet.
            </EmptyState>
          ) : (
            <div className="table-scroll">
              <table className="table admin-tabel">
                <thead>
                  <tr>
                    <th scope="col">Wedstrijd</th>
                    <th scope="col">Groep</th>
                    <th scope="col">Wanneer</th>
                    <th scope="col">Uitslag</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rijen.map((m) => (
                    <tr key={m.id}>
                      <td data-label="Wedstrijd">
                        <button
                          type="button"
                          className="admin-tabel__naam"
                          onClick={() => setGekozen(m)}
                        >
                          <span className="admin-tabel__volnaam">
                            {m.team_a_spelers.join(" & ")} vs{" "}
                            {m.team_b_spelers.join(" & ")}
                          </span>
                        </button>
                      </td>
                      <td data-label="Groep">
                        {m.groep_naam ?? (
                          <span className="admin-tabel__leeg">geen groep</span>
                        )}
                      </td>
                      <td data-label="Wanneer">{datum(m.played_at)}</td>
                      <td data-label="Uitslag">{uitslag(m)}</td>
                      <td data-label="Status">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {gekozen && (
        <MatchActies
          match={gekozen}
          onSluit={() => setGekozen(null)}
          onGewijzigd={matches.reload}
        />
      )}
    </>
  );
}
