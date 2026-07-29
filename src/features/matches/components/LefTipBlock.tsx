import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import {
  blokkadeUitleg,
  playDay,
  stakeBlokkade,
  stakeSwing,
} from "@/features/matches/stakes";
import {
  clearStake,
  getMatchStakes,
  getMyStakesOn,
  setStake,
} from "@/features/matches/stakesApi";
import type { Match, Profile } from "@/types";
import "./LefTipBlock.css";

/** Lef-tip (#804): dubbel-of-niets op je eigen Elo-mutatie. Een open tegel
 *  naast de toto — in het eigen lef-violet, zodat het risicospel van de
 *  spelers zich onderscheidt van het kijkersspel ernaast. De afweging
 *  (verdubbelde vs. normale mutatie) staat er meteen bij, vóór je beslist.
 *
 *  Vóór de aftrap zie je alleen je eigen inzet: wie er lef had wordt pas
 *  onthuld zodra de match begonnen is, zodat niemand op andermans keuze kan
 *  meeliften. Daarna is het opschepmateriaal. */
export function LefTipBlock({
  match: m,
  profiles,
  myId,
  isDeelnemer,
  mijnKans,
  games,
}: {
  match: Match;
  profiles: Record<string, Profile>;
  /** Ingelogde speler; zonder gebruiker valt er niets in te zetten. */
  myId: string | null;
  /** Speelt de ingelogde gebruiker zelf mee in deze match? */
  isDeelnemer: boolean;
  /** Winkans van het team van de gebruiker (0..1), of null zonder ratings. */
  mijnKans: number | null;
  /** Aantal gespeelde matches van de gebruiker (drempel uit de guard). */
  games: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const stakes = useAsync(
    () => (m.group_id ? getMatchStakes(m.id) : Promise.resolve([])),
    [m.id, m.group_id],
  );
  const alle = stakes.data ?? [];
  const mijnInzet = myId ? alle.some((s) => s.player_id === myId) : false;

  // Eigen inzetten op dezelfde speeldag: die dragen het tegoed van één per dag.
  // Alleen ophalen zolang inzetten nog kán — op een gespeelde match is het
  // tegoed niet meer relevant en zou het een tweede query voor niets zijn.
  const dag = m.played_at ? playDay(m.played_at) : null;
  const venster =
    m.status === "scheduled" &&
    m.played_at != null &&
    new Date(m.played_at).getTime() > Date.now();
  const eigenDag = useAsync(
    () => (myId && dag && venster ? getMyStakesOn(myId, dag) : Promise.resolve([])),
    [myId, dag, venster],
  );

  // Spiegel van match_stakes_guard; de server blijft de echte poort.
  const blokkade = stakeBlokkade({
    match: m,
    isDeelnemer,
    games,
    eigenStakes: eigenDag.data ?? [],
  });
  const openVoorMij = blokkade === null;
  // Na de aftrap wordt zichtbaar wie er lef had.
  const onthuld = !openVoorMij && alle.length > 0;
  // Op een afgeronde match valt er niets meer te kiezen: dan alleen de
  // onthulling, geen uitgegrijsde knop die suggereert dat het nog kan.
  const afgelopen = m.status === "completed" || m.status === "cancelled";

  // Deelnemers zien het blok altijd; anderen pas als er iets te onthullen valt.
  if (!m.group_id || (!isDeelnemer && !onthuld)) return null;
  // Op een gespeelde match zonder inzetten valt er niets te vertellen. Pas
  // beslissen als de inzetten geladen zijn, anders flikkert het blok.
  if (afgelopen && (stakes.data == null || alle.length === 0)) return null;

  const inzetters = alle.map((s) => displayName(profiles[s.player_id]));
  const swing = mijnKans != null ? stakeSwing(mijnKans, true) : null;
  const normaal = mijnKans != null ? stakeSwing(mijnKans, false) : null;

  const samenvatting = mijnInzet
    ? openVoorMij
      ? "jouw lef staat ingezet"
      : "je speelde dubbel of niets"
    : openVoorMij
      ? "dubbel of niets?"
      : onthuld
        ? `lef: ${inzetters.join(", ")}`
        : "geen inzet";

  async function schakel() {
    if (!myId || !m.group_id || busy || !openVoorMij) return;
    setBusy(true);
    try {
      if (mijnInzet) {
        await clearStake(m.id, myId);
        toast.success("Inzet ingetrokken.");
      } else {
        await setStake({ matchId: m.id, groupId: m.group_id, playerId: myId });
        toast.success("Lef ingezet: dubbel of niets.");
      }
      tap();
      stakes.reload();
      eigenDag.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bet-tile bet-tile--lef" aria-label="Lef">
      <header className="bet-tile__head">
        <span className="bet-tile__name">🎲 Lef</span>
        <span className="bet-tile__stat">{samenvatting}</span>
      </header>
      {isDeelnemer && !afgelopen && (
        <>
          {swing && normaal && (
            <p className="lef__swing">
              Met lef <strong className="lef__win">+{swing.winst}</strong> bij
              winst, <strong className="lef__loss">{swing.verlies}</strong>{" "}
              bij verlies — zonder inzet +{normaal.winst} / {normaal.verlies}
              .
            </p>
          )}
          <button
            type="button"
            className={`lef__toggle ${mijnInzet ? "lef__toggle--on" : ""}`}
            disabled={!openVoorMij || busy}
            onClick={schakel}
          >
            {mijnInzet ? "Inzet intrekken" : "Zet je lef in"}
          </button>
          <p className="bet-tile__foot">
            {blokkade
              ? blokkadeUitleg(blokkade, games)
              : "Dubbel of niets: win je, dan telt jouw winst dubbel — verlies je, dan telt je verlies net zo hard. Alleen jouw rating, niet die van je partner. Eén inzet per speeldag, tot de starttijd."}
          </p>
        </>
      )}
      {onthuld && (
        <p className="lef__reveal">Lef getoond door {inzetters.join(", ")}.</p>
      )}
    </section>
  );
}