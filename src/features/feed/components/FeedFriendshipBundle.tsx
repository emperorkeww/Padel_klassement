import { useState, type ReactNode } from "react";
import { Avatar } from "@/ui/Avatar";
import { formatTime } from "@/lib/utils/format";
import { bundelSpelers, type FriendshipBundel } from "../feedLogic";
import type { Profile } from "@/types";

/** Zoveel gezichten toont de samenvatting; de rest zit in het getal. */
const MAX_AVATARS = 5;

/**
 * Samengevatte vriendschapsregel (#944).
 *
 * Een clubavond waarop iedereen elkaar toevoegt leverde acht identieke rijen op
 * met hetzelfde tijdstip, en daaronder verdween de rest van de feed. Dit is één
 * regel met de betrokken gezichten; een tik vouwt de losse rijen alsnog uit, dus
 * er verdwijnt niets — het staat alleen niet meer standaard in de weg.
 */
export function FeedFriendshipBundle({
  bundel,
  pmap,
  myId,
  name,
  children,
}: {
  bundel: FriendshipBundel;
  pmap: Record<string, Profile>;
  myId: string;
  /** "Jij" voor jezelf, anders de weergavenaam. */
  name: (playerId: string) => string;
  /** De losse regels, zichtbaar zodra de bundel openstaat. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const spelers = bundelSpelers(bundel).filter((pid) => pid !== myId);
  const mijn = bundel.events.find((e) => e.a === myId || e.b === myId);
  const mijnAnder = mijn ? (mijn.a === myId ? mijn.b : mijn.a) : null;
  const rest = spelers.length - MAX_AVATARS;

  return (
    <div className={`feed-bundel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="feed-line feed-bundel__kop"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="feed-line__icon" aria-hidden="true">
          🤝
        </span>
        <span className="feed-line__avatars" aria-hidden="true">
          {spelers.slice(0, MAX_AVATARS).map((pid) => (
            <Avatar key={pid} profile={pmap[pid]} size={24} />
          ))}
          {rest > 0 && <span className="feed-bundel__rest">+{rest}</span>}
        </span>
        <span className="feed-line__text">
          <strong>{bundel.events.length} nieuwe vriendschappen</strong>
          {mijnAnder && <> — waaronder jij en {name(mijnAnder)}</>}
          <span className="feed-bundel__hint">
            {open ? "Verbergen" : "Bekijk ze"}
          </span>
        </span>
        <time className="feed-line__time" dateTime={bundel.at}>
          {formatTime(bundel.at)}
        </time>
      </button>
      {open && <ol className="feed-bundel__leden">{children}</ol>}
    </div>
  );
}

export default FeedFriendshipBundle;
