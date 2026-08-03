import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import {
  JOKERS,
  jokerBlokkade,
  jokerBlokkadeUitleg,
  jokerGestart,
  jokerIcoon,
  jokerLabel,
  jokerSwing,
  maandLabel,
  periodeMaand,
  zichtbareJokers,
  type JokerId,
} from "@/features/matches/jokers";
import {
  clearJoker,
  getMatchJokers,
  getMyJokerInMonth,
  setJoker,
} from "@/features/matches/jokersApi";
import { getMatchStakes } from "@/features/matches/stakesApi";
import type { Match, Profile } from "@/types";
import "./JokerBlock.css";

/** Jokers (#1003): je kaart van de maand, uit te spelen op deze match. Een
 *  open tegel naast de lef-tip, in een eigen jokerblauw — de lef-tip is je
 *  dagelijkse zenuwspel, dit is de ene kaart die je per maand hebt en dus een
 *  zwaardere keuze.
 *
 *  Wat je ziet hangt af van de kaart. Wissel van kant is meteen zichtbaar voor
 *  iedereen: die verandert hoe er gespeeld wordt, dus wie het pas bij de eerste
 *  bal hoort staat verkeerd opgesteld. Schild en dubbel of niets blijven tot de
 *  aftrap van jou alleen, zodat niemand op je risicokeuze kan meeliften. */
