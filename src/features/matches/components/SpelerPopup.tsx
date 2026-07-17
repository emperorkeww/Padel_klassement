// Korte spelersamenvatting (#427): popup bij het tikken op een kaart in de
// opstelling — Elo + divisie, recente vorm en balans, met een doorklik naar
// het volledige profiel. Laadt zijn eigen (gecachte) data: de matches van de
// opstelling dekken alleen dít duo, terwijl de vorm over álle matches van de
// speler gaat.

import { Link } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { Avatar } from "@/ui/Avatar";
import { useAsync } from "@/lib/hooks/useAsync";
import { displayName } from "@/features/profiles/api";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { CHEMIE_MATCH_LIMIT } from "@/features/matches/chemistry";
import { outcomeFor, recentForm } from "@/features/rating/results";
import { FormChips } from "@/features/rating/components/FormChips";
import { TierBadge } from "@/features/rating/components/TierBadge";
import type { Profile } from "@/types";
import "./SpelerPopup.css";

export function SpelerPopup({
  pid,
  profiel,
  elo,
  onClose,
}: {
  pid: string;
  profiel: Profile | undefined;
  /** Elo zoals op de kaart (na deze match, of de huidige rating). */
  elo: number | null;
  onClose: () => void;
}) {
  const matches = useAsync(
    () => getPlayerMatches(pid, CHEMIE_MATCH_LIMIT),
    [pid],
  );
  const teams = useAsync(getTeamsMap, []);

  const ms = matches.data ?? [];
  const tmap = teams.data ?? {};
  const vorm = recentForm(ms, tmap, pid);
  // Balans over de recente matches (zelfde venster als de chemie).
  const balans = { W: 0, D: 0, L: 0 };
  for (const m of ms) {
    const o = outcomeFor(m, tmap, pid);
    if (o) balans[o]++;
  }
  const gespeeld = balans.W + balans.D + balans.L;

  return (
    <Sheet
      open
      onClose={onClose}
      title={profiel ? displayName(profiel) : "Onbekende speler"}
      compact
    >
      <div className="speler-popup">
        <div className="speler-popup__kop">
          <Avatar profile={profiel} size={56} />
          <div className="speler-popup__rating">
            <span className="speler-popup__elo">{elo ?? "—"}</span>
            <span className="speler-popup__elo-label">Elo</span>
            <TierBadge rating={elo} size="sm" />
          </div>
        </div>

        <dl className="speler-popup__feiten">
          <div>
            <dt>Vorm</dt>
            <dd>
              {vorm.length > 0 ? <FormChips form={vorm} /> : "Nog geen matches"}
            </dd>
          </div>
          <div>
            <dt>Balans</dt>
            <dd>
              {gespeeld > 0
                ? `${balans.W} winst · ${balans.D} gelijk · ${balans.L} verlies`
                : "—"}
              {gespeeld >= CHEMIE_MATCH_LIMIT && (
                <span className="speler-popup__venster">
                  {" "}
                  (laatste {CHEMIE_MATCH_LIMIT})
                </span>
              )}
            </dd>
          </div>
        </dl>

        {profiel && (
          <Link className="btn btn--sm" to={`/spelers/${pid}`}>
            Volledig profiel →
          </Link>
        )}
      </div>
    </Sheet>
  );
}

export default SpelerPopup;
