import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { formatTime } from "@/lib/utils/format";

/** Editie-skins (#986): dezelfde kaart, maar in het materiaal van de FUT-editie
 *  in plaats van in zijn categoriekleur. Alleen voor de twee tijdelijke edities
 *  — dit is een uitzondering voor wie een kaart draagt, geen tweede palet. */
export type FeedEditie = "inform" | "onfire";

/** Highlight-kaart (#232): een groot moment (klassement/roast/kampioen) als
 *  geaccentueerde kaart in de kleur van zijn categorie — i.p.v. dezelfde
 *  compacte regel als routine-items. */
export function FeedHighlight({
  cat,
  editie,
  icon,
  label,
  to,
  at,
  children,
}: {
  cat: "rank" | "champ" | "roast";
  /** Overschrijft alléén het materiaal; `cat` blijft de soort bepalen, zodat de
   *  filterchip en zijn stip kloppen. */
  editie?: FeedEditie;
  icon: string;
  label: string;
  to: string;
  /** Klok-tijd; net als bij FeedLine alleen meegeven bij een écht
      gebeurtenismoment. Klassement, kampioen en de pias van de maand dateren
      zich op een periodegrens — die toonde hier "00:00" alsof er om middernacht
      iets gebeurde (#1272). */
  at?: string;
  children: ReactNode;
}) {
  return (
    <Link
      className={editie ? `feed-hi feed-hi--${editie}` : "feed-hi"}
      data-cat={cat}
      to={to}
    >
      <span className="feed-hi__tok" aria-hidden="true">
        {icon}
      </span>
      <span className="feed-hi__body">
        <span className="feed-hi__label">{label}</span>
        <span className="feed-hi__title">{children}</span>
      </span>
      {at && <span className="feed-hi__time">{formatTime(at)}</span>}
    </Link>
  );
}
