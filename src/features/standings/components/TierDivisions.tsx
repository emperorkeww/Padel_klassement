import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { tierFor, TIER_BANDEN_HOOG_NAAR_LAAG } from "@/features/rating/tiers";
import { primeAvatarMorph, type Row } from "../leaderboardHelpers";

export function TierDivisions({
  rows,
  meRef,
}: {
  rows: Row[];
  /** Anker op je eigen regel voor de "jouw positie"-chip (#913): met tien
   *  divisies onder elkaar is je eigen band niet vanzelf in beeld. */
  meRef?: React.Ref<HTMLLIElement>;
}) {
  // Alleen spelers met een rating hebben een divisie; hoog (Diamant) → laag.
  const withRating = rows.filter((r) => r.rating != null);
  const groups = TIER_BANDEN_HOOG_NAAR_LAAG.map((band) => ({
    band,
    members: withRating.filter(
      (r) => tierFor(r.rating)?.naam === band.naam,
    ),
  })).filter((g) => g.members.length > 0);

  if (groups.length === 0)
    return <p className="empty">Nog geen spelers met een rating.</p>;

  return (
    <div className="divisions">
      {groups.map(({ band, members }) => (
        <section
          key={band.key}
          className={`division division--${band.key}`}
        >
          <h3 className="division__head">
            <span className="division__emoji" aria-hidden="true">
              {band.emoji}
            </span>
            <span className="division__naam">{band.naam}</span>
            <span className="division__count" aria-label={`${members.length} spelers`}>
              {members.length}
            </span>
          </h3>
          <ul className="division__list">
            {members.map((r) => {
              const sub = tierFor(r.rating)?.subLabel;
              const content = (
                <>
                  <Avatar profile={r.profile} name={r.name} size={28} />
                  <span className="division__name">
                    <span className="division__playername">{r.name}</span>
                    {r.isMe && <span className="badge badge--accent">jij</span>}
                  </span>
                  {sub && <span className="division__sub">{sub}</span>}
                  <span className="division__rating">{r.rating}</span>
                </>
              );
              return (
                <li
                  key={r.key}
                  className={`division__row ${r.isMe ? "is-me" : ""}`}
                  ref={r.isMe ? meRef : undefined}
                >
                  {r.link ? (
                    <Link
                      className="division__link"
                      to={r.link}
                      onClick={primeAvatarMorph}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span className="division__link">{content}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}