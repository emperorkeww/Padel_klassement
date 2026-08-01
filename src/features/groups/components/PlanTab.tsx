import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAsync, type AsyncState } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { PollSkeleton } from "@/ui/Skeleton";
import { dateInZone } from "@/lib/utils/time";
import { getWeekAvailability, type WeekDay } from "@/features/availability/api";
import { useClub, type Club } from "@/features/availability/club";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { displayName } from "@/features/profiles/api";
import {
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
  heeftGestemd,
  lockedOptionOf,
  pollPhase,
  roundsExistFor,
  roundsMadeFor,
  splitPolls,
} from "@/features/groups/planFlowLogic";
import type { GroupMember, Match, Profile } from "@/types";
import { shortDay } from "../planPollHelpers";
import { PlanPhaseHeader, type PlanAction } from "./PlanPhaseHeader";
import { PlanSection } from "./PlanSection";
import { PollWizard } from "./PollWizard";
import { PollWizardSheet } from "./PollWizardSheet";
import { SuggestionsCard } from "./SuggestionsCard";
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Plannen-tab (#349): één fase-gedreven flow i.p.v. een kaartenstapel.*/
/* Fasebalk + next-action bovenaan, wizard als bottom-sheet.           */
/*                                                                     */
/* Sinds #721 geordend op hoe vast een speeldag staat, niet op één      */
/* focus-poll met een restlijst: eerst wat vastligt, dan waarop nog     */
/* gestemd wordt, en pas daaronder de suggesties. Die stonden bovenaan  */
/* en duwden juist de geboekte speeldag — de vraag waarvoor iedereen    */
/* deze tab opent — onder de vouw.                                      */
/* ------------------------------------------------------------------ */

export function PlanTab({
  groupId,
  groupName,
  members,
  profiles,
  myId,
  isOwner,
  matches,
  polls,
  options,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  myId: string;
  isOwner: boolean;
  /** Alle group-matches (uit GroupDetail): voedt de Klaar-fase-detectie. */
  matches: Match[];
  /** Polls en opties komen sinds #674 uit GroupDetail: de landingstab heeft
   *  de reis-status al nodig vóór deze tab mount. De stemmen blijven hier. */
  polls: AsyncState<PlayPoll[]>;
  options: AsyncState<PollOption[]>;
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

  // Gedeelde speeldag uit de URL (#675): ?poll=<id> zet die poll in focus.
  const [urlParams] = useSearchParams();
  const gedeeldePollId = urlParams.get("poll");

  // polls/options staan in GroupDetail (die abonneert er ook op); alleen de
  // stemmen zijn puur van deze tab.
  const votes = useAsync<PollVote[]>(
    () => getGroupPollVotes(groupId),
    [groupId],
  );
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
    () => activePolls(polls.data ?? [], allOptions, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [polls.data, options.data],
  );

  // Rondes die in deze sessie zijn klaargezet (per poll): laat de fasebalk
  // meteen naar Klaar springen, nog vóór de realtime matches-reload landt.
  const [locallyRounded, setLocallyRounded] = useState<Set<string>>(new Set());

  function reloadAll() {
    polls.reload();
    options.reload();
    votes.reload();
  }

  // De speeldagen in twee secties: vastgelegd boven, stemmen eronder (#721).
  const { vastgelegd, stemmen } = splitPolls(active);

  // De focus-poll bepaalt nog steeds de fase en de next-action van de tab, en
  // staat open in de sectie waar hij in valt. ?poll=<id> uit een gedeelde link
  // (#675) wint; onbekend of verlopen valt stil terug op de gewone keuze.
  const focus = focusPoll(active, allOptions, today, gedeeldePollId);
  const chosen = focus ? lockedOptionOf(focus, allOptions) : null;
  // Landde je hier via een gedeelde link (#886)? Dan krijgt díé kaart de
  // spotlight. Wijst de link naar een speeldag die niet meer loopt, dan zeggen
  // we dat — focusPoll toont anders stilzwijgend een ándere speeldag, en dan
  // sta je te stemmen op iets wat je niet aanklikte.
  const gedeeldGevonden =
    gedeeldePollId != null && active.some((p) => p.id === gedeeldePollId);
  const dodeLink = gedeeldePollId != null && !gedeeldGevonden;
  const spotlightId = gedeeldGevonden ? gedeeldePollId : null;
  const rondesVoor = (p: PlayPoll) =>
    roundsExistFor(p, matches) || locallyRounded.has(p.id);
  // Vertrekpunt voor de starttijden van de volgende rondes (#827).
  const rondesGemaakt = (p: PlayPoll) => roundsMadeFor(p, matches);
  const roundsExist = focus ? rondesVoor(focus) : false;
  const phase = focus ? pollPhase(focus, roundsExist) : null;
  // Welke speeldag de kop bedoelt (#839). Zonder gekozen moment vat de kop de
  // eerste kandidaat samen — beter dan een naamloze fasebalk boven drie rijen.
  const focusWanneer = (() => {
    if (!focus) return null;
    const moment = chosen ?? pollOptions(focus, allOptions)[0] ?? null;
    return moment ? `${shortDay(moment.date)} · ${moment.start_time}` : null;
  })();

  // Polls waarop ik nog niet stemde: het enige wat je met meerdere polls
  // naast elkaar echt uit elkaar moet kunnen houden (#267).
  const wachtOpJou = new Set(
    stemmen
      .filter((p) => !heeftGestemd(p, allOptions, allVotes, myId))
      .map((p) => p.id),
  );

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
        // Zonder datum: die staat sinds #839 in de kop erboven.
        return {
          text: "Boek een baan en tik daarna op 'Baan geboekt ✓'.",
        };
      }
      return {
        text: `${displayName(profiles[focus.created_by])} legt de baan vast — boeken loopt.`,
      };
    }
    if (phase === "geboekt") {
      const yes = chosen ? tallyOption(chosen, allVotes).yes.length : 0;
      if (yes >= PLAYERS_PER_COURT) {
        return { text: "Alles staat vast — zet de wedstrijden klaar." };
      }
      const short = PLAYERS_PER_COURT - yes;
      return {
        text: `Nog ${short} bevestigde ${short === 1 ? "speler" : "spelers"} nodig voor wedstrijden.`,
      };
    }
    return {
      text: "De wedstrijden staan klaar — bekijk ze op Vandaag.",
      // Mét ?tab=spelen (#727): dit is een tabwissel binnen dezelfde route, en
      // het kale pad zet de tab niet — het wist hooguit een bestaande ?tab,
      // waarna `landed` je gewoon op Plannen houdt. "spelen" is de URL-sleutel
      // voor Vandaag (viewFromParam in GroupDetail, labels ≠ keys — #673).
      to: `/groepen/${groupId}?tab=spelen`,
      linkText: "Bekijk de wedstrijden →",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    focus,
    phase,
    chosen,
    allVotes,
    options.data,
    members,
    myId,
    isOwner,
    profiles,
    groupId,
  ]);

  if (polls.loading || options.loading) {
    return (
      <section className="card">
        <h2 className="card__title">Speeldag plannen</h2>
        {/* Fasebalk + stemrijen, de vorm die zo verschijnt (#949). */}
        <PollSkeleton />
      </section>
    );
  }

  return (
    <>
      <PlanPhaseHeader
        phase={phase}
        action={action}
        focusWanneer={focusWanneer}
        aantalSpeeldagen={active.length}
        banenHref={`/banen?datum=${today}`}
        onPlan={() => setWizardOpen(true)}
      />

      {/* Inline en niet als toast (#886): dit mag niet wegtikken vóór je het
          gelezen hebt — je kwam hier tenslotte voor iets anders. */}
      {dodeLink && (
        <p className="plan-deadlink" role="status">
          Deze gedeelde speeldag loopt niet meer — hij is afgelopen of
          geannuleerd. Hieronder staat wat er wél op de planning staat.
        </p>
      )}

      {/* Wat vastligt eerst: "wanneer spelen we en is de baan geregeld?" is
          de vraag waarvoor de groep deze tab opent. */}
      <PlanSection
        title="Vastgelegd"
        polls={vastgelegd}
        options={allOptions}
        votes={allVotes}
        groupName={groupName}
        members={members}
        profiles={profiles}
        myId={myId}
        isOwner={isOwner}
        onChanged={reloadAll}
        openId={focus?.id}
        spotlightId={spotlightId}
        focusId={focus?.id}
        today={today}
        roundsExist={rondesVoor}
        rondesVandaag={rondesGemaakt}
        onRoundsMade={(p) => setLocallyRounded((cur) => new Set(cur).add(p.id))}
      />

      <PlanSection
        title="Stemmen loopt"
        polls={stemmen}
        options={allOptions}
        votes={allVotes}
        groupName={groupName}
        members={members}
        profiles={profiles}
        myId={myId}
        isOwner={isOwner}
        onChanged={reloadAll}
        openId={focus?.id}
        spotlightId={spotlightId}
        focusId={focus?.id}
        today={today}
        wachtOpJou={wachtOpJou}
      />

      {/* Suggesties sluiten de tab af (#721): een instap voor wie nog niets
          gepland heeft, geen blok dat de lopende speeldagen wegdrukt. Sinds
          #839 met een baanlijn ertussen en een eigen, gedempte stijl — alle
          drie de blokken deelden dezelfde kaartstijl, waardoor de instap net zo
          zwaar woog als de speeldagen die echt lopen. */}
      <div className="plan-instap-lijn" role="presentation" />
      <SuggestionsCard
        groupId={groupId}
        myId={myId}
        matches={matches}
        polls={polls.data ?? []}
        options={allOptions}
        votes={allVotes}
        onStarted={reloadAll}
      />

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
            await createPoll({
              groupId,
              createdBy: myId,
              club: newPollClub,
              options: opts,
            });
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
