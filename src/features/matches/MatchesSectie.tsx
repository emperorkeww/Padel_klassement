import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync, type AsyncState } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { EmptyState } from "@/ui/EmptyState";
import { Aankondiging } from "@/ui/Aankondiging";
import { aantalTekst } from "@/lib/utils/format";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { useVerbergBijScrollen } from "@/lib/hooks/useVerbergBijScrollen";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { coachEmptyState } from "@/features/coach/coachMoments";
import { getRecentMatches, getTeamsMap } from "./api";
import { useClub } from "@/features/availability/club";
import { MatchFilters } from "@/features/matches/components/MatchFilters";
import {
  filterOpGroep,
  filterOpPeriode,
  type Periode,
} from "@/features/matches/matchFilter";
import { getRatingHistoriesForMatches } from "@/features/standings/ratingsApi";
import { upsetsByMatch } from "@/features/matches/upset";
import { getAllProfiles } from "@/features/profiles/api";
import { getMyFriendships, categorize, otherId } from "@/features/friends/api";
import { MatchHistory } from "@/features/matches/components/MatchHistory";
import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { NewMatchSheet, type NewMatchMode } from "@/features/matches/components/NewMatchSheet";
import type { Match, Profile } from "@/types";
import "./Matches.css";

/** Hoeveel matches per keer geladen worden; "toon oudere" telt er zoveel bij. */
const PAGINA = 100;

/**
 * Het matchoverzicht als sectie: "Te spelen", de historie en de zwevende
 * knop om een match te loggen of te plannen (#1123).
 *
 * Stond tot #1123 als hele pagina in `Matches.tsx`; die is nu een dunne
 * omhulling eromheen, zodat dezelfde sectie straks onder de groepskeuze op de
 * Spelen-hub past. De sectie bezit zijn eigen data en het sheet, maar **niet**
 * de URL: filters en `?log=1` komen van de pagina erboven, want twee schrijvers
 * op dezelfde querystring overschrijven elkaar (zie `speelParams.ts`).
 */
