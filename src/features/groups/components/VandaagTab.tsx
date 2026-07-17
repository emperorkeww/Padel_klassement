import { DayStats } from "./DayStats";
import { ShareEvening } from "./ShareEvening";
import { DeletableMatchCard } from "@/features/matches/components/MatchList";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { EmptyState } from "@/ui/EmptyState";
import type { ZwartePiet } from "@/features/groups/zwartePiet";
import type { Upset } from "@/features/matches/upset";
import type { Match, Profile, RatingPoint, RoastIntensiteit, Team } from "@/types";
import "./VandaagTab.css";

// De Vandaag-tab van de groepspagina (#377): uitslagen invullen is de primaire
// actie, dus de wedstrijden staan bovenaan en het dagoverzicht (DayStats)
// eronder als ondersteuning. Zodra alles binnen is verschijnt bovenaan de
// afsluitkaart met de reis-CTA (#106) naar de stand én de deel-poster als
// natuurlijk deelmoment. Puur presentatie: alle data en de reload-cascade
// komen uit GroupDetail.

interface VandaagTabProps {
  groupId: string;
  groupName: string;
  myId: string;
  /** Eigenaar mag ook andermans uitslagen beheren (canManage). */
  isOwner: boolean;
  /** Volledige groepshistorie: DayStats filtert zelf op vandaag en de
   *  rondekaarten gebruiken 'm als roast-context. */
  matches: Match[];
  /** Rondes van vandaag (parent berekent ze al voor SpelenTab en de tab-teller). */
  rounds: { round: number; list: Match[] }[];
  /** Alle uitslagen van vandaag binnen → afsluitkaart tonen. */
  dayDone: boolean;
  /** Clubdag (parent bepaalt de tijdzone). */
  today: string;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  histories: Record<string, RatingPoint[]>;
  upsets: Map<string, Upset>;
  zwartePiet: ZwartePiet | null;
  intensiteit: RoastIntensiteit;
  /** Reload-cascade van de parent na een uitslag of verwijdering. */
  onMatches: () => void;
  /** Reis-CTA's: lege staat → Spelen, dag afgerond → Stand. */
  onShowSpelen: () => void;
  onShowStand: () => void;
}

export function VandaagTab({
  groupId,
  groupName,
  myId,
  isOwner,
  matches,
  rounds,
  dayDone,
  today,
  teams,
  profiles,
  histories,
  upsets,
  zwartePiet,
  intensiteit,
  onMatches,
  onShowSpelen,
  onShowStand,
}: VandaagTabProps) {
  // Verschijnt zodra er vanavond een uitslag is: poster voor de groepschat.
  const share = (
    <ShareEvening
      groupId={groupId}
      groupName={groupName}
      matches={matches}
      teams={teams}
      profiles={profiles}
      histories={histories}
      intensiteit={intensiteit}
    />
  );

  return (
    <>
      {dayDone && (
        <div className="card flow-next" role="status">
          <span>
            🏁 Alle uitslagen van vandaag staan erin — mooi gespeeld!
          </span>
          <div className="vandaag-done__actions">
            <button
              className="btn btn--sm btn--primary"
              onClick={onShowStand}
            >
              Bekijk de stand →
            </button>
            {share}
          </div>
        </div>
      )}

      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Wedstrijden</h2>
          {!dayDone && share}
        </div>
        {rounds.length > 0 && (
          <p className="card__subtitle">
            De wedstrijden en gelogde partijen van vandaag — vul de uitslagen
            in en de stand rekent live mee.
          </p>
        )}

        {rounds.length === 0 && (
          <EmptyState
            icon="🎾"
            title="Nog niets gespeeld vandaag"
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={onShowSpelen}
              >
                Genereer teams of log een partij →
              </button>
            }
          >
            Maak teams op de Spelen-tab — de wedstrijden en uitslagen
            verschijnen hier.
          </EmptyState>
        )}

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
                    {roundDone ? "Afgerond" : `${done}/${list.length} uitslagen`}
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

      {/* Dagoverzicht: telling + highlights van vandaag (#342), ondersteunend
          onder de wedstrijden (#377). */}
      <DayStats
        matches={matches}
        teams={teams}
        profiles={profiles}
        histories={histories}
        zwartePiet={zwartePiet}
        today={today}
      />
    </>
  );
}

export default VandaagTab;
