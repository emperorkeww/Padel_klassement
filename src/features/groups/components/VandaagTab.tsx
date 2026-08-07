import { useState } from "react";
import { DagKop } from "./DagKop";
import { DayStats } from "./DayStats";
import { MakeTeams } from "./MakeTeams";
import { VolgendeRonde } from "./VolgendeRonde";
import { RondeBlok } from "./RondeBlok";
import { ShareEvening } from "./ShareEvening";
import { VendettaCard } from "./VendettaCard";
import { LossePartij } from "./LossePartij";
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

  // Dezelfde generator in twee vormen: kaal als de dag nog moet beginnen, en
  // achter "+ Volgende ronde" zodra hij loopt. Zonder `speeldag`-prop zoekt hij
  // zelf de poll van vandaag op — precies wat deze tab wil (#1133).
  const generatorProps = {
    groupId,
    members,
    profiles,
    myId,
    matches,
    teams,
    openRound,
    onGenerated: onMatches,
  };

  // Losse partij binnen de groep (#722): buiten de rondes om gespeeld of
  // gepland. Sinds #1133 een eigen component, want de speeldagpagina zet
  // hetzelfde blok — daar met het moment van die speeldag voorgevuld.
  const losseMatch = (
    <LossePartij
      groupId={groupId}
      players={groupPlayers}
      intensiteit={intensiteit}
      busy={busy}
      onCreated={onMatches}
      onGuestCreated={onGuestCreated}
    />
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

          <VolgendeRonde {...generatorProps} />
        </section>
      )}

      {/* Staat 1: de teamgenerator is de inhoud van de tab. Zodra de dag
          loopt verhuist hij naar de sheet achter "+ Volgende ronde". */}
      {!dayStarted && <MakeTeams {...generatorProps} />}

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
    </>
  );
}

export default VandaagTab;
