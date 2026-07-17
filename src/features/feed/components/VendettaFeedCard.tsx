import { Link } from "react-router-dom";
import { formatTime } from "@/lib/utils/format";
import { ShareVendetta } from "@/features/groups/components/ShareVendetta";
import type { FeedEvent } from "../feedLogic";

/** "Vendetta beslist"-kaart (#169): zelfde opbouw als de FeedHighlight-kaarten,
 *  maar als div zodat de deelknop (poster) naast de tekst kan leven. */
export function VendettaFeedCard({
  event,
  name,
}: {
  event: Extract<FeedEvent, { kind: "vendetta" }>;
  name: (pid: string) => string;
}) {
  const chWon = event.winsChallenger > event.winsRival;
  const winnaarId = chWon ? event.challengerId : event.rivalId;
  const verliezerId = chWon ? event.rivalId : event.challengerId;
  const stand = chWon
    ? `${event.winsChallenger}–${event.winsRival}`
    : `${event.winsRival}–${event.winsChallenger}`;

  return (
    <div className="feed-hi" data-cat="champ">
      <span className="feed-hi__tok" aria-hidden="true">
        🏆
      </span>
      <span className="feed-hi__body">
        <span className="feed-hi__label">Vendetta beslist</span>
        <span className="feed-hi__title">
          <Link to={`/groepen/${event.groupId}`}>
            {name(winnaarId)} beslist de vendetta tegen{" "}
            <strong>{name(verliezerId)}</strong>:{" "}
            <strong>{stand}</strong> in {event.groupName}!
          </Link>
        </span>
        <span className="feed-hi__actions">
          <ShareVendetta
            vendettaId={`${event.groupId}|${event.challengerId}|${event.rivalId}`}
            winnaar={name(winnaarId)}
            verliezer={name(verliezerId)}
            stand={stand}
            groupName={event.groupName}
            doel={event.doel}
          />
        </span>
      </span>
      {event.at && <span className="feed-hi__time">{formatTime(event.at)}</span>}
    </div>
  );
}

export default VendettaFeedCard;
