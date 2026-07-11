import { Link } from "react-router-dom";
import { Stat } from "../../../components/Stat";
import { FormChips } from "../../../components/FormChips";
import { TierBadge } from "../../../components/TierBadge";
import { MatchList } from "../../matches/MatchList";
import { MatchListSkeleton } from "../../../components/Skeleton";
import { winRate } from "../../../lib/results";
import { displayName } from "../api";
import type { ProfileData } from "./types";

// Aantal recente matches in de peek op Overzicht (de volle lijst zit onder de
// Matches-tab).
const PEEK = 3;

// Overzicht-tab: het snelle antwoord op "hoe sta ik/deze speler ervoor?".
// Kerncijfers + context-afhankelijke highlights (eigen voortgang óf de
// jij-vs-kaart) + een korte peek naar de recente matches.
export function ProfileOverview({
  d,
  onOpenBadge,
  onShowMatches,
}: {
  d: ProfileData;
  onOpenBadge: (id: string) => void;
  onShowMatches: () => void;
}) {
  const {
    isMe,
    myRating,
    thinRating,
    ratingDelta,
    rank,
    rate,
    form,
    streak,
    best,
    tierVoortgang,
    nextBadge,
    favoriet,
    balans,
    vsGespeeld,
    samenGespeeld,
    scoped,
    tmap,
    pmap,
    id,
    upsets,
    season,
    matchesLoading,
    p,
  } = d;

  return (
    <>
      <div className="stats stats--overview">
        <Stat
          label="Rating"
          value={myRating ?? "—"}
          delta={ratingDelta}
          primary
          badge={
            myRating != null ? (
              <TierBadge rating={myRating} dimmed={thinRating} size="sm" />
            ) : undefined
          }
        />
        <Stat label="Positie" value={rank ? `#${rank}` : "—"} />
        <Stat label="Winrate" value={rate != null ? `${rate}%` : "—"} />
        <div className="stat">
          <span className="stat__value stat__value--form">
            {form.length > 0 ? <FormChips form={form} /> : "—"}
          </span>
          <span className="stat__label">Vorm</span>
        </div>
      </div>

      {isMe ? (
        <ProfileHighlights
          tierVoortgang={tierVoortgang}
          streak={streak}
          best={best}
          nextBadge={nextBadge}
          favoriet={favoriet}
          pmap={pmap}
          onOpenBadge={onOpenBadge}
        />
      ) : (
        balans && (
          <section className="card">
            <h2 className="card__title">Jij vs {displayName(p)}</h2>
            {vsGespeeld === 0 && samenGespeeld === 0 ? (
              <p className="onderling__leeg">Nog geen gezamenlijke matches.</p>
            ) : (
              <ul className="onderling">
                {vsGespeeld > 0 && (
                  <li className="onderling__rij">
                    <span className="onderling__label">Tegen elkaar</span>
                    <span className="onderling__waarde">
                      Jij won {balans.alsTegenstanders.gewonnen} van de {vsGespeeld}
                    </span>
                  </li>
                )}
                {samenGespeeld > 0 && (
                  <li className="onderling__rij">
                    <span className="onderling__label">Samen</span>
                    <span className="onderling__waarde">
                      {samenGespeeld} {samenGespeeld === 1 ? "match" : "matches"} ·{" "}
                      {winRate(balans.alsPartners.gewonnen, samenGespeeld)}% gewonnen
                    </span>
                  </li>
                )}
              </ul>
            )}
          </section>
        )
      )}

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Recente matches</h2>
          {scoped.length > PEEK && (
            <button type="button" className="btn btn--sm" onClick={onShowMatches}>
              Alles →
            </button>
          )}
        </div>
        {matchesLoading && <MatchListSkeleton count={PEEK} />}
        {!matchesLoading && (
          <MatchList
            matches={scoped.slice(0, PEEK)}
            teams={tmap}
            profiles={pmap}
            perspectiveId={id}
            upsets={upsets}
            empty={
              season
                ? "Geen matches in dit seizoen."
                : "Deze speler heeft nog geen matches gespeeld."
            }
          />
        )}
      </section>
    </>
  );
}

// Eigen-profiel highlights: de leukste "waar sta ik"-feitjes op een rij.
function ProfileHighlights({
  tierVoortgang,
  streak,
  best,
  nextBadge,
  favoriet,
  pmap,
  onOpenBadge,
}: Pick<
  ProfileData,
  "tierVoortgang" | "streak" | "best" | "nextBadge" | "favoriet" | "pmap"
> & { onOpenBadge: (id: string) => void }) {
  const items: React.ReactNode[] = [];

  if (tierVoortgang?.volgende && tierVoortgang.puntenNodig != null) {
    items.push(
      <li key="tier">
        <span aria-hidden="true">{tierVoortgang.volgende.emoji}</span> Nog{" "}
        <strong>{tierVoortgang.puntenNodig}</strong> rating tot{" "}
        {tierVoortgang.volgende.naam}
      </li>,
    );
  }
  if (streak >= 2) {
    items.push(
      <li key="streak">
        <span aria-hidden="true">🔥</span> <strong>{streak}</strong> matches op rij
        gewonnen
      </li>,
    );
  } else if (best > 0) {
    items.push(
      <li key="best">
        <span aria-hidden="true">🔥</span> Langste winreeks: <strong>{best}</strong>
      </li>,
    );
  }
  if (nextBadge?.voortgang) {
    items.push(
      <li key="badge">
        <span aria-hidden="true">{nextBadge.emoji}</span> Volgende badge:{" "}
        <button
          type="button"
          className="link-btn"
          aria-haspopup="dialog"
          onClick={() => onOpenBadge(nextBadge.id)}
        >
          {nextBadge.naam}
        </button>{" "}
        — {nextBadge.voortgang.nu}/{nextBadge.voortgang.doel}
      </li>,
    );
  }
  if (favoriet) {
    items.push(
      <li key="fav">
        <span aria-hidden="true">😎</span> Sterkst tegen{" "}
        <Link to={`/spelers/${favoriet.oppId}`}>
          {displayName(pmap[favoriet.oppId])}
        </Link>{" "}
        — {favoriet.won}× gewonnen
      </li>,
    );
  }

  if (items.length === 0) return null;
  return (
    <section className="card">
      <h2 className="card__title">Highlights</h2>
      <ul className="trend-facts">{items}</ul>
    </section>
  );
}

export default ProfileOverview;
