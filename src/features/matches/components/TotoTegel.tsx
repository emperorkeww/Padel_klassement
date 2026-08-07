import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { teamLabel } from "@/features/matches/api";
import { displayName } from "@/features/profiles/api";
import { predictionPoints } from "@/features/matches/predictions";
import type { MatchPrediction } from "@/features/matches/predictions";
import {
  clearPrediction,
  setPrediction,
} from "@/features/matches/predictionsApi";
import type { Match, Profile, Team } from "@/types";

/**
 * De toto (#116): tip de winnaar, hoe kleiner de winkans hoe meer punten.
 *
 * Stond tot #1144 als open tegel op de geplande kaart; nu zit hij achter de
 * matchoptie-rij "Toto". De regels zijn ongewijzigd — alleen groepsmatches zijn
 * tipbaar (de guard-trigger dwingt dat serverside af), tippen kan tot de
 * starttijd, en nogmaals tikken op je eigen keuze trekt de tip in.
 *
 * De voorspellingen komen van buiten: de kaart heeft ze toch al nodig om na het
 * opslaan te tonen wat je tip opleverde, en twee lezers op dezelfde (gecachte)
 * query zou alleen maar uit de pas kunnen lopen.
 */
export function TotoTegel({
  match: m,
  teams,
  profiles,
  myId,
  preds,
  chance,
  pctA,
  tippingOpen,
  onChanged,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  myId: string | null;
  preds: MatchPrediction[];
  /** Winkans van team A (0..1); null = geen ratings bekend. */
  chance: number | null;
  /** Dezelfde kans in hele procenten, of null. */
  pctA: number | null;
  tippingOpen: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const myPrediction = myId
    ? (preds.find((p) => p.player_id === myId) ?? null)
    : null;

  async function tip(teamId: string) {
    if (!myId || !m.group_id || busy || !tippingOpen) return;
    setBusy(true);
    try {
      if (myPrediction?.predicted_team_id === teamId) {
        await clearPrediction(m.id, myId);
        toast.success("Tip ingetrokken.");
      } else {
        await setPrediction({
          matchId: m.id,
          groupId: m.group_id,
          playerId: myId,
          predictedTeamId: teamId,
        });
        toast.success(`Tip geplaatst op ${teamLabel(teams[teamId], profiles)}.`);
      }
      tap();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Chip-gegevens per team: tippers, of het mijn tip is en de te winnen
   *  punten volgens de huidige winkans (de server bevriest de definitieve). */
  function tipChipFor(teamId: string, teamChance: number | null) {
    const tippers = preds.filter((p) => p.predicted_team_id === teamId);
    return {
      teamId,
      mine: myPrediction?.predicted_team_id === teamId,
      count: tippers.length,
      names: tippers.map((p) => displayName(profiles[p.player_id])),
      pts: teamChance != null ? predictionPoints(teamChance) : null,
    };
  }

  return (
    <section className="bet-tile bet-tile--toto" aria-label="Toto">
      {!tippingOpen && (
        <p className="bet-tile__stat">
          {`tippen gesloten · ${preds.length} ${preds.length === 1 ? "tip" : "tips"}`}
        </p>
      )}
      <div className="bet-tile__options">
        <TipOption
          {...tipChipFor(m.team_a_id, chance)}
          teamName={teamLabel(teams[m.team_a_id], profiles)}
          pct={pctA}
          disabled={!tippingOpen || busy}
          onClick={() => tip(m.team_a_id)}
        />
        <TipOption
          {...tipChipFor(m.team_b_id, chance != null ? 1 - chance : null)}
          teamName={teamLabel(teams[m.team_b_id], profiles)}
          pct={pctA != null ? 100 - pctA : null}
          disabled={!tippingOpen || busy}
          onClick={() => tip(m.team_b_id)}
        />
      </div>
      {tippingOpen && (
        <p className="bet-tile__foot">
          {myPrediction
            ? "Je kunt je tip nog wijzigen tot de starttijd."
            : "Tip de winnaar — hoe kleiner de winkans, hoe meer punten (+1 tot +4). Tippen kan tot de starttijd."}
        </p>
      )}
    </section>
  );
}

/** Risico-etiket bij een winkans: de underdog levert de meeste toto-punten. */
function tipTier(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct >= 60) return "favoriet";
  if (pct <= 40) return "underdog";
  return "fifty-fifty";
}

/** Grote, tapbare tip-keuze per team: teamnaam, de te winnen punten met hun
 *  risico-etiket (favoriet/underdog), en hoeveel groepsleden dit team tippen.
 *  Nogmaals tikken op je eigen keuze trekt de tip in. */
function TipOption({
  teamName,
  mine,
  count,
  names,
  pts,
  pct,
  disabled,
  onClick,
}: {
  teamName: string;
  mine: boolean;
  count: number;
  names: string[];
  pts: number | null;
  pct: number | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const tier = tipTier(pct);
  return (
    <button
      type="button"
      className={`toto-opt ${mine ? "toto-opt--mine" : ""}`}
      disabled={disabled}
      aria-pressed={mine}
      aria-label={`Tip ${teamName}`}
      onClick={onClick}
      title={
        count > 0 ? `Getipt door ${names.join(", ")}` : `Tip ${teamName} als winnaar`
      }
    >
      <span className="toto-opt__top">
        <span className="toto-opt__team">{teamName}</span>
        {mine && <span className="toto-opt__mine-flag">jouw tip ✓</span>}
      </span>
      <span className="toto-opt__reward">
        {pts != null && (
          <span className="toto-opt__pts">
            +{pts}
            <span className="toto-opt__pts-unit"> pt</span>
          </span>
        )}
        {tier && <span className="toto-opt__tier">{tier}</span>}
      </span>
      <span className="toto-opt__count">
        {count > 0 ? `${count}× getipt` : "nog niemand"}
      </span>
    </button>
  );
}

/** Samenvatting voor de matchoptie-rij: waar staat de toto nu? */
export function totoSamenvatting(opts: {
  preds: MatchPrediction[];
  myId: string | null;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  tippingOpen: boolean;
}): string {
  const mijn = opts.myId
    ? (opts.preds.find((p) => p.player_id === opts.myId) ?? null)
    : null;
  if (mijn) {
    return `Jouw tip: ${teamLabel(opts.teams[mijn.predicted_team_id], opts.profiles)}`;
  }
  if (opts.preds.length > 0) {
    return `${opts.preds.length} ${opts.preds.length === 1 ? "voorspelling" : "voorspellingen"}`;
  }
  return opts.tippingOpen ? "Nog niemand" : "Geen tips";
}

export default TotoTegel;
