import { Link } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { Avatar } from "@/ui/Avatar";
import { courtsLabel, longDay } from "@/features/groups/planPollHelpers";
import { pollSharePath } from "@/features/groups/pollsApi";
import type { Profile } from "@/types";
import { statusLabel, tijdvak, type AgendaMarker } from "../agendaLogic";
import { StatusGlyph } from "./StatusGlyph";

/** Hoeveel avatars de stemmersrij toont voordat de rest een telling wordt. */
const MAX_AVATARS = 6;

/**
 * Wat er op een aangetikte dag staat (#1091).
 *
 * Meerdere speeldagen op één dag is normaal — twee groepen die los van elkaar
 * plannen weten niet van elkaar. Het sheet toont ze daarom als lijst, elk met
 * eigen groep, status en boekingsgegevens, en niet als één samengevoegde dag.
 */
export function DagSheet({
  datum,
  markers,
  ledenPerGroep,
  profielen,
  onClose,
}: {
  /** ISO-datum; null = dicht. */
  datum: string | null;
  markers: AgendaMarker[];
  /** Aantal leden per groep — de noemer van "gestemd — 6 van 8". */
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={datum != null}
      onClose={onClose}
      ariaLabel={datum ? longDay(datum) : "Dag"}
      className="sheet--agenda"
    >
      {datum && (
        <div className="dagsheet">
          <p className="dagsheet__datum">{longDay(datum)}</p>
          {markers.length === 0 ? (
            <>
              <p className="dagsheet__titel">Niets gepland</p>
              <p className="dagsheet__leeg">
                Op deze dag staat er nog geen speeldag. Een nieuwe begint bij je
                groep.
              </p>
              <Link className="btn btn--primary dagsheet__actie" to="/spelen">
                Naar je groepen
              </Link>
            </>
          ) : (
            markers.map((m) => (
              <Speeldag
                key={m.optionId}
                marker={m}
                leden={ledenPerGroep[m.groupId] ?? 0}
                profielen={profielen}
              />
            ))
          )}
        </div>
      )}
    </Sheet>
  );
}

function Speeldag({
  marker,
  leden,
  profielen,
}: {
  marker: AgendaMarker;
  leden: number;
  profielen: Record<string, Profile>;
}) {
  const geboekt = marker.status === "booked" && !marker.past;
  const toonBoeking = geboekt && (marker.courts || marker.accessCode);
  const stemmers = marker.yesVoterIds;
  return (
    <article className="dagsheet__speeldag">
      <header className="dagsheet__kop">
        <p className="dagsheet__tijd">{tijdvak(marker.startTime, marker.duration)}</p>
        <span className={`dagsheet__badge dagsheet__badge--${marker.past ? "past" : marker.status}`}>
          <StatusGlyph status={marker.status} past={marker.past} size={9} />
          {statusLabel(marker.status, marker.past)}
        </span>
      </header>

      <p className="dagsheet__chips">
        <span className="dagsheet__chip dagsheet__chip--groep">{marker.groupName}</span>
        <span className="dagsheet__chip">{marker.clubName}</span>
      </p>

      {toonBoeking ? (
        <div className="dagsheet__tegels">
          {marker.courts && (
            <div className="dagsheet__tegel">
              <span className="dagsheet__tegel-label">Banen</span>
              <span className="dagsheet__tegel-waarde">{courtsLabel(marker.courts)}</span>
            </div>
          )}
          {marker.accessCode && (
            <div className="dagsheet__tegel">
              <span className="dagsheet__tegel-label">Toegangscode</span>
              <span className="dagsheet__tegel-waarde dagsheet__code">
                {marker.accessCode}
              </span>
            </div>
          )}
        </div>
      ) : (
        marker.status === "locked" && (
          <p className="dagsheet__nogboeken">
            Het moment ligt vast — de baan moet nog geboekt worden.
          </p>
        )
      )}

      {stemmers.length > 0 && (
        <div className="dagsheet__stemmers">
          <span className="dagsheet__tegel-label">
            Ik kan{leden > 0 ? ` — ${stemmers.length} van ${leden}` : ` — ${stemmers.length}`}
          </span>
          <p className="dagsheet__avatars">
            {stemmers.slice(0, MAX_AVATARS).map((id) => (
              <Avatar key={id} profile={profielen[id]} size={28} short />
            ))}
            {leden > stemmers.length && (
              <span className="dagsheet__rest">
                +{leden - stemmers.length} nog niet
              </span>
            )}
          </p>
        </div>
      )}

      <Link
        className="btn btn--primary dagsheet__actie"
        to={pollSharePath(marker.groupId, marker.pollId)}
      >
        Open speeldag
      </Link>
    </article>
  );
}

export default DagSheet;
