import { useState } from "react";
import { WrappedSheet } from "@/features/wrapped/components/WrappedSheet";
import {
  jaarPeriode,
  matchesInPeriode,
  matchesInYear,
  seizoenPeriode,
  seizoenWrappedVenster,
  toonWrappedBanner,
  wrappedJaar,
} from "@/features/wrapped/wrapped";
import { seizoenNaam } from "@/features/rating/seasons";
import type { Match, Profile, RatingPoint, Team } from "@/types";
import { readFlag, writeFlag } from "../flags";

// De twee Wrapped-banners van het overzicht (#115, #712) plus de sheets die ze
// openen. Stond in Dashboard.tsx; hier bij elkaar omdat het weg-klik-geheugen,
// het venster en de banner één geheel zijn (#736).

export function WrappedBanners({
  myId,
  myName,
  matches,
  teams,
  profiles,
  ratingHistory,
  rating,
}: {
  myId: string;
  myName: string;
  /** Mijn eigen matches — de sheet rekent hierop, niet op de clubbrede lijst. */
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  ratingHistory: RatingPoint[];
  rating: number | null;
}) {
  // Padel Wrapped (#115): banner in het eindejaarsvenster, weg te klikken per
  // jaar. De sheet hergebruikt de al geladen data (nieuwste 100 matches —
  // in het bannervenster zijn de jaarmatches per definitie recent).
  const wrappedYr = wrappedJaar(new Date());
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [wrappedDismissed, setWrappedDismissed] = useState(() =>
    readFlag(`wrapped-${wrappedYr}-dismissed`),
  );
  const toonWrapped =
    toonWrappedBanner(new Date()) &&
    !wrappedDismissed &&
    matchesInYear(matches, wrappedYr).length > 0;
  const dismissWrapped = () => {
    writeFlag(`wrapped-${wrappedYr}-dismissed`);
    setWrappedDismissed(true);
  };

  // Kwartaal-Wrapped (#712): dezelfde banner-mechaniek, maar in de eerste twee
  // weken van een nieuw kwartaal en over het net afgesloten seizoen.
  // seizoenWrappedVenster zwijgt in het jaarvenster (15 dec – 31 jan), zodat
  // de twee banners elkaar nooit verdringen; het kwartaal blijft dan
  // bereikbaar via het profiel en de Eregalerij (#711).
  const seizoenVenster = seizoenWrappedVenster(new Date());
  const seizoenPer = seizoenVenster ? seizoenPeriode(seizoenVenster) : null;
  const [seizoenOpen, setSeizoenOpen] = useState(false);
  const [seizoenDismissed, setSeizoenDismissed] = useState(() =>
    seizoenVenster ? readFlag(`wrapped-${seizoenVenster.id}-dismissed`) : true,
  );
  const toonSeizoenWrapped =
    seizoenPer != null &&
    !seizoenDismissed &&
    matchesInPeriode(matches, seizoenPer).length > 0;
  const dismissSeizoenWrapped = () => {
    if (seizoenVenster) writeFlag(`wrapped-${seizoenVenster.id}-dismissed`);
    setSeizoenDismissed(true);
  };

  return (
    <>
      {/* Padel Wrapped (#115): eindejaarsbanner, 15 dec t/m 31 jan. */}
      {toonWrapped && (
        <section className="card wrapped-banner">
          <div className="card__head">
            <h2 className="card__title card__title--tight">
              Jouw jaar in padel is klaar 🎁
            </h2>
          </div>
          <p className="wrapped-banner__text">
            Bekijk je Wrapped {wrappedYr}: jouw matches, reeksen en rivalen van
            het afgelopen jaar.
          </p>
          <div className="wrapped-banner__actions">
            <button
              className="btn btn--sm btn--primary"
              aria-haspopup="dialog"
              onClick={() => setWrappedOpen(true)}
            >
              Bekijk
            </button>
            <button className="btn btn--sm" onClick={dismissWrapped}>
              Later
            </button>
          </div>
        </section>
      )}

      {toonSeizoenWrapped && seizoenVenster && (
        <section className="card wrapped-banner">
          <div className="card__head">
            <h2 className="card__title card__title--tight">
              {seizoenNaam(seizoenVenster).emoji} Jouw{" "}
              {seizoenNaam(seizoenVenster).naam} Wrapped is klaar
            </h2>
          </div>
          <p className="wrapped-banner__text">
            Het seizoen zit erop. Bekijk je matches, reeksen en rivalen van{" "}
            {seizoenNaam(seizoenVenster).titel}.
          </p>
          <div className="wrapped-banner__actions">
            <button
              className="btn btn--sm btn--primary"
              aria-haspopup="dialog"
              onClick={() => setSeizoenOpen(true)}
            >
              Bekijk
            </button>
            <button className="btn btn--sm" onClick={dismissSeizoenWrapped}>
              Later
            </button>
          </div>
        </section>
      )}

      {seizoenOpen && seizoenPer && (
        <WrappedSheet
          periode={seizoenPer}
          playerId={myId}
          naam={myName}
          matches={matches}
          teams={teams}
          profiles={profiles}
          ratingHistory={ratingHistory}
          rating={rating}
          onClose={() => setSeizoenOpen(false)}
        />
      )}

      {wrappedOpen && (
        <WrappedSheet
          periode={jaarPeriode(wrappedYr)}
          playerId={myId}
          naam={myName}
          matches={matches}
          teams={teams}
          profiles={profiles}
          ratingHistory={ratingHistory}
          rating={rating}
          onClose={() => setWrappedOpen(false)}
        />
      )}
    </>
  );
}

export default WrappedBanners;
