import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { errorMessage } from "@/lib/utils/errors";
import { formatTime } from "@/lib/utils/format";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import {
  blokkadeUitleg,
  dagBezetDoor,
  lefGestart,
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
  matches,
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
  /** Context van de speeldag (#981): waar je lef al staat als het tegoed
   *  vergeven is. Zonder deze prop valt de tekst terug op "al vergeven". */
  matches?: Match[];
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Elke inzet-mutatie leegt de "match-stakes"-cache; deze teller zorgt dat
  // álle lef-tegels daarop opnieuw ophalen (#907). Het dagtegoed is er één per
  // speeldag, dus wat je op de ene rondekaart doet bepaalt wat op de andere nog
  // mag — zonder dit bleef die andere kaart tot een refresh op zijn oude beeld
  // hangen.
  const rev = useCacheRevision("match-stakes");

  const stakes = useAsync(
    () => (m.group_id ? getMatchStakes(m.id) : Promise.resolve([])),
    [m.id, m.group_id, rev],
  );
  const alle = stakes.data ?? [];
  const mijnInzet = myId ? alle.some((s) => s.player_id === myId) : false;

  // Eigen inzetten op dezelfde speeldag: die dragen het tegoed van één per dag.
  // Alleen ophalen zolang inzetten nog kán — op een gespeelde match is het
  // tegoed niet meer relevant en zou het een tweede query voor niets zijn.
  const dag = m.played_at ? playDay(m.played_at) : null;
  // Is de aftrap geweest? Draagt zowel het inzetvenster als de onthulling.
  const gestart = lefGestart(m);
  const venster = !gestart && m.played_at != null;
  const eigenDag = useAsync(
    () => (myId && dag && venster ? getMyStakesOn(myId, dag) : Promise.resolve([])),
    [myId, dag, venster, rev],
  );

  // Spiegel van match_stakes_guard; de server blijft de echte poort.
  const blokkade = stakeBlokkade({
    match: m,
    isDeelnemer,
    games,
    eigenStakes: eigenDag.data ?? [],
  });
  const openVoorMij = blokkade === null;
  // Na de aftrap wordt zichtbaar wie er lef had. Bewust aan de aftrap gehangen
  // en niet aan je eigen blokkade: wie niet meespeelt — of nog te weinig
  // matches heeft, of zijn lef die dag al vergaf — zag andermans inzet anders
  // al vóór de match staan en kon erop meeliften.
  const onthuld = gestart && alle.length > 0;
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

  // Waar je lef wél staat als het tegoed vergeven is (#981): de eigen inzet op
  // de andere match van deze speeldag, met de kaart erbij als de aanroeper de
  // dagcontext meegaf. Dan kan de voet ernaartoe wijzen in plaats van alleen
  // "al vergeven" te zeggen.
  const doelStake =
    blokkade === "dag-bezet" && m.played_at
      ? dagBezetDoor(eigenDag.data ?? [], m.id, m.played_at)
      : null;
  const doelMatch = doelStake
    ? (matches?.find((kandidaat) => kandidaat.id === doelStake.match_id) ??
      null)
    : null;
  const doelLabel = doelMatch
    ? [
        doelMatch.round_number != null
          ? `ronde ${doelMatch.round_number}`
          : null,
        doelMatch.played_at ? formatTime(doelMatch.played_at) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  function naarDoelMatch() {
    if (!doelMatch) return;
    // matchMedia defensief: jsdom (tests) heeft hem niet.
    const rustig =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`match-${doelMatch.id}`)?.scrollIntoView?.({
      behavior: rustig ? "auto" : "smooth",
      block: "center",
    });
  }

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
      // Geen eigen reload(): setStake/clearStake legen de "match-stakes"-cache
      // en dat trekt via `rev` élke lef-tegel bij — deze kaart incluis. Een
      // reload() hier zou bovendien niet volstaan: die haalt op via dezelfde
      // cache, dus zonder invalidatie kreeg hij zijn eigen oude antwoord terug.
    } catch (err) {
      // Ook de foutkant leunt op die invalidatie: zag de server een blokkade
      // die deze kaart nog niet kende — meestal het dagtegoed dat op een andere
      // rondekaart al vergeven is — dan klopt de tegel meteen daarna weer.
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
            {blokkade === "dag-bezet" && doelMatch && doelLabel ? (
              // Niet alleen "al vergeven": wijs de match aan waar je lef wél
              // staat, met een sprong naar die kaart (#981).
              <>
                Je lef staat vandaag al op{" "}
                <button
                  type="button"
                  className="lef__doel"
                  onClick={naarDoelMatch}
                >
                  {doelLabel}
                </button>{" "}
                — één inzet per speeldag.
              </>
            ) : blokkade ? (
              blokkadeUitleg(blokkade, games)
            ) : (
              "Dubbel of niets: win je, dan telt jouw winst dubbel — verlies je, dan telt je verlies net zo hard. Alleen jouw rating, niet die van je partner. Eén inzet per speeldag, tot de starttijd."
            )}
          </p>
        </>
      )}
      {onthuld && (
        <p className="lef__reveal">Lef getoond door {inzetters.join(", ")}.</p>
      )}
    </section>
  );
}