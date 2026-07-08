import { PLAYERS_PER_COURT } from "./planGrid";
import type { PlayProposal, ProposalVote, ProposalStatus } from "./proposalsApi";

// Pure logica rond speelvoorstellen: reacties tellen, speelbaarheid bepalen en
// de lijst beperken tot komende voorstellen. Getest in proposals.test.ts.

/** Reacties op één voorstel, gegroepeerd per status. */
export interface ProposalTally {
  yes: string[]; // player_id's, in stemvolgorde
  maybe: string[];
  no: string[];
  /** Nog zoveel "yes"-spelers nodig om alle voorgestelde banen te vullen. */
  needed: number;
  /** True zodra er genoeg spelers zijn voor het aantal banen (4 per baan). */
  playable: boolean;
}

/** Telt de reacties voor één voorstel en bepaalt de speelbaarheid. */
export function tallyProposal(
  proposal: PlayProposal,
  votes: ProposalVote[],
): ProposalTally {
  const mine = votes.filter((v) => v.proposal_id === proposal.id);
  const by = (s: ProposalStatus) =>
    mine.filter((v) => v.status === s).map((v) => v.player_id);
  const yes = by("yes");
  const target = proposal.courts * PLAYERS_PER_COURT;
  return {
    yes,
    maybe: by("maybe"),
    no: by("no"),
    needed: Math.max(0, target - yes.length),
    playable: yes.length >= target,
  };
}

/** Alleen voorstellen van vandaag of later, oplopend op datum + tijd. */
export function upcomingProposals(
  proposals: PlayProposal[],
  today: string,
): PlayProposal[] {
  return proposals
    .filter((p) => p.date >= today)
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date),
    );
}
