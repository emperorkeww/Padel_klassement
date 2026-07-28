import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CountUp } from "@/ui/CountUp";
import { FormChips } from "@/features/rating/components/FormChips";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { BountyMark } from "@/features/rating/components/BountyMark";
import { useFlip } from "@/lib/hooks/useFlip";
import { THIN_GAMES } from "@/features/groups/groupRating";
import { ShiftBadge } from "./ShiftBadge";
import { primeAvatarMorph, type Row } from "../leaderboardHelpers";

/* ---------- Mobiel: klassement als leesbare ranglijst i.p.v. krappe tabel ---------- */
export function RankList({
  rows,
  meRef,
  lead,
  onPreview,
}: {
  rows: Row[];
  meRef?: React.Ref<HTMLLIElement>;
  /** Welk getal groot staat: rating (spelers, #139) of punten (teams). */
  lead: "rating" | "points";
  /** Kaart-preview (#497): mét deze callback opent een tik op de rij de
   *  FUT-kaart (overlay-knop) en navigeert alleen de naam nog direct naar het
   *  profiel; zonder blijft de hele rij de profiel-link. */
  onPreview?: (row: Row) => void;
}) {
  const flipRef = useFlip<HTMLOListElement>(rows.map((r) => r.key).join("|"));
  return (
    <ol className="ranklist" ref={flipRef}>
      {rows.map((r, i) => {
        const rank = r.rank ?? i + 1;
        // Podium-tint alleen op het ratingklassement: bij teams zeggen
        // goud/zilver/brons minder (die volgorde is puur op punten).
        const topClass =
          lead === "rating" && rank <= 3 ? ` ranklist__row--top${rank}` : "";
        const preview = onPreview && r.link ? onPreview : null;
        const naam = preview && r.link ? (
          <Link
            className="ranklist__naamlink"
            to={r.link}
            viewTransition
            onClick={primeAvatarMorph}
          >
            {r.name}
          </Link>
        ) : (
          r.name
        );
        const body = (
          <>
            <span className="rank-wrap ranklist__rank">
              <span className={`rank rank--${rank}`}>{rank}</span>
              <ShiftBadge shift={r.shift} />
            </span>
            <Avatar profile={r.profile} name={r.name} size={40} />
            <span className="ranklist__main">
              <span className="ranklist__name">
                {naam}
                {r.isMe && <span className="badge badge--accent">jij</span>}
                <BountyMark pool={r.bounty} />
              </span>
              <span className="ranklist__meta">
                <TierBadge
                  rating={r.rating}
                  dimmed={r.games > 0 && r.games < THIN_GAMES}
                  size="sm"
                  capDictator
                />
                {r.form.length > 0 && <FormChips form={r.form} size="sm" />}
                <span
                  className="ranklist__record"
                  aria-label={`${r.won} winst, ${r.drawn} gelijk, ${r.lost} verlies`}
                >
                  {r.won}·{r.drawn}·{r.lost}
                </span>
              </span>
            </span>
            <span className="ranklist__end">
              <span className="ranklist__lead">
                {lead === "rating" ? (
                  r.rating != null ? (
                    <CountUp value={r.rating} />
                  ) : (
                    "—"
                  )
                ) : (
                  <CountUp value={r.points} />
                )}
              </span>
              <span className="ranklist__lead-label">
                {lead === "rating" ? `${r.points} ptn` : "ptn"}
              </span>
            </span>
          </>
        );
        return (
          <li
            key={r.key}
            data-flip-key={r.key}
            ref={r.isMe ? meRef : undefined}
            className={`ranklist__row ${r.isMe ? "is-me" : ""}${topClass}`}
          >
            {preview ? (
              // Rij-tik = kaart-preview (overlay-knop); de naamlink erbóven
              // blijft direct naar het profiel navigeren — zelfde
              // overlay-recept als de flip-knop op de FutKaart.
              <span className="ranklist__link ranklist__link--preview">
                <button
                  type="button"
                  className="ranklist__kaartknop"
                  onClick={() => preview(r)}
                  aria-label={`FUT-kaart van ${r.name}`}
                />
                {body}
              </span>
            ) : r.link ? (
              <Link
                className="ranklist__link"
                to={r.link}
                viewTransition
                onClick={primeAvatarMorph}
              >
                {body}
              </Link>
            ) : (
              <span className="ranklist__link">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
