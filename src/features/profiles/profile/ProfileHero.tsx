import { Avatar } from "../../../components/Avatar";
import { displayName } from "../api";
import type { ProfileData } from "./types";

// Vaste kop boven de tabs: avatar, naam (+ "jij"/streak) en @handle. Altijd
// zichtbaar, ongeacht welke tab open staat. De tier-pil hoort bij de
// rating-tegel (in de tabs), zodat de naam nooit dubbel als kop verschijnt.
export function ProfileHero({ d }: { d: ProfileData }) {
  const { p, isMe, streak, nick, roast } = d;
  return (
    <section className="card profile-hero">
      {/* Zelfde view-transition-naam als de aangetikte klassement-avatar:
          de foto groeit vloeiend door naar deze grote variant. */}
      <span style={{ viewTransitionName: "player-avatar", display: "inline-flex" }}>
        <Avatar profile={p} size={72} />
      </span>
      <div className="profile-hero__body">
        <h1 className="profile-hero__name">
          {displayName(p)}
          {isMe && <span className="badge badge--accent">jij</span>}
          {streak >= 2 && (
            <span className="badge badge--win">{streak} op rij 🔥</span>
          )}
        </h1>
        <p className="profile-hero__handle">@{p.username}</p>
        <p className="profile-hero__nick">“{nick}”</p>
        {roast && (
          <p className="profile-hero__roast" role="note">
            🔥 {roast}
          </p>
        )}
      </div>
    </section>
  );
}

export default ProfileHero;