export function MatchesSectie({
  groepId,
  onGroep,
  groepen = [],
  periode,
  onPeriode,
  onWisFilters,
  logDirect = false,
  onLogVerbruikt,
  verbergActie = false,
  zonderNieuweMatch = false,
  titel,
  bron,
  initieelZichtbaar,
}: {
  /** "" = alle groepen. Losse matches (zonder groep) vallen daarmee buiten een
   *  gekozen groep. */
  groepId: string;
  onGroep: (id: string) => void;
  /** De groepen waaruit het filter kan kiezen. Komt van de pagina erboven, die
   *  ze toch al laadt (#1134): de sectie zélf groepen laten ophalen zou een
   *  tweede lezer op dezelfde data zijn. */
  groepen?: { id: string; name: string }[];
  periode: Periode;
  onPeriode: (p: Periode) => void;
  /** Wist groep én periode in één keer — bewust één callback, geen twee. */
  onWisFilters: () => void;
  /** Opent bij het monteren meteen de log-sheet ("?log=1"). */
  logDirect?: boolean;
  /** Meldt dat `?log=1` verwerkt is, zodat de pagina hem uit de URL haalt. */
  onLogVerbruikt?: () => void;
  /** Houdt de zwevende knop uit beeld zolang de pagina erboven zelf iets
   *  belangrijkers open heeft staan (#1123): op telefoonbreedte ligt hij
   *  anders precies over de knop van het aanmaakformulier. */
  verbergActie?: boolean;
  /** Laat de zwevende knop en zijn sheet helemaal weg (#1212). Binnen de
   *  groepspagina is loggen al de taak van de Vandaag-tab; een tweede
   *  zwevende knop zou daar een concurrerende ingang zijn in plaats van een
   *  extra. */
  zonderNieuweMatch?: boolean;
  /** Kop boven de historie. Standaard de titel van MatchHistory zelf; de
   *  groepspagina zet er "Gespeelde matches" boven, want daar gaat het over de
   *  geschiedenis van déze groep en niet over "recent" (#1212). */
  titel?: string;
  /** Een al geladen matchlijst van de pagina erboven. Zonder deze prop haalt de
   *  sectie zelf de globale recente lijst op, met een plafond en een "toon
   *  oudere"-knop.
   *
   *  De groepspagina heeft zijn eigen, complete lijst al in handen
   *  (`getGroupMatches`) en geeft die hier mee (#1298). Daarvóór haalde de
   *  sectie op die tab een tweede keer op — globaal en afgekapt op 100 — en
   *  filterde dat client-side terug naar de groep: een groep die een maand niet
   *  speelde zag straks een halve historie plus een melding over een plafond dat
   *  op die pagina nergens op sloeg, terwijl de volledige lijst al in het
   *  geheugen van dezelfde pagina stond. */
  bron?: AsyncState<Match[]>;
  /** Hoeveel matches de historie eerst toont; de rest komt achter één knop.
   *  Zonder waarde staat de hele lijst er (#1298). Dit gaat over renderen, niet
   *  over ophalen: het plafond van de server heeft zijn eigen melding. */
  initieelZichtbaar?: number;
}) {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const club = useClub();
  const [sheetOpen, setSheetOpen] = useState(false);
  // `undefined` = de gebruiker kiest zelf in het sheet tussen loggen en
  // plannen; een expliciete waarde legt de modus vast (#1123).
  const [sheetMode, setSheetMode] = useState<NewMatchMode | undefined>(undefined);

  function openSheet(mode?: NewMatchMode) {
    setSheetMode(mode);
    setSheetOpen(true);
  }

  // Vanuit de hub: "?log=1" opent meteen de log-sheet (#106). Het opruimen van
  // de parameter doet de pagina; hier alleen het openen, één keer.
  useEffect(() => {
    if (!logDirect) return;
    openSheet("score");
    onLogVerbruikt?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDirect]);

  // Oudere matches bereikbaar (#914): 100 was een hard plafond zonder "meer
  // laden" en zonder melding dat de lijst afgekapt was — alles daarvoor viel
  // vanaf deze pagina buiten bereik.
  const [limiet, setLimiet] = useState(PAGINA);
  // De zwevende logknop wijkt bij vooruitscrollen (#942).
  const fabVerborgen = useVerbergBijScrollen();
  // Krijgt de sectie een lijst mee, dan haalt hij zelf niets op: geen tweede
  // lezer op dezelfde data, en geen plafond waar de pagina erboven er geen
  // heeft (#1298).
  const eigen = useAsync(() => getRecentMatches(limiet), [limiet], {
    enabled: !bron,
  });
  const matches = bron ?? eigen;
  // Kreeg de server precies de limiet terug, dan zit er waarschijnlijk meer
  // achter. Minder betekent: dit is alles. Bij een meegegeven lijst is er geen
  // limiet om tegenaan te lopen.
  const afgekapt = !bron && (matches.data?.length ?? 0) >= limiet;
  const teams = useAsync(getTeamsMap, []);
  const profiles = useAsync(getAllProfiles, []);
  const friendships = useAsync(getMyFriendships, []);
  // Upsets rekenen met de échte pre-match ratings van precies deze matches
  // (#731): het gedeelde historie-venster is per speler en dekt een oudere
  // match in deze lijst niet gegarandeerd.
  const matchIds = useMemo(
    () =>
      (matches.data ?? [])
        .filter((m) => m.status === "completed")
        .map((m) => m.id),
    [matches.data],
  );
  const matchKey = matchIds.join(",");
  const histories = useAsync(
    () => getRatingHistoriesForMatches(matchIds),
    [matchKey],
  );

  const pmap = Object.fromEntries((profiles.data ?? []).map((p) => [p.id, p]));
  const tmap = useMemo(() => teams.data ?? {}, [teams.data]);
  // Upsets per match-id (#85), één keer berekend voor alle kaarten.
  const upsets = useMemo(
    () => upsetsByMatch(matches.data ?? [], tmap, histories.data ?? {}),
    [matches.data, tmap, histories.data],
  );

  // Kiesbaar in de wizard: jezelf, je geaccepteerde vrienden en je eigen
  // gastspelers (naamloze deelnemers zonder account, door jou aangemaakt).
  const { accepted } = categorize(friendships.data ?? [], myId);
  const myGuests = (profiles.data ?? []).filter(
    (p) => p.is_guest && p.owner_id === myId,
  );
  const selectablePlayers: Profile[] = [
    pmap[myId],
    ...accepted.map((f) => pmap[otherId(f, myId)]),
    ...myGuests,
  ].filter(Boolean) as Profile[];

  const reloadAll = useCallback(() => {
    matches.reload();
    teams.reload();
    profiles.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.reload, teams.reload, profiles.reload]);
  useRealtime("matches", reloadAll);

  // Geplande matches waarin ik meedoe: bovenaan met inline score-invoer.
  const plannedAlle = useMemo(
    () =>
      (matches.data ?? []).filter(
        (m) =>
          m.status !== "completed" &&
          [tmap[m.team_a_id], tmap[m.team_b_id]].some(
            (t) => t && (t.player1_id === myId || t.player2_id === myId),
          ),
      ),
    [matches.data, tmap, myId],
  );
  // ...door dezelfde filters als de historie eronder (#1298). Zonder dit stonden
  // op de Historie-tab van groep A ook de geplande matches van groep B — mét de
  // knop "Uitslag invullen", dus je vulde vanuit de ene groep de uitslag van de
  // andere in zonder dat iets dat verraadde.
  const plannedMine = useMemo(
    () =>
      filterOpPeriode(
        filterOpGroep(plannedAlle, groepId),
        periode,
        club.timezone,
      ),
    [plannedAlle, groepId, periode, club.timezone],
  );
  // Wat hierboven staat hoort niet nóg een keer in de historie. Bewust op de
  // óngefilterde set: een geplande match die door het periodefilter valt, is
  // geen geschiedenis die er ineens bij mag komen.
  const plannedIds = useMemo(
    () => new Set(plannedAlle.map((m) => m.id)),
    [plannedAlle],
  );

  // De recente-lijst toont alles behalve mijn eigen geplande matches — die
  // staan al bovenaan onder "Te spelen" — en daarna gefilterd op groep en
  // periode. Dat filteren gebeurt op de geladen lijst, dus wie ver terug zoekt
  // laadt eerst bij; de melding onder de historie zegt dat ook.
  const recent = useMemo(
    () =>
      filterOpPeriode(
        filterOpGroep(
          (matches.data ?? []).filter((m) => !plannedIds.has(m.id)),
          groepId,
        ),
        periode,
        club.timezone,
      ),
    [matches.data, plannedIds, groepId, periode, club.timezone],
  );

  // De hub toont eerst een stuk van de historie (#1298): alles in één keer
  // rendert daar 62 kaarten en 56 dagkoppen, en duwt de verwijzing naar de
  // banen naar 9.814px. Dit is een render-grens, geen ophaal-grens — vandaar
  // apart van `limiet` hierboven, dat over de server gaat.
  const [alleZichtbaar, setAlleZichtbaar] = useState(false);
  const ingekort =
    !!initieelZichtbaar && !alleZichtbaar && recent.length > initieelZichtbaar;
  const zichtbaar = ingekort ? recent.slice(0, initieelZichtbaar) : recent;
  // Filteren herschikt de lijst; dan hoort de inkorting weer vanaf het begin.
  useEffect(() => {
    setAlleZichtbaar(false);
  }, [groepId, periode]);

  return (
    <>
      <MatchFilters
        periode={periode}
        onPeriode={onPeriode}
        groep={groepId}
        onGroep={onGroep}
        groepen={groepen}
        onWis={onWisFilters}
      />

      {/* Filteren op groep of periode herschikt de historie zonder dat iets
          verraadt hoeveel er overblijft (#924). */}
      <Aankondiging
        sleutel={`${groepId}|${periode}`}
        bericht={`${aantalTekst(recent.length, "match", "matches")} in de historie.`}
      />

      {/* "Te spelen" verscheen zonder placeholder en duwde de historie omlaag
          zodra de data binnenviel (#914). */}
      {matches.loading ? (
        <section className="card" aria-hidden="true">
          <div className="card__head">
            <h2 className="card__title">Te spelen</h2>
          </div>
          <MatchListSkeleton count={1} />
        </section>
      ) : (
        plannedMine.length > 0 && (
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Te spelen</h2>
              <span className="badge badge--accent">{plannedMine.length}</span>
            </div>
            <div className="stack">
              {plannedMine.map((m) => (
                <PlannedMatchCard
                  key={m.id}
                  match={m}
                  teams={tmap}
                  profiles={pmap}
                  perspectiveId={myId}
                  history={matches.data ?? []}
                  onSaved={reloadAll}
                />
              ))}
            </div>
          </section>
        )
      )}

      <MatchHistory
        title={titel}
        matches={zichtbaar}
        teams={tmap}
        profiles={pmap}
        myId={myId}
        upsets={upsets}
        onChanged={reloadAll}
        loading={matches.loading}
        error={matches.error}
        emptyAll={
          <EmptyState
            icon={<CoachAvatar size={40} mood="portret" />}
            title={
              pmap[myId]
                ? coachEmptyState({
                    type: "matches",
                    seed: `${myId}-matches-empty`,
                    ctx: {
                      intensiteit: pmap[myId]?.roast_intensiteit ?? "radioactief",
                      schild: pmap[myId]?.roast_schild ?? false,
                    },
                  })
                : "Je racket is nog ongebruikt."
            }
            action={
              zonderNieuweMatch ? undefined : (
                <button
                  className="btn btn--primary"
                  onClick={() => openSheet("score")}
                >
                  + Log je eerste match
                </button>
              )
            }
          >
            {pmap[myId]
              ? "Speel je eerste wedstrijd en kickstart je ranking en statistieken!"
              : "Vul je eerste wedstrijdscore in en kickstart direct je ranking en statistieken!"}
          </EmptyState>
        }
      />

      {/* Eerst de rest van wat er al is (#1298), pas daarna de vraag of er nóg
          meer van de server moet komen. Nooit twee "toon meer"-knoppen onder
          elkaar: die zouden hetzelfde beloven en iets anders doen. */}
      {ingekort && !matches.loading && !matches.error && (
        <div className="matches__meer">
          <button
            type="button"
            className="btn"
            onClick={() => setAlleZichtbaar(true)}
          >
            Toon oudere matches ({recent.length - zichtbaar.length})
          </button>
        </div>
      )}

      {/* Afkapping expliciet melden (#914): zonder dit leek de lijst compleet,
          terwijl alles ouder dan de limiet simpelweg niet geladen was. Ook het
          antwoord op de filter-valkuil — filteren gebeurt op wat er geladen is. */}
      {!ingekort && !matches.loading && !matches.error && afgekapt && (
        <div className="matches__meer">
          <p className="matches__meer-note">
            Alleen de laatste {limiet} matches zijn geladen. Zoek je iets ouders
            of filter je op een groep? Laad er dan eerst meer bij.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setLimiet((l) => l + PAGINA)}
          >
            Toon oudere matches
          </button>
        </div>
      )}

      {/* Eén primaire actie (#914): de knop opent het sheet, waarin je kiest of
          je een uitslag logt of een match plant (#1123). Hij wijkt bij
          vooruitscrollen (#942) — anders ligt hij over de steppers en de
          Opslaan-knop van de kaart eronder. */}
      {!zonderNieuweMatch && (
        <>
          <button
            type="button"
            className={`btn btn--primary matches__fab zwevende-actie${
              fabVerborgen || verbergActie ? " is-verborgen" : ""
            }`}
            onClick={() => openSheet()}
          >
            <span className="matches__fab-plus" aria-hidden="true">
              +
            </span>
            <span className="matches__fab-label">Match</span>
          </button>

          <NewMatchSheet
            open={sheetOpen}
            players={selectablePlayers}
            mode={sheetMode}
            onClose={() => setSheetOpen(false)}
            onCreated={reloadAll}
            onGuestCreated={profiles.reload}
          />
        </>
      )}
    </>
  );
}

export default MatchesSectie;
