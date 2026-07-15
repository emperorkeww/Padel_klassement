import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { formatTime } from "@/lib/utils/format";

/** Highlight-kaart (#232): een groot moment (klassement/roast/kampioen) als
 *  geaccentueerde kaart in de kleur van zijn categorie — i.p.v. dezelfde
 *  compacte regel als routine-items. */
export function FeedHighlight({
  cat,
  icon,
  label,
  to,
  at,
  children,
}: {
  cat: "rank" | "champ" | "roast";
  icon: string;
  label: string;
  to: string;
  at?: string;
  children: ReactNode;
}) {
  return (
    <Link className="feed-hi" data-cat={cat} to={to}>
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
