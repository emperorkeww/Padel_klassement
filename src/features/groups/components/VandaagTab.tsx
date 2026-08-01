import { useState } from "react";
import { Sheet } from "@/ui/Sheet";
import { DagKop } from "./DagKop";
import { DayStats } from "./DayStats";
import { MakeTeams } from "./MakeTeams";
import { RondeBlok } from "./RondeBlok";
import { ShareEvening } from "./ShareEvening";
import { VendettaCard } from "./VendettaCard";
import {
  NewMatchSheet,
  type NewMatchMode,
} from "@/features/matches/components/NewMatchSheet";
import type { ZwartePiet } from "@/features/groups/zwartePiet";
import type { PlayPoll, PollOption } from "@/features/groups/pollsApi";
import type { Upset } from "@/features/matches/upset";
import type {
  Group,
  GroupMember,
  Match,
  Profile,
  RatingPoint,
  Team,
} from "@/types";
import "./VandaagTab.css";

// De Vandaag-tab van de groepspagina: één tab voor de hele speeldag (#674 A2).
// Teams maken stond eerst op een aparte Teams-tab (#364) en spelen/uitslagen
// hier (#377), waardoor één speelavond minstens drie tabwissels kostte en de
// tabs elkaar met flow-CTA's heen en weer stuurden. Nu beweegt de tab met de
// dag mee:
//
//   1. niets gepland   → de teamgenerator staat centraal
//   2. wedstrijden klaar → de rondes staan bovenaan, generator klapt weg
//   3. alles ingevuld  → de dagkop sluit af met de stap naar de stand
//
// Daardoor kunnen de flow-next-banners weg (#674 B3): de volgende stap zit in
// de tab zelf in plaats van in een kaart die de inhoud omlaag duwt.
//
// Sinds #839 opent de tab met de dagkop: één blok over de dag als geheel
// (voortgang, deelposter, herkomst van de indeling). De afsluitkaart die hier
// stond ging daarin op — dezelfde actie hoort niet te verhuizen zodra de
// laatste uitslag binnen is.
//
// Eén blok beweegt bewust níét mee met de dag: "Losse partij" (#722). Dat
// verhuisde vroeger van onder de generator naar ín de inklapper "Nog een ronde
// maken" — een paneel dat het tegenovergestelde belooft van wat je komt doen.
// Het staat nu vast bovenaan, in beide dagstaten.
// Puur presentatie: alle data en de reload-cascade komen uit GroupDetail.

interface VandaagTabProps {
  groupId: string;
  /** Volledige groep — nodig voor de vendetta-kaart en de roast-intensiteit. */
  group: Group;
  myId: string;
  /** Eigenaar mag ook andermans uitslagen beheren (canManage). */
  isOwner: boolean;
  members: GroupMember[];
  /** Volledige groepshistorie: DayStats filtert zelf op vandaag, de
   *  rondekaarten en de teamgenerator gebruiken 'm als context. */
  matches: Match[];
  /** Rondes van vandaag (parent berekent ze al voor de tab-teller). */
  rounds: { round: number; list: Match[] }[];
  /** Ronde met nog openstaande uitslagen (blokkeert Mexicano), of null. */
  openRound: { round: number } | null;
  /** Alle uitslagen van vandaag binnen → de dagkop sluit de dag af. */
  dayDone: boolean;
  /** Speeldag-polls van de groep (uit GroupDetail): de dagkop leest eruit of
   *  de indeling van vandaag van de automaat kwam (#839). */
  polls: PlayPoll[];
  pollOptions: PollOption[];
  /** Clubdag (parent bepaalt de tijdzone). */
  today: string;
  /** Clubtijdzone: nodig om per match te bepalen of die op `today` valt. */
  timezone: string;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  upsets: Map<string, Upset>;
  zwartePiet: ZwartePiet | null;
  busy: boolean;
  /** Reload-cascade van de parent na een nieuwe match, uitslag of verwijdering. */
  onMatches: () => void;
  onGuestCreated: () => void;
  /** Reis-CTA: dag afgerond → door naar de stand. */
  onShowStand: () => void;
}

