import { useState } from "react";
import { MakeTeams } from "./MakeTeams";
import { VendettaCard } from "./VendettaCard";
import {
  NewMatchSheet,
  type NewMatchMode,
} from "@/features/matches/components/NewMatchSheet";
import type {
  Group,
  GroupMember,
  Match,
  Profile,
  RoastIntensiteit,
  Team,
} from "@/types";
import "./SpelenTab.css";

// De Spelen-tab van de groepspagina (#364): teams maken voor vandaag is de
// primaire actie, een losse partij loggen/plannen de secundaire voetnoot.
// Zodra er vandaag wedstrijden klaarstaan wijst een reis-CTA (#106) door naar
// de Vandaag-tab om te spelen en uitslagen in te vullen. Data-gedreven i.p.v.
// callback-gedreven: het Eerlijk-formaat maakt rondes zonder onGenerated te
// vuren en leunt op de realtime-reload van de parent.

interface SpelenTabProps {
  groupId: string;
  /** Volledige groep — nodig voor de vendetta-kaart (id, naam, roast-intensiteit). */
  group: Group;
  myId: string;
  members: GroupMember[];
  profiles: Record<string, Profile>;
  matches: Match[];
  /** Alleen de matches van vandaag (parent filtert op clubtijdzone). */
  todaysMatches: Match[];
  teams: Record<string, Team>;
  /** Ronde met nog openstaande uitslagen (blokkeert Mexicano), of null. */
  openRound: { round: number } | null;
  busy: boolean;
  intensiteit: RoastIntensiteit;
  /** Reload-cascade van de parent na een nieuwe match/uitslag. */
  onMatches: () => void;
  onGuestCreated: () => void;
  /** Reis-CTA: door naar de Vandaag-tab om te spelen. */
  onShowRondes: () => void;
}

export function SpelenTab({
  groupId,
  group,
  myId,
  members,
  profiles,
  matches,
  todaysMatches,
  teams,
  openRound,
  busy,
  intensiteit,
  onMatches,
  onGuestCreated,
  onShowRondes,
}: SpelenTabProps) {
  // Losse match loggen/plannen binnen de groep (telt mee in stand + avondsamenvatting).
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<NewMatchMode>("score");

  // Groepsleden als profielen — de kiesbare spelers bij het loggen van een match.
  const groupPlayers = members
    .map((m) => profiles[m.player_id])
    .filter(Boolean) as Profile[];

  const openCount = todaysMatches.filter(
    (m) => m.status !== "completed",
  ).length;

  return (
    <>
      {openCount > 0 && (
        <div className="card flow-next" role="status">
          <span>
            🎾{" "}
            {openCount === 1
              ? "Er staat 1 wedstrijd klaar"
              : `Er staan ${openCount} wedstrijden klaar`}{" "}
            om te spelen.
          </span>
          <button
            className="btn btn--sm btn--primary"
            onClick={onShowRondes}
          >
            Naar Vandaag →
          </button>
        </div>
      )}

      {/* Eén teamgenerator: deelnemers uit de poll van vandaag +
          formaatkeuze (eerlijk/americano/mexicano). */}
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

      <section className="group-log" aria-label="Losse partij">
        <p className="group-log__hint">
          Losse partij gespeeld of eentje inplannen? Log 'm hier — hij telt
          mee in de groepsstand en de avondsamenvatting.
        </p>
        <div className="group-log__actions">
          <button
            className="btn btn--sm"
            disabled={busy}
            onClick={() => {
              setLogMode("score");
              setLogOpen(true);
            }}
          >
            + Log match
          </button>
          <button
            className="btn btn--sm"
            disabled={busy}
            onClick={() => {
              setLogMode("plan");
              setLogOpen(true);
            }}
          >
            Plan match
          </button>
        </div>
      </section>

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

export default SpelenTab;
