// Kaartraster (#497): het spelersklassement als wand van FUT-kaarten,
// gesorteerd op rating (dezelfde volgorde, zoek- en filterlogica als de
// tabel), met de rang als munt op elke kaart. Tikken op een kaart opent de
// KaartPreview. De dictator is — net als op de Spelers-tab — al uit de rijen
// gehaald en zit op De Troon erboven.

import { Avatar } from "@/ui/Avatar";
import { tierForWeergave } from "@/features/rating/tiers";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { featuredPlaystyles } from "@/features/profiles/badges";
import type { Row } from "../leaderboardHelpers";
import { editieLabel, editieVoor, type EditieContext } from "../edities";

export function KaartRaster({
  rows,
  edities,
  onPreview,
}: {
  rows: Row[];
  /** Editie- en dictator-context (#625): overal identiek opgebouwd, zodat
   *  de kaart hier dezelfde is als op profiel en veld. */
  edities: EditieContext;
  onPreview: (row: Row) => void;
}) {
  return (
    <ul className="kaart-raster">
      {rows.map((r, i) => {
        const tier = tierForWeergave(r.rating, r.key === edities.dictatorId);
        const editie = editieVoor(r.key, edities);
        const rank = r.rank ?? i + 1;
        return (
          <li key={r.key} className="kaart-raster__cel">
            <span
              className={`kaart-raster__rang${rank <= 3 ? ` kaart-raster__rang--${rank}` : ""}`}
              aria-hidden="true"
            >
              {rank}
            </span>
            <FutKaart
              tier={tier}
              editie={editie}
              voorOverlay={
                <button
                  type="button"
                  className="fut-kaart__flip"
                  onClick={() => onPreview(r)}
                  aria-label={`FUT-kaart van ${r.name} (#${rank})`}
                />
              }
              voor={
                <FutKaartVoorkant
                  elo={r.rating}
                  tier={tier}
                  naam={r.name}
                  avatar={<Avatar profile={r.profile} name={r.name} size={44} />}
                  editie={editieLabel(editie, edities, r.key)}
                  // PlayStyles (#500) ook op de wand (#621): dezelfde
                  // ★-uitgelichte badges als op de profielkaart.
                  playstyles={featuredPlaystyles(r.profile?.featured_badges)}
                />
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export default KaartRaster;