export function VandaagTab({
  groupId,
  group,
  myId,
  isOwner,
  members,
  matches,
  rounds,
  openRound,
  dayDone,
  polls,
  pollOptions,
  today,
  timezone,
  teams,
  profiles,
  histories,
  upsets,
  zwartePiet,
  busy,
  onMatches,
  onGuestCreated,
  onShowStand,
}: VandaagTabProps) {
  // Losse match loggen/plannen binnen de groep (telt mee in stand + avondsamenvatting).
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<NewMatchMode>("score");
  // De teamgenerator voor de volgende ronde, als sheet (#839).
  const [volgendeOpen, setVolgendeOpen] = useState(false);

  // Rondes die de gebruiker zelf open- of dichtklapte. Wat er niet in staat
  // volgt de dag: een afgeronde ronde klapt dicht, de ronde met openstaande
  // uitslagen blijft open — dáár hoor je te kijken.
  const [geklapt, setGeklapt] = useState<Record<number, boolean>>({});
  const rondeOpen = (round: number, list: Match[]) =>
    geklapt[round] ?? list.some((m) => m.status !== "completed");

  const intensiteit = group.roast_intensiteit ?? "radioactief";
  // Groepsleden als profielen — de kiesbare spelers bij het loggen van een match.
  const groupPlayers = members
    .map((m) => profiles[m.player_id])
    .filter(Boolean) as Profile[];

  // Staat 1: er staat vandaag nog niets klaar, dus teams maken is dé actie.
  const dayStarted = rounds.length > 0;

  // Verschijnt zodra er vanavond een uitslag is: poster voor de groepschat.
  const share = (
    <ShareEvening
      groupId={groupId}
      groupName={group.name}
      matches={matches}
      teams={teams}
      profiles={profiles}
      histories={histories}
      intensiteit={intensiteit}
      timezone={timezone}
    />
  );

  const makeTeams = (
    <MakeTeams
      groupId={groupId}
      members={members}
      profiles={profiles}
      myId={myId}
      matches={matches}
      teams={teams}
      openRound={openRound}
      onGenerated={onMatches}
    />
  );

  // Kop en woordkeuze gelijk aan de Losse match-kaart op de hub (#674 B5):
  // het bleef hetzelfde ding, maar het heette hier anders en had als enige
  // blok geen titel. Sinds #722 het eerste blok van de tab: dit is de enige
  // manier om binnen een groep een partij buiten de rondes om te loggen, dus
  // hij hoort niet onder de generator of in een inklapper te liggen.
  const losseMatch = (
    <section className="group-log" aria-labelledby="group-log-title">
      <div className="group-log__intro">
        <h3 className="group-log__title" id="group-log-title">
          Losse partij
        </h3>
        <p className="group-log__hint">
          Buiten de rondes om gespeeld of eentje inplannen? Telt gewoon mee in
          de groepsstand en de avondsamenvatting.
        </p>
      </div>
      <div className="group-log__actions">
        <button
          className="btn btn--sm"
          disabled={busy}
          onClick={() => {
            setLogMode("score");
            setLogOpen(true);
          }}
        >
          + Match loggen
        </button>
        <button
          className="btn btn--sm"
          disabled={busy}
          onClick={() => {
            setLogMode("plan");
            setLogOpen(true);
          }}
        >
          Match plannen
        </button>
      </div>
    </section>
  );

  return (
    <>
      {/* De dag als geheel (#839): voortgang over alle rondes, de deelposter op
          één vaste plek, en waar de indeling vandaan komt. Stond hiervoor
          verspreid over de afsluitkaart, de kop van Wedstrijden en nergens. */}
      <DagKop
        groupId={groupId}
        group={group}
        polls={polls}
        pollOptions={pollOptions}
        rounds={rounds}
        profiles={profiles}
        today={today}
        timezone={timezone}
        dayDone={dayDone}
        share={share}
        onShowStand={onShowStand}
      />

      {/* Vaste plek bovenaan (#722), los van de dagstaat: compact genoeg om
          niets weg te drukken, zichtbaar genoeg om gevonden te worden. */}
      {losseMatch}

      {/* Staat 2 en 3: de wedstrijden van vandaag met de uitslagen. */}
      {dayStarted && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Wedstrijden</h2>
          </div>
          <p className="card__subtitle">
            De wedstrijden en gelogde partijen van vandaag — vul de uitslagen in
            en de stand rekent live mee.
          </p>

          <div className="rounds">
            {rounds.map(({ round, list }) => (
              <RondeBlok
                key={round}
                round={round}
                list={list}
                open={rondeOpen(round, list)}
                onToggle={() =>
                  setGeklapt((cur) => ({
                    ...cur,
                    [round]: !rondeOpen(round, list),
                  }))
                }
                teams={teams}
                profiles={profiles}
                myId={myId}
                isOwner={isOwner}
                matches={matches}
                intensiteit={intensiteit}
                upsets={upsets}
                onMatches={onMatches}
              />
            ))}
          </div>

          {/* De volgende ronde starten is een kernactie, geen instelling. Hij
              zat achter <details> "Nog een ronde maken" — dezelfde low-key
              behandeling als een lade, terwijl de rest van de tab alles direct
              zichtbaar houdt. Nu een echte knop, met de generator als sheet
              zodat hij de rondes niet omlaag duwt. */}
          <div className="rondes__acties">
            <button
              className="btn btn--primary"
              onClick={() => setVolgendeOpen(true)}
            >
              + Volgende ronde
            </button>
          </div>
        </section>
      )}

      {/* Staat 1: de teamgenerator is de inhoud van de tab. Zodra de dag
          loopt verhuist hij naar de sheet achter "+ Volgende ronde". */}
      {!dayStarted && makeTeams}

      {dayStarted && (
        <Sheet
          open={volgendeOpen}
          onClose={() => setVolgendeOpen(false)}
          title="Volgende ronde"
        >
          {/* De drie routes naar een volgende ronde (deze generator, de
              winner-card op Plannen en sinds #827 de cron) deelden niet
              dezelfde vorm zonder dat de UI dat ergens zei. */}
          <p className="card__subtitle">
            De automaat deelt 's ochtends Americano; hier kies je zelf de vorm
            voor deze ronde.
          </p>
          {makeTeams}
        </Sheet>
      )}

      {/* Vendetta's horen bij het spelen/de onderlinge duels (#524), niet bij
          de Stand — daar drukten ze de eigenlijke ranglijst weg. */}
      <VendettaCard
        group={group}
        matches={matches}
        teams={teams}
        profiles={profiles}
        memberList={members}
        myId={myId}
      />

      {/* Dagoverzicht: telling + highlights van vandaag (#342), ondersteunend
          onder de wedstrijden (#377). Rendert niets op een lege dag. */}
      <DayStats
        matches={matches}
        teams={teams}
        profiles={profiles}
        histories={histories}
        zwartePiet={zwartePiet}
        today={today}
        timezone={timezone}
      />

      <NewMatchSheet
        open={logOpen}
        players={groupPlayers}
        mode={logMode}
        groupId={groupId}
        intensiteit={intensiteit}
        onClose={() => setLogOpen(false)}
        onCreated={onMatches}
        onGuestCreated={onGuestCreated}
      />
    </>
  );
}

export default VandaagTab;
