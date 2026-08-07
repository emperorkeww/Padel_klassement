import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { fairTeams, type FairTeam } from "@/features/groups/fairTeamsLogic";
import { tap } from "@/lib/utils/haptics";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { displayName } from "@/features/profiles/api";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { createFairRound, type FairCourt } from "@/features/groups/api";
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
  playedAt,
  aantal = 1,
  startVoor,
  ingebed = false,
  onGenerated,
}: {
  /** Groep waarbinnen de matches gepland worden. */
  groupId: string;
  /** Spelers die "ja" zeiden voor de gekozen speeldag. */
  playerIds: string[];
  profiles: Record<string, Profile>;
  /** Starttijd (ISO) van deze ronde (#827); null zonder speeldag-poll. */
  playedAt?: string | null;
  /** Hoeveel rondes "Speel deze teams" wegschrijft (#1141). Elke ronde krijgt
   *  een eigen verdeling — dezelfde lus die de knop op de speeldagkaart had. */
  aantal?: number;
  /** Starttijd van ronde `index` binnen deze reeks; zonder deze functie krijgen
   *  alle rondes `playedAt` mee, zoals voorheen. */
  startVoor?: (index: number) => string | null;
  /** Onder de speelformaat-kaart (#1089): daar staan de titel, de uitleg en de
   *  knop "Stel eerlijke teams voor" al, en de kaart ís de reactie op die knop.
   *  Herhaalt hij ze, dan lees je hetzelfde drie keer. */
  ingebed?: boolean;
  /** Aangeroepen nadat de rondes weggeschreven zijn, zodat de pagina eromheen
   *  ze meteen kan tonen. De speeldagpagina heeft dit nodig: die luisterde
   *  nergens mee (#1141). */
  onGenerated?: () => void;
}) {
  const toast = useToast();
  const ratings = useAsync(getPlayerRatings, []);
  // null = nog geen voorstel; 0 = eerlijkst, 1 = op één na eerlijkst, …
  // Ingebed is de kaart zelf al het antwoord op de knop, dus dan meteen 0.
  const [variant, setVariant] = useState<number | null>(ingebed ? 0 : null);
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
    if (!proposal || !ratings.data) return;
    setSaving(true);
    try {
      let total = 0;
      // Eén serverronde per gevraagde ronde, met een oplopende variant: het
      // voorstel dat je ziet is ronde 1, de rondes erna krijgen een eigen
      // verdeling. Precies wat de knop op de speeldagkaart deed (#727/#1141),
      // maar nu vanuit de vorm die je zelf koos.
      for (let i = 0; i < Math.max(1, aantal); i++) {
        const ronde =
          i === 0
            ? proposal
            : fairTeams(playerIds, ratings.data, (variant ?? 0) + i, { benched });
        const courts: FairCourt[] = ronde.courts.map((c) => ({
          teamA: c.teamA.playerIds,
          teamB: c.teamB.playerIds,
        }));
        if (courts.length === 0) break;
        const ids = await createFairRound(
          groupId,
          courts,
          startVoor ? startVoor(i) : playedAt,
        );
        total += ids.length;
      }
      if (total === 0) throw new Error("Geen matches aangemaakt.");
      tap();
      toast.success(
        total === 1
          ? "Match ingepland — vul straks de uitslag in."
          : `${total} matches ingepland — vul straks de uitslagen in.`,
      );
      setVariant(null);
      onGenerated?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      {!ingebed && (
        <>
          <h2 className="card__title card__title--tight">Eerlijke teams</h2>
          <p className="card__subtitle">
            Verdeelt de aanwezige spelers per baan in teams met een zo gelijk
            mogelijke rating.
          </p>
        </>
      )}

      <div className="fair-teams__actions">
        {!ingebed && (
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
        )}
        {proposal && (
          <button className="btn" onClick={reshuffle}>
            Andere verdeling
          </button>
        )}
        {proposal && proposal.courts.length > 0 && (
          <button
            className="btn btn--primary"
            disabled={saving}
            onClick={play}
          >
            {saving
              ? "Bezig…"
              : aantal > 1
                ? `Speel deze ${aantal} rondes`
                : "Speel deze teams"}
          </button>
        )}
      </div>

      {/* Wat de twee knoppen dóén stond alleen in een `title` (#924): op touch
          onbereikbaar, met het toetsenbord lastig. "Opnieuw" draagt zijn uitleg
          nu in het label zelf; de gevolgen van "Speel deze teams" staan er als
          gewone regel onder, waar iedereen ze ziet. */}
      {proposal && proposal.courts.length > 0 && (
        <p className="fair-teams__uitleg">
          {aantal > 1
            ? `“Andere verdeling” laat de reserve rouleren; “Speel deze ${aantal} rondes” zet ze klaar als geplande matches — elke ronde met een eigen verdeling.`
            : "“Andere verdeling” laat de reserve rouleren; “Speel deze teams” zet ze klaar als geplande matches."}
        </p>
      )}

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
