import { displayName, getProfilesByIds } from "@/features/profiles/api";
import { getMatch, getTeamsByIds, readSetScores } from "@/features/matches/api";
import {
  REDENEN,
  kantVan,
  naCorrectie,
  stemgerechtigden,
  type PointAppeal,
} from "@/features/matches/appeal";
import { getAppealVotes, getOpenAppeals } from "@/features/matches/appealApi";
import type { Match, Profile, Team } from "@/types";

// Rudy's VAR (#1025) op het overzicht: de zaken die op jóuw stem wachten.
// Alleen dat — een lopende zaak waarin je al gestemd hebt of waarover je niets
// te zeggen hebt, hoort niet op je dashboard maar op de matchpagina.
//
// De datalaag stond tot #1242 ín VarStemKaart; hij woont nu hier zodat
// useDashboardData de query kan afvuren en de Vandaag-zone wéét of er een zaak
// is — de kaart zelf blijft presentationeel. De kosten zijn onveranderd: alleen
// als er werkelijk een zaak openstaat komt er context bij, en zonder VAR-venster
// vuurt de lijstquery helemaal niet (enabled-gating in useDashboardData).

export interface Stemzaak {
  appeal: PointAppeal;
  match: Match;
  claimant: string;
  reden: string;
  /** De stand vóór en ná, als de claim doorgaat. */
  na: { scoreA: number; scoreB: number; winnerTeamId: string | null } | null;
}

export async function laadZaken(myId: string): Promise<Stemzaak[]> {
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
