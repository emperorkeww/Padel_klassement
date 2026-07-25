import { useState } from "react";
import { DayStats } from "./DayStats";
import { MakeTeams } from "./MakeTeams";
import { ShareEvening } from "./ShareEvening";
import { VendettaCard } from "./VendettaCard";
import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import {
  NewMatchSheet,
  type NewMatchMode,
} from "@/features/matches/components/NewMatchSheet";
import type { ZwartePiet } from "@/features/groups/zwartePiet";
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
//   3. alles ingevuld  → afsluitkaart met de stap naar de stand + deel-poster
//
// Daardoor kunnen de flow-next-banners weg (#674 B3): de volgende stap zit in
// de tab zelf in plaats van in een kaart die de inhoud omlaag duwt.
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
  /** Alle uitslagen van vandaag binnen → afsluitkaart tonen. */
  dayDone: boolean;
  /** Clubdag (parent bepaalt de tijdzone). */
  today: string;
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
  today,
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

  const intensiteit = group.roast_intensiteit ?? "gemeen";
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
      {/* Vaste plek bovenaan (#722), los van de dagstaat: compact genoeg om
          niets weg te drukken, zichtbaar genoeg om gevonden te worden. */}
      {losseMatch}

      {/* Staat 3: alles ingevuld. */}
      {dayDone && (
        <div className="card flow-next" role="status">
          <span>🏁 Alle uitslagen van vandaag staan erin — mooi gespeeld!</span>
          <div className="vandaag-done__actions">
            <button className="btn btn--sm btn--primary" onClick={onShowStand}>
              Bekijk de stand →
            </button>
            {share}
          </div>
        </div>
      )}

      {/* Staat 2 en 3: de wedstrijden van vandaag met de uitslagen. */}
      {dayStarted && (
        <section className="card">
          <div className="card__head">
            <h2 className="card__title card__title--tight">Wedstrijden</h2>
            {!dayDone && share}
          </div>
          <p className="card__subtitle">
            De wedstrijden en gelogde partijen van vandaag — vul de uitslagen
            in en de stand rekent live mee.
          </p>

          <div className="rounds">
            {rounds.map(({ round, list }) => {
              const done = list.filter((m) => m.status === "completed").length;
              const roundDone = done === list.length;
              return (
                <div
                  key={round}
                  className={`round ${roundDone ? "is-done" : "is-open"}`}
                >
                  <div className="round-head">
                    <h3 className="card__title card__title--compact">
                      {round === 0 ? "Losse matches" : `Ronde ${round}`}
                    </h3>
                    <span
                      className={`round-head__progress ${
                        roundDone ? "round-head__progress--done" : ""
                      }`}
                    >
                      {roundDone
                        ? "Afgerond"
                        : `${done}/${list.length} uitslagen`}
                    </span>
                  </div>
                  <div className="stack">
                    {list.map((m) =>
                      m.status === "completed" ? (
                        <DeletableMatchCard
                          key={m.id}
                          match={m}
                          teams={teams}
                          profiles={profiles}
                          perspectiveId={myId}
                          upset={upsets.get(m.id) ?? null}
                          canManage={isOwner}
                          onDeleted={onMatches}
                        />
                      ) : (
                        <PlannedMatchCard
                          key={m.id}
                          match={m}
                          teams={teams}
                          profiles={profiles}
                          perspectiveId={myId}
                          history={matches}
                          intensiteit={intensiteit}
                          onSaved={onMatches}
                        />
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Staat 1: de teamgenerator is de inhoud van de tab. Zodra de dag
          loopt klapt hij weg — je maakt hooguit nog een volgende ronde. */}
      {dayStarted ? (
        <details className="card next-round">
          <summary className="next-round__toggle">Nog een ronde maken</summary>
          <div className="next-round__body">{makeTeams}</div>
        </details>
      ) : (
        makeTeams
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
