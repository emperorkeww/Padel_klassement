import { Skeleton } from "@/ui/Skeleton";

/**
 * Gereserveerde ruimte voor de "Vandaag"-zone (#911).
 *
 * Poll, volgende match en avondkaart komen elk uit een eigen bron en vielen
 * daardoor gespreid binnen — telkens bovenin de pagina, terwijl je verderop al
 * aan het lezen was. Deze placeholder houdt de plek vast tot alle drie de
 * bronnen er zijn; daarna wisselt de zone in één keer.
 *
 * Twee kaarthoogtes: dat is de meest voorkomende inhoud (een poll of volgende
 * match, plus doorgaans één ander blok). Precies goed raden kan niet — de zone
 * is per definitie van wisselende lengte — maar dit houdt de sprong klein.
 */
export function VandaagSkeleton() {
  return (
    <div className="dash-vandaag__skeleton" aria-hidden="true">
      <div className="card">
        <Skeleton rows={2} />
      </div>
      <div className="card">
        <Skeleton rows={2} />
      </div>
    </div>
  );
}

export default VandaagSkeleton;
