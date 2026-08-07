import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { Avatar } from "@/ui/Avatar";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import {
  getMatchNetTouches,
  setNetTouches,
} from "@/features/matches/netTouchesApi";
import type { Match, Profile } from "@/types";

/**
 * Netrollers (#809): per speler één teller op een afgeronde match. Iedereen die
 * de match mag zien, ziet de tellers; invullen doet alleen wie meespeelde, en
 * alleen voor zichzelf. De guard-trigger borgt dat serverside.
 *
 * Invoer achteraf op de matchpagina en niet in de invoerwizard: alleen de
 * speler zelf weet zijn aantal, en de wizard wordt vaak door iemand anders
 * ingevuld.
 *
 * Uitgesneden uit MatchDetail in #1144, gedrag ongewijzigd.
 */
export function NetTouchesSection({
  match: m,
  profiles,
  magInvoeren,
}: {
  match: Match;
  profiles: Record<string, Profile>;
  magInvoeren: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const touches = useAsync(
    () =>
      m.status === "completed"
        ? getMatchNetTouches(m.id)
        : Promise.resolve([]),
    [m.id, m.status],
  );
  const [busy, setBusy] = useState(false);
  // null = nog niets aangeraakt; dan volgen we de geladen waarde. ScoreStepper
  // werkt met strings ("" = leeg), vandaar de conversie.
  const [concept, setConcept] = useState<string | null>(null);

  if (m.status !== "completed" || touches.loading) return null;

  const rijen = touches.data ?? [];
  const mijn = rijen.find((t) => t.player_id === user?.id)?.aantal ?? 0;
  const getoond = concept ?? String(mijn);
  const aantal = getoond === "" ? 0 : Number(getoond);
  const gewijzigd = aantal !== mijn;
  const gescoord = rijen.filter((t) => t.aantal > 0);

  // Niets te zien én niets in te vullen: laat de kaart weg.
  if (gescoord.length === 0 && !magInvoeren) return null;

  async function bewaar() {
    if (!user) return;
    setBusy(true);
    try {
      await setNetTouches(m.id, user.id, aantal);
      tap();
      toast.success("Netrollers bewaard.");
      setConcept(null);
      touches.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">🕸️ Netrollers</h2>
      </div>
      {gescoord.length > 0 ? (
        <ul className="md-toto">
          {gescoord.map((t) => (
            <li key={t.player_id} className="md-toto__row">
              <Avatar profile={profiles[t.player_id]} size={24} />
              <Link className="profile-link" to={`/spelers/${t.player_id}`}>
                {displayName(profiles[t.player_id])}
              </Link>
              <span className="badge">{t.aantal}×</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="md-toto__note">
          Ging er een bal via de netband alsnog binnen? Tel hem hier.
        </p>
      )}
      {magInvoeren && (
        <>
          <ScoreStepper
            value={getoond}
            onChange={setConcept}
            label="Mijn netrollers"
          />
          <button
            className="btn btn--sm btn--primary"
            disabled={busy || !gewijzigd}
            onClick={bewaar}
          >
            Bewaren
          </button>
        </>
      )}
    </section>
  );
}

export default NetTouchesSection;
