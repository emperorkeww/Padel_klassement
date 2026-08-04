import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { tap } from "@/lib/utils/haptics";
import { displayName, getProfilesByIds } from "@/features/profiles/api";
import { getMatch, getTeamsByIds, readSetScores } from "@/features/matches/api";
import {
  REDENEN,
  appealFoutMelding,
  draaitWinnaarOm,
  kantVan,
  naCorrectie,
  stemgerechtigden,
  type PointAppeal,
} from "@/features/matches/appeal";
import {
  castAppealVote,
  getAppealVotes,
  getOpenAppeals,
} from "@/features/matches/appealApi";
import type { Match, Profile, Team } from "@/types";
import "./VarStemKaart.css";

// Rudy's VAR (#1025) op het overzicht: de zaken die op jóuw stem wachten.
// Alleen dat — een lopende zaak waarin je al gestemd hebt of waarover je niets
// te zeggen hebt, hoort niet op je dashboard maar op de matchpagina.
//
// De kaart laadt zijn eigen context (match, teams, namen). Dat kost alleen iets
// zodra er werkelijk een zaak openstaat; zonder zaak blijft het bij de ene
// lijstquery, die RLS al beperkt tot je eigen matches en groepen.

interface Stemzaak {
  appeal: PointAppeal;
  match: Match;
  claimant: string;
  reden: string;
  /** De stand vóór en ná, als de claim doorgaat. */
  na: { scoreA: number; scoreB: number; winnerTeamId: string | null } | null;
}

async function laadZaken(myId: string): Promise<Stemzaak[]> {
  const appeals = await getOpenAppeals();
  if (appeals.length === 0) return [];

  const matches = (
    await Promise.all(appeals.map((a) => getMatch(a.match_id)))
  ).filter((m): m is Match => !!m);
  const teams: Record<string, Team> = await getTeamsByIds([
    ...new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id])),
  ]);
  const profiles: Record<string, Profile> = await getProfilesByIds([
    ...new Set(appeals.map((a) => a.claimant_id)),
  ]);

  const zaken: Stemzaak[] = [];
  for (const appeal of appeals) {
    const match = matches.find((m) => m.id === appeal.match_id);
    if (!match) continue;

    const kiezers = stemgerechtigden({
      match,
      teams,
      claimantId: appeal.claimant_id,
      isGast: () => false,
    });
    if (!kiezers.includes(myId)) continue;

    const votes = await getAppealVotes(appeal.id);
    if (votes.some((v) => v.voter_id === myId)) continue;

    const kant = kantVan(match, teams, appeal.claimant_id);
    zaken.push({
      appeal,
      match,
      claimant: profiles[appeal.claimant_id]
        ? displayName(profiles[appeal.claimant_id])
        : "Een medespeler",
      reden:
        REDENEN.find((r) => r.id === appeal.reden)?.label ?? appeal.reden,
      na: kant
        ? naCorrectie({
            match,
            kant,
            setNumber: appeal.set_number,
            sets: readSetScores(match),
          })
        : null,
    });
  }
  return zaken;
}

export function VarStemKaart({
  myId,
  enabled = true,
}: {
  myId: string;
  /**
   * Uit zolang er geen match van jou binnen het VAR-venster valt. Een beroep
   * kan dan niet bestaan (point_appeals_guard laat het niet toe), dus hoeft het
   * overzicht die query niet af te vuren — zie de meetlat in
   * Dashboard.queries.test.tsx (#736).
   */
  enabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const zaken = useAsync(() => laadZaken(myId), [myId], { enabled });

  const lijst = zaken.data ?? [];
  if (lijst.length === 0) return null;

  async function stem(zaak: Stemzaak, akkoord: boolean) {
    if (busy) return;
    setBusy(zaak.appeal.id);
    try {
      await castAppealVote({
        appealId: zaak.appeal.id,
        voterId: myId,
        akkoord,
      });
      tap();
      toast.success(akkoord ? "Genoteerd: klopt." : "Genoteerd: onzin.");
      zaken.reload();
    } catch (err) {
      toast.error(appealFoutMelding(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card varkaart" aria-label="VAR-zaak">
      <div className="card__head">
        <h2 className="card__title card__title--tight">
          📺 {lijst.length === 1 ? "Een zaak" : `${lijst.length} zaken`} voor de
          VAR
        </h2>
      </div>

      {lijst.map((z) => (
        <div key={z.appeal.id} className="varkaart__zaak">
          <p className="varkaart__claim">
            <strong>{z.claimant}</strong> betwist één punt: {z.reden}
            {z.appeal.set_number != null && ` (set ${z.appeal.set_number})`}.
            {z.appeal.toelichting && <em> “{z.appeal.toelichting}”</em>}
          </p>

          {z.na && (
            <p className="varkaart__score">
              <span className="varkaart__score-oud">
                {z.appeal.snapshot_a} – {z.appeal.snapshot_b}
              </span>
              <span aria-hidden="true"> ▸ </span>
              <span className="varkaart__score-nieuw">
                {z.na.scoreA} – {z.na.scoreB}
              </span>
              {draaitWinnaarOm(z.match, z.na) && (
                <span className="varkaart__waarschuwing">
                  {" "}
                  — dit draait de winnaar om
                </span>
              )}
            </p>
          )}

          <div className="varkaart__acties">
            <button
              type="button"
              className="varkaart__knop varkaart__knop--voor"
              disabled={busy === z.appeal.id}
              onClick={() => stem(z, true)}
            >
              Klopt
            </button>
            <button
              type="button"
              className="varkaart__knop varkaart__knop--tegen"
              disabled={busy === z.appeal.id}
              onClick={() => stem(z, false)}
            >
              Onzin
            </button>
            <Link className="btn btn--sm" to={`/matches/${z.match.id}`}>
              Bekijk de match →
            </Link>
          </div>
        </div>
      ))}

      <p className="varkaart__foot">
        Stemmen gaan met naam. Wie zwijgt, stemt niet mee — en dan blijft de
        uitslag staan.
      </p>
    </section>
  );
}

export default VarStemKaart;
