import { Link } from "react-router-dom";
import { Stat } from "@/ui/Stat";
import { FormChips } from "@/features/rating/components/FormChips";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { MatchList } from "@/features/matches/components/MatchList";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { winRate } from "@/features/rating/results";
import { displayName } from "@/features/profiles/api";
import { HighlightTile } from "@/features/profiles/components/HighlightTile";
import { regeerduurZin } from "@/features/dashboard/dictator";
import type { ProfileData } from "@/features/profiles/components/types";

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
    isDictator,
    regeerduur,
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
              <TierBadge
                rating={myRating}
                dimmed={thinRating}
                size="sm"
                capDictator={!isDictator}
              />
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

      {/* Regeerduur-erepalmpje (#545): wie ooit op De Troon zat draagt dat
          blijvend op zijn profiel — een ereteken voor de zittende dictator, een
          schandpaal-herinnering voor de afgezette. */}
      {regeerduur && (
        <p
          className={`troon-erepalm${regeerduur.zittend ? " troon-erepalm--zittend" : ""}`}
        >
          <span className="troon-erepalm__emoji" aria-hidden="true">
            🫡
          </span>
          {regeerduurZin(
            regeerduur.totaalMs,
            regeerduur.termijnen,
            regeerduur.zittend,
          )}
        </p>
      )}

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
  const tiles: React.ReactNode[] = [];

  if (tierVoortgang?.volgende && tierVoortgang.puntenNodig != null) {
    tiles.push(
      <HighlightTile
        key="tier"
        icon={tierVoortgang.volgende.emoji}
        label="Volgende tier"
        value={tierVoortgang.volgende.naam}
        meta={
          <>
            nog <strong>{tierVoortgang.puntenNodig}</strong> rating
          </>
        }
      />,
    );
  }
  if (streak >= 2) {
    tiles.push(
      <HighlightTile
        key="streak"
        icon="🔥"
        label="Winreeks"
        value={
          <>
            <strong>{streak}</strong> op rij gewonnen
          </>
        }
      />,
    );
  } else if (best > 0) {
    tiles.push(
      <HighlightTile
        key="best"
        icon="🔥"
        label="Langste winreeks"
        value={
          <>
            <strong>{best}</strong> matches
          </>
        }
      />,
    );
  }
  if (nextBadge?.voortgang) {
    tiles.push(
      <HighlightTile
        key="badge"
        icon={nextBadge.emoji}
        label="Volgende badge"
        value={
          <button
            type="button"
            className="highlight-tile__link"
            aria-haspopup="dialog"
            onClick={() => onOpenBadge(nextBadge.id)}
          >
            {nextBadge.naam}
          </button>
        }
        meta={
          <>
            {nextBadge.voortgang.nu}/{nextBadge.voortgang.doel}
          </>
        }
      />,
    );
  }
  if (favoriet) {
    tiles.push(
      <HighlightTile
        key="fav"
        icon="😎"
        label="Sterkst tegen"
        value={
          <Link
            className="highlight-tile__link"
            to={`/spelers/${favoriet.oppId}`}
          >
            {displayName(pmap[favoriet.oppId])}
          </Link>
        }
        meta={<>{favoriet.won}× gewonnen</>}
      />,
    );
  }

  if (tiles.length === 0) return null;
  return (
    <section className="card">
      <h2 className="card__title">Highlights</h2>
      <div className="highlight-tiles">{tiles}</div>
    </section>
  );
}

export default ProfileOverview;
