// Kaart-preview (#497): tik op een ranglijst-rij of raster-kaart en de
// FUT-kaart van die speler opent als modal — mét de flip naar vorm, balans
// en klassement, en een knop naar het volledige profiel. Zelfde
// dialoog-recept als de AvatarLightbox: Escape, klik op de achtergrond,
// focus naar het paneel bij openen en terug naar de opener bij sluiten.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { tierForWeergave } from "@/features/rating/tiers";
import { FormChips } from "@/features/rating/components/FormChips";
import {
  FutKaart,
  FutKaartVoorkant,
} from "@/features/rating/components/FutKaart";
import { featuredPlaystyles } from "@/features/profiles/badges";
import {
  primeAvatarMorph,
  statBronVoor,
  type Row,
} from "../leaderboardHelpers";
import {
  editieLabel,
  editieUitleg,
  editieVoor,
  type EditieContext,
} from "../edities";

export function KaartPreview({
  row,
  edities,
  onClose,
}: {
  row: Row;
  /** Editie- en dictator-context (#625): zelfde opbouw als het raster. */
  edities: EditieContext;
  onClose: () => void;
}) {
  const [omgedraaid, setOmgedraaid] = useState(false);
  const draai = () => setOmgedraaid((v) => !v);
  const tier = tierForWeergave(row.rating, row.key === edities.dictatorId);
  const editie = editieVoor(row.key, edities);
  const paneelRef = useRef<HTMLDivElement>(null);

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    paneelRef.current?.focus?.();
    return () => opener?.focus?.();
  }, []);

  // Escape sluit; de pagina eronder scrollt niet mee.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const gespeeld = row.won + row.drawn + row.lost;
  return (
    <div
      className="kaart-preview"
      role="dialog"
      aria-modal="true"
      aria-label={`FUT-kaart van ${row.name}`}
      onClick={onClose}
    >
      <div
        className="kaart-preview__paneel"
        ref={paneelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <FutKaart
          tier={tier}
          editie={editie}
          omgedraaid={omgedraaid}
          voorOverlay={
            <button
              type="button"
              className="fut-kaart__flip"
              onClick={draai}
              aria-expanded={omgedraaid}
              aria-label={`Statistieken van ${row.name}`}
            />
          }
          voor={
            <FutKaartVoorkant
              elo={row.rating}
              tier={tier}
              naam={row.name}
              avatar={
                <Avatar profile={row.profile} name={row.name} size={64} />
              }
              editie={editieLabel(editie, edities, row.key)}
              editieTitel={editieUitleg(editie)}
              // PlayStyles (#500) ook in de preview (#621): dezelfde chips
              // als op de profielkaart.
              playstyles={featuredPlaystyles(row.profile?.featured_badges)}
              statBron={statBronVoor(row)}
            />
          }
          achterOverlay={
            <button
              type="button"
              className="fut-kaart__flip"
              onClick={draai}
              tabIndex={omgedraaid ? 0 : -1}
              aria-label="Draai de kaart terug"
            />
          }
          achter={
            <>
              <span className="fut-kaart__stats-rij">
                <span className="fut-kaart__stats-label">Vorm</span>
                {row.form.length > 0 ? (
                  <FormChips form={row.form} size="sm" />
                ) : (
                  "—"
                )}
              </span>
              <span className="fut-kaart__stats-rij">
                <span className="fut-kaart__stats-label">Balans</span>
                <span
                  aria-label={`${row.won} winst, ${row.drawn} gelijk, ${row.lost} verlies`}
                >
                  {gespeeld > 0
                    ? `${row.won}W · ${row.drawn}G · ${row.lost}V`
                    : "—"}
                </span>
              </span>
              <span className="kaart-preview__statrij">
                <span className="fut-kaart__stats-rij">
                  <span className="fut-kaart__stats-label">Klassement</span>
                  <span>{row.rank != null ? `#${row.rank}` : "—"}</span>
                </span>
                <span className="fut-kaart__stats-rij">
                  <span className="fut-kaart__stats-label">Punten</span>
                  <span>{row.points}</span>
                </span>
              </span>
            </>
          }
        />
        <div className="kaart-preview__acties">
          {row.link && (
            <Link
              className="btn btn--sm btn--primary"
              to={row.link}
              viewTransition
              onClick={primeAvatarMorph}
            >
              Profiel →
            </Link>
          )}
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

export default KaartPreview;