export function JokerBlock({
  match: m,
  profiles,
  myId,
  isDeelnemer,
  mijnKans,
  games,
}: {
  match: Match;
  profiles: Record<string, Profile>;
  /** Ingelogde speler; zonder gebruiker valt er niets te spelen. */
  myId: string | null;
  /** Speelt de ingelogde gebruiker zelf mee in deze match? */
  isDeelnemer: boolean;
  /** Winkans van het team van de gebruiker (0..1), of null zonder ratings. */
  mijnKans: number | null;
  /** Aantal gespeelde matches van de gebruiker (drempel uit de guard). */
  games: number;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<JokerId | null>(null);

  // Elke joker-mutatie leegt de "match-jokers"-cache; deze teller zorgt dat
  // álle jokertegels daarop opnieuw ophalen. Het tegoed is er één per maand,
  // dus wat je op de ene rondekaart doet bepaalt wat op de andere nog mag —
  // zonder dit bleef die andere kaart tot een refresh op zijn oude beeld hangen.
  const rev = useCacheRevision("match-jokers");
  const stakesRev = useCacheRevision("match-stakes");

  const jokers = useAsync(
    () => (m.group_id ? getMatchJokers(m.id) : Promise.resolve([])),
    [m.id, m.group_id, rev],
  );
  const alle = jokers.data ?? [];
  const mijnKaart = myId
    ? (alle.find((j) => j.player_id === myId) ?? null)
    : null;

  // Is de aftrap geweest? Draagt zowel het speelvenster als de onthulling.
  const gestart = jokerGestart(m);
  const venster = !gestart && m.played_at != null;

  // Je eigen kaart van deze maand: die draagt het tegoed van één per maand.
  // Alleen ophalen zolang spelen nog kán — op een gespeelde match is het tegoed
  // niet meer relevant en zou het een tweede query voor niets zijn.
  const maand = m.played_at ? periodeMaand(m.played_at) : null;
  const eigenMaand = useAsync(
    () =>
      myId && maand && venster
        ? getMyJokerInMonth(myId, maand)
        : Promise.resolve([]),
    [myId, maand, venster, rev],
  );

  // De rating-kaarten sluiten een lef-tip op dezelfde match uit (en andersom);
  // die query is gedeeld met de lef-tegel, dus hij kost hier niets extra.
  const stakes = useAsync(
    () => (m.group_id && venster ? getMatchStakes(m.id) : Promise.resolve([])),
    [m.id, m.group_id, venster, stakesRev],
  );
  const eigenStakes = myId
    ? (stakes.data ?? []).filter((s) => s.player_id === myId)
    : [];

  const zichtbaar = zichtbareJokers({ match: m, jokers: alle, myId });
  const anderen = zichtbaar.filter((j) => j.player_id !== myId);
  // Op een afgeronde match valt er niets meer te kiezen: dan alleen de
  // onthulling, geen uitgegrijsde knoppen die suggereren dat het nog kan.
  const afgelopen = m.status === "completed" || m.status === "cancelled";

  // Deelnemers zien het blok altijd; anderen pas als er iets te tonen valt.
  if (!m.group_id || (!isDeelnemer && zichtbaar.length === 0)) return null;
  // Op een gespeelde match zonder kaarten valt er niets te vertellen. Pas
  // beslissen als de jokers geladen zijn, anders flikkert het blok.
  if (afgelopen && (jokers.data == null || zichtbaar.length === 0)) return null;

  const samenvatting = mijnKaart
    ? `${jokerIcoon(mijnKaart.joker)} ${jokerLabel(mijnKaart.joker)}`
    : zichtbaar.length > 0
      ? zichtbaar
          .map((j) => `${displayName(profiles[j.player_id])}: ${jokerLabel(j.joker)}`)
          .join(" · ")
      : maand
        ? `kaart van ${maandLabel(maand)} ligt klaar`
        : "geen kaart";

  async function schakel(joker: JokerId) {
    if (!myId || !m.group_id || busy) return;
    setBusy(joker);
    try {
      if (mijnKaart?.joker === joker) {
        await clearJoker(m.id, myId);
        toast.success("Kaart ingetrokken.");
      } else {
        // Van kaart wisselen is intrekken en opnieuw spelen: de tabel kent geen
        // update-policy, want een update zou de guard dwingen ook het tegoed
        // van de óude rij na te lopen.
        if (mijnKaart) await clearJoker(m.id, myId);
        await setJoker({
          matchId: m.id,
          groupId: m.group_id,
          playerId: myId,
          joker,
        });
        toast.success(`${jokerLabel(joker)} gespeeld.`);
      }
      tap();
      // Geen eigen reload(): setJoker/clearJoker legen de "match-jokers"-cache
      // en dat trekt via `rev` élke jokertegel bij — deze kaart incluis. Een
      // reload() hier zou bovendien niet volstaan: die haalt op via dezelfde
      // cache en kreeg zonder invalidatie zijn eigen oude antwoord terug.
    } catch (err) {
      // Ook de foutkant leunt op die invalidatie: zag de server een blokkade
      // die deze kaart nog niet kende — meestal het maandtegoed dat op een
      // andere rondekaart al vergeven is — dan klopt de tegel meteen daarna.
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bet-tile bet-tile--joker" aria-label="Joker">
      <header className="bet-tile__head">
        <span className="bet-tile__name">🃏 Joker</span>
        <span className="bet-tile__stat">{samenvatting}</span>
      </header>

      {isDeelnemer && !afgelopen && (
        <>
          <ul className="joker__kaarten">
            {JOKERS.map((kaart) => {
              const gekozen = mijnKaart?.joker === kaart.id;
              const blokkade = jokerBlokkade({
                match: m,
                joker: kaart.id,
                isDeelnemer,
                games,
                eigenJokers: eigenMaand.data ?? [],
                eigenStakes,
              });
              // Je eigen gespeelde kaart blijft altijd bedienbaar: intrekken
              // moet kunnen, ook al meldt het tegoed nu "bezet" — dat is
              // immers deze kaart zelf.
              const open = gekozen || blokkade === null;
              const swing =
                mijnKans != null && kaart.raaktRating
                  ? jokerSwing(mijnKans, kaart.id)
                  : null;
              return (
                <li key={kaart.id}>
                  <button
                    type="button"
                    className={`joker__kaart ${gekozen ? "joker__kaart--on" : ""}`}
                    disabled={(!open || busy != null) && !gekozen}
                    aria-pressed={gekozen}
                    onClick={() => schakel(kaart.id)}
                  >
                    <span className="joker__icoon" aria-hidden="true">
                      {kaart.icoon}
                    </span>
                    <span className="joker__tekst">
                      <strong className="joker__naam">{kaart.label}</strong>
                      <span className="joker__effect">{kaart.effect}</span>
                      <span className="joker__prijs">{kaart.prijs}</span>
                      {swing && (
                        <span className="joker__swing">
                          {swing.winst > 0 ? `+${swing.winst}` : swing.winst} bij
                          winst, {swing.verlies} bij verlies
                        </span>
                      )}
                      {!open && !gekozen && blokkade && (
                        <span className="joker__blok">
                          {jokerBlokkadeUitleg(blokkade, games)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="bet-tile__foot">
            {mijnKaart
              ? "Tik je kaart nog eens aan om hem in te trekken — dat kan tot de aftrap."
              : maand
                ? `Eén kaart per kalendermaand. Die van ${maandLabel(maand)} ligt nog klaar.`
                : "Eén kaart per kalendermaand."}
          </p>
        </>
      )}

      {anderen.length > 0 && (
        <p className="joker__anderen">
          {anderen
            .map(
              (j) =>
                `${displayName(profiles[j.player_id])} speelde ${jokerIcoon(j.joker)} ${jokerLabel(j.joker)}`,
            )
            .join(" · ")}
        </p>
      )}

      {isDeelnemer && !afgelopen && !gestart && (
        <p className="joker__reveal">
          Je schild of dubbel-of-niets blijft van jou tot de aftrap; van kant
          wisselen ziet iedereen meteen.
        </p>
      )}
    </section>
  );
}

export default JokerBlock;
