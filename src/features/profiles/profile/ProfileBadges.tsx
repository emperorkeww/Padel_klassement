import { Skeleton } from "../../../components/Skeleton";
import type { ProfileData } from "./types";

// Badges-tab: uitgelichte pillen + het volledige raster met ☆-toggle (alleen
// op je eigen profiel) en een tikbare uitleg-popup (state leeft in de parent).
export function ProfileBadges({
  d,
  onOpenBadge,
  onToggleFeatured,
}: {
  d: ProfileData;
  onOpenBadge: (id: string) => void;
  onToggleFeatured: (id: string) => void;
}) {
  const { badges, featuredBadges, featuredIds, isMe, earnedAllTime, matchesLoading } = d;

  return (
    <section className="card">
      <h2 className="card__title">Badges</h2>
      {matchesLoading && <Skeleton rows={3} />}
      {!matchesLoading && featuredBadges.length > 0 && (
        <div className="badges-featured">
          <h3 className="badges-featured__title">Uitgelichte badges</h3>
          <ul className="badges">
            {featuredBadges.map((b) => (
              <li key={b.id} className="badges__item">
                <button
                  type="button"
                  className="badge badges__pill badge--accent"
                  title={b.omschrijving}
                  aria-haspopup="dialog"
                  onClick={() => onOpenBadge(b.id)}
                >
                  <span className="badges__emoji" aria-hidden="true">
                    {b.emoji}
                  </span>
                  {b.naam}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!matchesLoading && (
        <>
      <p className="badges__hint">
        {badges.some((b) => b.behaald)
          ? "Tik op een badge voor de uitleg"
          : "Speel matches om deze badges te verdienen · tik op een badge voor de uitleg"}
        {isMe &&
          earnedAllTime.size > 0 &&
          " · tik op ★ om een behaalde badge uit te lichten op je profiel"}
        .
      </p>
      <ul className="badges">
        {badges.map((b) => {
          const kanUitlichten = isMe && earnedAllTime.has(b.id);
          const uitgelicht = featuredIds.includes(b.id);
          return (
            <li key={b.id} className="badges__item">
              <button
                type="button"
                className={`badge badges__pill${b.behaald ? " badge--accent" : " badges__pill--dim"}`}
                title={b.omschrijving}
                aria-haspopup="dialog"
                onClick={() => onOpenBadge(b.id)}
              >
                <span className="badges__emoji" aria-hidden="true">
                  {b.emoji}
                </span>
                {b.naam}
                {!b.behaald && b.voortgang && (
                  <span className="badges__progress">
                    {b.voortgang.nu}/{b.voortgang.doel}
                  </span>
                )}
              </button>
              {kanUitlichten && (
                <button
                  type="button"
                  className={`badges__star${uitgelicht ? " badges__star--on" : ""}`}
                  aria-pressed={uitgelicht}
                  title={
                    uitgelicht ? "Uit uitgelicht halen" : "Uitlichten op profiel"
                  }
                  onClick={() => onToggleFeatured(b.id)}
                >
                  {uitgelicht ? "★" : "☆"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
        </>
      )}
    </section>
  );
}

export default ProfileBadges;
