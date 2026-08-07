import { useState } from "react";
import { Sheet } from "@/ui/Sheet";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { useConfirm } from "@/ui/ConfirmDialog";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { emptySet, toSetScores, type SetPair } from "@/features/matches/api";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import {
  corrigeerUitslag,
  verplaatsMatch,
  verwijderMatchAlsBeheerder,
} from "../api";
import type { AdminMatch } from "../types";

// De drie ingrepen op één match, vanuit het beheerpaneel (#1159).
//
// Waarom hier en niet in het gewone matchscherm: de beheerder ziet een match uit
// een groep waar hij niet in zit domweg niet — de select-policy uit #461 laat
// hem niet door. Dit paneel praat daarom met `admin-content`, dat met de
// service-role leest én schrijft. In de groepen waar hij wél in zit, doet PR 3
// hetzelfde vanuit het matchscherm zelf.
//
// De winnaar wordt hier afgeleid uit de score en niet apart gevraagd: hij is de
// enige waarde die de stand stuurt (de Elo kijkt naar winner_team_id, niet naar
// de marge), en een beheerder die 3-6 intikt maar per ongeluk team A als winnaar
// laat staan, zet een onvindbare fout in het klassement.

function teamNaam(spelers: string[]): string {
  return spelers.length > 0 ? spelers.join(" & ") : "onbekend";
}

/** ISO -> waarde voor <input type="datetime-local"> in lokale tijd. */
function naarLokaleInvoer(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function MatchActies({
  match,
  onSluit,
  onGewijzigd,
}: {
  match: AdminMatch;
  onSluit: () => void;
  onGewijzigd: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [bezig, setBezig] = useState(false);

  const [scoreA, setScoreA] = useState(
    match.score_a == null ? "" : String(match.score_a),
  );
  const [scoreB, setScoreB] = useState(
    match.score_b == null ? "" : String(match.score_b),
  );
  const [sets, setSets] = useState<SetPair[]>(() =>
    (match.set_scores ?? []).length > 0
      ? (match.set_scores ?? []).map(([a, b]) => ({ a: String(a), b: String(b) }))
      : [emptySet()],
  );
  const [moment, setMoment] = useState(naarLokaleInvoer(match.played_at));

  const naamA = teamNaam(match.team_a_spelers);
  const naamB = teamNaam(match.team_b_spelers);
  const scoresIngevuld = scoreA !== "" && scoreB !== "";

  async function doe(fn: () => Promise<void>) {
    setBezig(true);
    try {
      await fn();
      onGewijzigd();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  async function bewaarUitslag() {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      toast.error("Vul twee hele, niet-negatieve getallen in.");
      return;
    }
    const winnaar =
      a === b ? null : a > b ? match.team_a_id : match.team_b_id;
    const nieuweSets = toSetScores(sets);

    await doe(async () => {
      await corrigeerUitslag({
        matchId: match.id,
        scoreA: a,
        scoreB: b,
        winnerTeamId: winnaar,
        // Geen enkele set ingevuld = de set-stand wissen. Dat is hier expliciet
        // en niet "onaangeraakt laten": het formulier stond gevuld met de
        // bestaande sets, dus leeghalen is een keuze van de beheerder.
        setScores: nieuweSets.length > 0 ? nieuweSets : null,
        // Een nog niet afgeronde match krijgt met een uitslag ook de status.
        ...(match.status !== "completed" ? { status: "completed" } : {}),
      });
      toast.success("Uitslag bijgewerkt. De ratings zijn herberekend.");
    });
  }

  return (
    <Sheet open onClose={onSluit} title="Match beheren">
      <p className="admin-match__kop">
        {naamA} <span aria-hidden="true">vs</span> {naamB}
        <span className="admin-match__sub">
          {match.groep_naam ?? "geen groep"} · {match.status}
        </span>
      </p>

      <p className="msg msg--info" role="note">
        Je doet dit als beheerder van de app, niet als deelnemer. Elke wijziging
        wordt gelogd.
      </p>

      <section className="admin-detail__blok">
        <h3 className="card__title">Uitslag</h3>
        <div className="admin-match__scores">
          <ScoreStepper value={scoreA} onChange={setScoreA} label={`Score ${naamA}`} />
          <span className="admin-match__dash" aria-hidden="true">
            –
          </span>
          <ScoreStepper value={scoreB} onChange={setScoreB} label={`Score ${naamB}`} />
        </div>

        <SetScoresInput
          sets={sets}
          onChange={setSets}
          labelA={naamA}
          labelB={naamB}
        />

        <div className="admin-acties">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={bezig || !scoresIngevuld}
            onClick={bewaarUitslag}
          >
            Uitslag opslaan
          </button>
        </div>
      </section>

      <section className="admin-detail__blok">
        <h3 className="card__title">Tijdstip</h3>
        <label className="admin-match__moment">
          <span className="sr-only">Tijdstip van de match</span>
          <input
            className="input"
            type="datetime-local"
            value={moment}
            onChange={(e) => setMoment(e.target.value)}
          />
        </label>
        <div className="admin-acties">
          <button
            type="button"
            className="btn btn--sm"
            disabled={bezig}
            onClick={() =>
              doe(async () => {
                await verplaatsMatch(
                  match.id,
                  moment === "" ? null : new Date(moment).toISOString(),
                );
                toast.success(
                  moment === "" ? "Tijdstip gewist." : "Match verplaatst.",
                );
              })
            }
          >
            {moment === "" ? "Tijdstip wissen" : "Verplaatsen"}
          </button>
        </div>
      </section>

      <section className="admin-detail__blok">
        <h3 className="card__title">Verwijderen</h3>
        <div className="admin-acties">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={bezig}
            onClick={() =>
              doe(async () => {
                if (
                  !(await confirm({
                    title: "Match verwijderen",
                    body: (
                      <>
                        <p>
                          {naamA} vs {naamB}
                          {match.groep_naam ? ` in ${match.groep_naam}` : ""}{" "}
                          verdwijnt definitief.
                        </p>
                        {match.status === "completed" && (
                          // De knop die niemand anders heeft: de gewone app
                          // laat een afgeronde match niet verwijderen, juist
                          // omdat dit de stand raakt.
                          <p>
                            <strong>Dit is een afgeronde match.</strong> De
                            uitslag {match.score_a}–{match.score_b} verdwijnt uit
                            het klassement en de ratings van alle vier de spelers
                            worden herberekend.
                          </p>
                        )}
                      </>
                    ),
                    confirmLabel: "Definitief verwijderen",
                    danger: true,
                  }))
                ) {
                  return;
                }
                await verwijderMatchAlsBeheerder(match.id);
                toast.success("Match verwijderd.");
                onSluit();
              })
            }
          >
            Match verwijderen
          </button>
        </div>
      </section>

      {confirmUi}
    </Sheet>
  );
}
