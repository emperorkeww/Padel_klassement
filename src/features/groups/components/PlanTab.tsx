import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { Skeleton } from "@/ui/Skeleton";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { useClub, type Club } from "@/features/availability/club";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { displayName } from "@/features/profiles/api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  createPoll,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "@/features/groups/pollsApi";
import {
  activePolls,
  nonVoters,
  pollOptions,
  tallyOption,
  PLAYERS_PER_COURT,
} from "@/features/groups/pollLogic";
import {
  focusPoll,
  lockedOptionOf,
  pollPhase,
  roundsExistFor,
} from "@/features/groups/planFlowLogic";
import type { GroupMember, Match, Profile } from "@/types";
import { shortDay } from "../planPollHelpers";
import { PlanPhaseHeader, type PlanAction } from "./PlanPhaseHeader";
import { OtherPollsList } from "./OtherPollsList";
import { PollCard } from "./PollCard";
import { PollWizard } from "./PollWizard";
import { PollWizardSheet } from "./PollWizardSheet";
import { SuggestionsCard } from "./SuggestionsCard";
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Plannen-tab (#349): één fase-gedreven flow i.p.v. een kaartenstapel.*/
/* Fasebalk + next-action bovenaan, suggesties als instap, één poll in */
/* focus, secundaire polls compact, wizard als bottom-sheet.           */
/* ------------------------------------------------------------------ */

export function PlanTab({
  groupId,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
  matches,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  /** Alle group-matches (uit GroupDetail): voedt de Klaar-fase-detectie. */
  matches: Match[];
}) {
  const globalClub = useClub();
  const toast = useToast();
  // Locatie voor een nieuwe poll (#322): start op de globale clubkeuze, maar de
  // maker kan hem per poll overschrijven. De keuze wordt op de poll opgeslagen,
  // dus een latere globale clubwissel raakt bestaande polls niet meer.
  const [newPollClub, setNewPollClub] = useState<Club>(globalClub);
  const today = dateInZone(newPollClub.timezone);
  // De wizard-selectie overleeft een uitstap naar /banen (zelfde tabblad,
  // swipe-terug): picks staan in sessionStorage en de sheet heropent vanzelf.
  const wizardStorageKey = `poll-wizard:${groupId}`;
  const [wizardOpen, setWizardOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(wizardStorageKey) != null;
    } catch {
      return false;
    }
  });
  const closeWizard = () => {
    try {
      sessionStorage.removeItem(wizardStorageKey);
    } catch {
      /* opslag niet beschikbaar — geen probleem */
    }
    setWizardOpen(false);
  };

  const polls = useAsync<PlayPoll[]>(() => getGroupPolls(groupId), [groupId]);
  const options = useAsync<PollOption[]>(
    () => getGroupPollOptions(groupId),
    [groupId],
  );
  const votes = useAsync<PollVote[]>(() => getGroupPollVotes(groupId), [groupId]);
  useRealtime("play_polls", polls.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_options", options.reload, `group_id=eq.${groupId}`);
  useRealtime("play_poll_votes", votes.reload, `group_id=eq.${groupId}`);

  // Vrije banen (7-daags venster) van de gekozen nieuwe-poll-club: voedt de
  // aanmaak-wizard. Bestaande polls halen hun eigen club-beschikbaarheid op.
  const week = useAsync<WeekDay[]>(
    () => getWeekAvailability(today, 7, newPollClub),
    [today, newPollClub.id],
  );

  const allOptions = options.data ?? [];
  const allVotes = votes.data ?? [];

  const active = useMemo(
    () => activePolls(polls.data ?? [], allOptions, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [polls.data, options.data, today],
  );

  // Rondes die in deze sessie zijn klaargezet (per poll): laat de fasebalk
  // meteen naar Klaar springen, nog vóór de realtime matches-reload landt.
  const [locallyRounded, setLocallyRounded] = useState<Set<string>>(new Set());

  function reloadAll() {
    polls.reload();
    options.reload();
    votes.reload();
  }

  // De focus-poll bepaalt de fase van de hele tab; de rest klapt samen.
  const focus = focusPoll(active, allOptions, today);
  const rest = active.filter((p) => p.id !== focus?.id);
  const chosen = focus ? lockedOptionOf(focus, allOptions) : null;
  const roundsExist = focus
    ? roundsExistFor(focus, matches) || locallyRounded.has(focus.id)
    : false;
  const phase = focus ? pollPhase(focus, roundsExist) : null;

  const action = useMemo<PlanAction>(() => {
    if (!focus || !phase) {
      return {
        text: "Nog geen speeldag gepland — pak een suggestie hieronder of plan er zelf één.",
      };
    }
    const isManager = focus.created_by === myId || isOwner;
    if (phase === "stemmen") {
      const focusOptions = pollOptions(focus, allOptions);
      const optionIds = new Set(focusOptions.map((o) => o.id));
      const myVoted = allVotes.some(
        (v) => optionIds.has(v.option_id) && v.player_id === myId,
      );
      if (!myVoted) return { text: "Stem op de momenten die jou passen." };
      const waiting = nonVoters(
        members.map((m) => m.player_id),
        focusOptions,
        allVotes,
      );
      if (waiting.length > 0) {
        return {
          text: `Wacht op ${waiting.length} ${waiting.length === 1 ? "lid" : "leden"} — stuur gerust een herinnering.`,
        };
      }
      return {
        text: isManager
          ? "Alle stemmen zijn binnen — kies het moment."
          : "Alle stemmen zijn binnen — het moment wordt zo gekozen.",
      };
    }
    if (phase === "gekozen") {
      if (isManager) {
        return {
          text: `Boek een baan voor ${chosen ? `${shortDay(chosen.date)} · ${chosen.start_time}` : "het gekozen moment"} en tik daarna op 'Baan geboekt ✓'.`,
        };
      }
      return {
        text: `${displayName(profiles[focus.created_by])} legt de baan vast — boeken loopt.`,
      };
    }
    if (phase === "geboekt") {
      const yes = chosen ? tallyOption(chosen, allVotes).yes.length : 0;
      if (yes >= PLAYERS_PER_COURT) {
        return {
          text: `Alles staat vast voor ${chosen ? shortDay(chosen.date) : "de speeldag"} — zet de wedstrijden klaar.`,
        };
      }
      const short = PLAYERS_PER_COURT - yes;
      return {
        text: `Nog ${short} bevestigde ${short === 1 ? "speler" : "spelers"} nodig voor wedstrijden.`,
      };
    }
    return {
      text: "De wedstrijden staan klaar — bekijk ze op Vandaag.",
      to: `/groepen/${groupId}`,
      linkText: "Bekijk de wedstrijden →",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, phase, chosen, allVotes, options.data, members, myId, isOwner, profiles, groupId]);

  if (polls.loading || options.loading) {
    return (
      <section className="card">
        <h2 className="card__title">Speeldag plannen</h2>
        <Skeleton rows={3} />
      </section>
    );
  }

  return (
    <>
      <PlanPhaseHeader
        phase={phase}
        action={action}
        onPlan={() => setWizardOpen(true)}
      />

      {/* Suggesties leiden de plan-flow in: wie kan/moet er spelen? →
          plan de speeldag via de poll eronder (#342). */}
      <SuggestionsCard groupId={groupId} myId={myId} matches={matches} />

      {focus && (
        <PollCard
          poll={focus}
          groupName={groupName}
          members={members}
          options={pollOptions(focus, allOptions)}
          votes={allVotes}
          profiles={profiles}
          myId={myId}
          isOwner={isOwner}
          onChanged={reloadAll}
          onRoundsMade={() =>
            setLocallyRounded((cur) => new Set(cur).add(focus.id))
          }
        />
      )}

      <OtherPollsList
        polls={rest}
        options={allOptions}
        votes={allVotes}
        groupName={groupName}
        members={members}
        profiles={profiles}
        myId={myId}
        isOwner={isOwner}
        onChanged={reloadAll}
      />

      {/* Banen-verkenning altijd zichtbaar op de Plannen-tab (niet alleen in
          de wizard): in de app zelf, dus swipe-terug brengt je hier terug. */}
      <p className="plan-banen">
        <Link to={`/banen?datum=${today}`}>🎾 Vrije banen bekijken →</Link>
      </p>

      {/* Wizard als bottom-sheet (#349): geen layout-shift op de tab. */}
      <PollWizardSheet
        open={wizardOpen}
        onClose={closeWizard}
        title="Nieuwe speeldag"
        headerExtra={
          // Locatie voor deze nieuwe poll — los van de globale clubvoorkeur.
          <ClubPicker value={newPollClub} onPick={setNewPollClub} allowManual />
        }
      >
        <PollWizard
          today={today}
          week={week.data ?? []}
          weekLoading={week.loading}
          club={newPollClub}
          storageKey={wizardStorageKey}
          submitLabel={(n) => `Start poll (${n})`}
          onSubmit={async (opts) => {
            await createPoll({ groupId, createdBy: myId, club: newPollClub, options: opts });
            toast.success("Poll gestart — de groep kan stemmen.");
          }}
          onClose={closeWizard}
          onDone={() => {
            closeWizard();
            reloadAll();
          }}
        />
      </PollWizardSheet>
    </>
  );
}

export default PlanTab;
