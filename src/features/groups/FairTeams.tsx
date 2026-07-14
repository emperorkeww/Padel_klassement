import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { fairTeams, type FairTeam } from "@/features/groups/fairTeamsLogic";
import { tap } from "@/lib/utils/haptics";
import { getPlayerRatings } from "../standings/ratingsApi";
import { displayName } from "../profiles/api";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { createFairRound, type FairCourt } from "./api";
import type { Profile } from "@/types";

// "Eerlijke teams" — stelt uit de aanwezigen van de speeldag teams voor met
// een zo klein mogelijk ratingverschil per baan, met de verwachte winstkans
// volgens dezelfde Elo als de winstkans op geplande matches. Met "Speel deze
// teams" worden de banen als geplande matches weggeschreven, zodat RSVP ->
// eerlijke teams -> uitslag één doorlopende flow wordt.

export function FairTeamsCard({
  groupId,
  playerIds,
  profiles,
}: {
  /** Groep waarbinnen de matches gepland worden. */
  groupId: string;
  /** Spelers die "ja" zeiden voor de gekozen speeldag. */
  playerIds: string[];
  profiles: Record<string, Profile>;
}) {
  const toast = useToast();
  const ratings = useAsync(getPlayerRatings, []);
  // null = nog geen voorstel; 0 = eerlijkst, 1 = op één na eerlijkst, …
  const [variant, setVariant] = useState<number | null>(null);
  // Bankbeurten per speler tot nu toe — zodat "Opnieuw" de reserve laat
  // rouleren i.p.v. steeds dezelfde (laagst geratede) speler op de bank te zetten.
  const [benched, setBenched] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const enough = playerIds.length >= 4;
  const proposal =
    variant !== null && enough && ratings.data
      ? fairTeams(playerIds, ratings.data, variant, { benched })
      : null;

  const names = (team: FairTeam) =>
    team.playerIds.map((id) => displayName(profiles[id])).join(" & ");

  /** Reshuffelt de splitsingen én laat de bankbeurt rouleren. */
  function reshuffle() {
    tap();
    if (proposal && proposal.reserves.length > 0) {
      setBenched((prev) => {
        const next = { ...prev };
        for (const id of proposal.reserves) next[id] = (next[id] ?? 0) + 1;
        return next;
      });
    }
    setVariant((v) => ((v ?? 0) + 1) % 3);
  }

  async function play() {
    if (!proposal) return;
    setSaving(true);
    try {
      const courts: FairCourt[] = proposal.courts.map((c) => ({
        teamA: c.teamA.playerIds,
        teamB: c.teamB.playerIds,
      }));
      const ids = await createFairRound(groupId, courts);
      if (ids.length === 0) throw new Error("Geen matches aangemaakt.");
      tap();
      toast.success(
        ids.length === 1
          ? "Match ingepland — vul straks de uitslag in."
          : `${ids.length} matches ingepland — vul straks de uitslagen in.`,
      );
      setVariant(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">Eerlijke teams</h2>
      <p className="card__subtitle">
        Verdeelt de aanwezige spelers per baan in teams met een zo gelijk
        mogelijke rating.
      </p>

      <div className="fair-teams__actions">
        <button
          className="btn btn--primary"
          disabled={!enough || !ratings.data}
          onClick={() => {
            tap();
            setVariant(0);
          }}
        >
          Stel eerlijke teams voor
        </button>
        {proposal && (
          <button
            className="btn"
            title="Andere verdeling; laat de reserve rouleren"
            onClick={reshuffle}
          >
            Opnieuw
          </button>
        )}
        {proposal && proposal.courts.length > 0 && (
          <button
            className="btn btn--primary"
            disabled={saving}
            onClick={play}
            title="Zet deze teams als geplande matches klaar"
          >
            {saving ? "Bezig…" : "Speel deze teams"}
          </button>
        )}
      </div>

      {!enough && (
        <p className="empty">
          Minimaal 4 aanwezigen nodig om teams voor te stellen.
        </p>
      )}

      {proposal && (
        <div className="fair-teams__result">
          {proposal.courts.map((court, i) => {
            const pctA = Math.round(court.chanceA * 100);
            return (
              <div key={court.teamA.playerIds.join("-")} className="fair-court">
                <span className="fair-court__label">Baan {i + 1}</span>
                <span className="fair-court__teams">
                  <span className="fair-court__team">
                    {names(court.teamA)}{" "}
                    <span className="fair-court__pct">({pctA}%)</span>
                  </span>
                  <span className="fair-court__vs">vs</span>
                  <span className="fair-court__team">
                    {names(court.teamB)}{" "}
                    <span className="fair-court__pct">({100 - pctA}%)</span>
                  </span>
                </span>
              </div>
            );
          })}
          {proposal.reserves.length > 0 && (
            <p className="fair-teams__reserves">
              Reserve{proposal.reserves.length === 1 ? "" : "s"}:{" "}
              {proposal.reserves.map((id) => displayName(profiles[id])).join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default FairTeamsCard;
