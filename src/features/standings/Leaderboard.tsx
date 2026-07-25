import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { StandingsSkeleton } from "@/ui/Skeleton";
import { EmptyState } from "@/ui/EmptyState";
import { Avatar } from "@/ui/Avatar";
import { recentForm, type Outcome } from "@/features/rating/results";
import { isSeasonClosed, listSeasons, seasonFromId } from "@/features/rating/seasons";
import {
  byRank,
  computePlayerStandings,
  computeTeamStandings,
  matchesInSeason,
  matchesUpTo,
} from "@/features/rating/standings";
import { rankShifts, type Shift } from "@/features/rating/rankShift";
import {
  getPlayerStandings,
  getTeamStandings,
  getGroupPlayerStandings,
  getSeasonPlayerStandings,
  getSeasonTeamStandings,
} from "./api";
import { getMyGroups } from "@/features/groups/api";
import { getPlayerRatings, getAllRatingHistories } from "./ratingsApi";
import { getHuidigeDictator } from "./dictatorApi";
import { magDictatorPortretGenereren } from "./dictatorPortret";
import {
  GEEN_AVATAR_BRON,
  portretVervallen,
  portretVoor,
  prewarmPortret,
} from "./aiPortret";
import { deltaToday } from "./ratingDelta";
import { useClub } from "@/features/availability/club";
import { getGlobalePias, getPiasWeeks } from "./piasApi";
import { getGlobaleZwartePiet } from "@/features/groups/zwartePietApi";
import { currentPias } from "@/features/standings/pias";
import { roastCtx, roastSeed, type CoachMood } from "@/features/coach/roastTone";
import { klassementFeiten } from "@/features/coach/klassementFeiten";
import { coachKlassement, coachKlassementMood } from "@/features/coach/klassementPraat";
import { KlassementCommentaar } from "./components/KlassementCommentaar";
import { Podium } from "@/features/standings/components/Podium";
import { DictatorThrone } from "@/features/standings/components/DictatorThrone";
import { Schandpaal } from "./components/Schandpaal";
import { schandpaalUit } from "./schandpaal";
import {
  DEFAULT_DICTATOR,
  defaultDictatorEnabled,
  laadWaarnemendPortret,
} from "@/features/dashboard/dictator";
import { coachBuiging } from "@/features/coach/roastTone";
import { TierLegend } from "@/features/rating/components/TierLegend";
import { THIN_GAMES } from "@/features/groups/groupRating";
import {
  getCompletedMatchesBetween,
  getFirstMatchDate,
  getRecentMatches,
  getTeamsMap,
  teamLabel,
} from "@/features/matches/api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { searchDiscoverableProfiles } from "@/features/friends/api";
import { ShareChampion } from "@/features/standings/components/ShareChampion";
import {
  ratingAsOf,
  splitDictatorThrone,
  type Row,
} from "./leaderboardHelpers";
import { spelerVanDeWeek } from "./spelerVanDeWeek";
import { onFireSpelers } from "./onFire";
import { getSeizoenskampioen } from "./kampioen";
import type { EditieContext } from "./edities";
import { KaartRaster } from "./components/KaartRaster";
import { KaartPreview } from "./components/KaartPreview";
import { FutKaartDefs } from "@/features/rating/components/FutKaart";
import { TierProgressBanner } from "./components/TierProgressBanner";
import { useDictatorAnthem } from "./useDictatorAnthem";
import kmAnthem from "@/features/dictator/components/km_dictator_anthem.mp3";
import imperialMarch from "@/features/dictator/components/dictator_imperial-march.mp3";
import { PiasBanner } from "./components/PiasBanner";
import { TierDivisions } from "./components/TierDivisions";
import { KlassementUitleg } from "./components/KlassementUitleg";
import { StandingsTable } from "./components/StandingsTable";
import { RankList } from "./components/RankList";
import type { Match, PlayerStanding, Profile, RatingPoint, TeamStanding } from "@/types";
import "./Leaderboard.css";

type Tab = "player" | "team" | "divisies" | "kaarten";

// Rotatieteller voor Coach Rudy's knieval onder de troon (#535): elke nieuwe
// mount van het klassement pakt de volgende buig-regel, zodat opeenvolgende
// bezoeken cyclen i.p.v. altijd dezelfde te tonen. Zelfde patroon als de
// avatar-cyclus in CoachAvatar.
let buigingBeurt = 0;

export function Leaderboard() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const club = useClub();
  const [tab, setTab] = useState<Tab>("player");
  const [groupId, setGroupId] = useState<string>("");

  // Speler zoeken (#282): het zoekveld filtert de al geladen ranglijst live op
  // naam. Daarnaast zoeken we vindbare spelers die (nog) niet in de ranglijst
  // staan, zodat je ze via hun profiel toch vindt.
  const [q, setQ] = useState("");
  const [extraResults, setExtraResults] = useState<Profile[]>([]);
  // Eén buig-regel-rotatie per bezoek (mount); stabiel over re-renders.
  const [buigingRotatie] = useState(() => buigingBeurt++);
  const searchSeq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      searchSeq.current++;
      setExtraResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchDiscoverableProfiles(term, myId);
        if (seq === searchSeq.current) setExtraResults(found);
      } catch {
        if (seq === searchSeq.current) setExtraResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, myId]);

  // Het gekozen seizoen (kwartaal) leeft in de URL (?seizoen=2026-q3):
  // deelbaar en refresh-bestendig. Ongeldige waarde → "Alle tijden".
  const [params, setParams] = useSearchParams();
  const season = seasonFromId(params.get("seizoen") ?? "");
  const setSeasonId = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) {
      next.set("seizoen", id);
      next.delete("stand"); // seizoen en "stand op datum" sluiten elkaar uit
    } else next.delete("seizoen");
    setParams(next, { replace: true });
  };

  // "Stand op datum" (tijdmachine): de ranglijst zoals hij was t/m een datum,
  // met ieders punten cumulatief uit alle matches op of vóór die dag.
  const asof = params.get("stand") ?? ""; // YYYY-MM-DD; "" = uit
  const setAsof = (d: string) => {
    const next = new URLSearchParams(params);
    if (d) {
      next.set("stand", d);
      next.delete("seizoen");
    } else next.delete("stand");
    setParams(next, { replace: true });
  };
  // Minimaal aantal gespeelde matches om in de lijst te verschijnen (eerlijkheid).
  const minMatches = Math.max(0, Math.floor(Number(params.get("min") ?? "0")) || 0);
  const setMin = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 0) next.set("min", String(n));
    else next.delete("min");
    setParams(next, { replace: true });
  };

  // Kiezeropties: alle kwartalen sinds de allereerste match.
  const firstMatch = useAsync(getFirstMatchDate, []);
  const seasons = useMemo(
    () => (firstMatch.data ? listSeasons(new Date(firstMatch.data)) : []),
    [firstMatch.data],
  );

  const groups = useAsync(getMyGroups, []);
  const players = useAsync(
    () => (groupId ? getGroupPlayerStandings(groupId) : getPlayerStandings()),
    [groupId],
  );
  const teams = useAsync(getTeamStandings, []);
  const teamsMap = useAsync(getTeamsMap, []);
  const profilesMap = useAsync(getProfilesMap, []);
  // Voor de vorm-kolom: recente matches client-side per speler samengevat.
  const recent = useAsync(() => getRecentMatches(250), []);
  const ratings = useAsync(getPlayerRatings, []);
  // Voor de sparkline-kolom: historie van alle spelers in één batch.
  const histories = useAsync(getAllRatingHistories, []);
  // De zittende dictator (#545): server-side bepaald via de troon-replay, niet
  // meer de toevallige 1600+-#1. Bepaalt wie op De Troon komt.
  const dictator = useAsync(getHuidigeDictator, []);
  // Kampioen-editie (#625): winnaar van het vorige kwartaal (gecacht).
  const kampioen = useAsync(getSeizoenskampioen, []);
  // Pias van de week per groep (serverside aangeduid); de banner + voetnoot
  // tonen de pias van de geselecteerde groep.
  const piasWeeks = useAsync(getPiasWeeks, []);
  // Pias-editie (#631): de globale pias — server-side het maximum over álle
  // groepen, zodat de kaart voor iedereen dezelfde is.
  const globalePias = useAsync(getGlobalePias, []);
  // Piet-editie (#645): de globale Zwarte Piet over alle groepen heen.
  const globaleZwartePiet = useAsync(getGlobaleZwartePiet, []);
  // Globale kwartaalstand komt sinds #461 van een SECURITY DEFINER RPC: de ruwe
  // matches-tabel is niet meer publiek, dus een client-side berekening zou de
  // globale seizoensstand per-kijker maken (groepsmatches vallen weg). Een
  // GROEP-seizoensstand blijft wél client-side: de kijker is altijd lid van de
  // gekozen groep (getMyGroups) en mag die matchrijen dus zien via RLS. Bij de
  // teams-tab is er geen groepsfilter, dus die is altijd globaal.
  const globalSeason = !!season && (!groupId || tab === "team");
  const seasonPlayers = useAsync<PlayerStanding[] | null>(
    () =>
      globalSeason && season
        ? getSeasonPlayerStandings(
            season.start.toISOString(),
            season.end.toISOString(),
          )
        : Promise.resolve(null),
    [globalSeason && season ? season.id : "off"],
  );
  const seasonTeams = useAsync<TeamStanding[] | null>(
    () =>
      globalSeason && season
        ? getSeasonTeamStandings(
            season.start.toISOString(),
            season.end.toISOString(),
          )
        : Promise.resolve(null),
    [globalSeason && season ? season.id : "off"],
  );
  // Groep-seizoensstand: matches van de (eigen) groep, client-side berekend.
  const seasonMatches = useAsync<Match[] | null>(
    () =>
      season && !globalSeason
        ? getCompletedMatchesBetween(
            season.start.toISOString(),
            season.end.toISOString(),
          )
        : Promise.resolve(null),
    [season && !globalSeason ? `${season.id}:${groupId}` : "off"],
  );
  // Alle afgeronde matches, voor de tijdmachine. Vast bereik → de cache blijft
  // staan terwijl je de datum verschuift (alleen de eerste keer een query).
  const allCompleted = useAsync<Match[] | null>(
    () =>
      asof
        ? getCompletedMatchesBetween(
            "2000-01-01T00:00:00Z",
            "2100-01-01T00:00:00Z",
          )
        : Promise.resolve(null),
    [asof ? "on" : "off"],
  );

  // Live bijwerken bij nieuwe/aangepaste matches.
  const refresh = useCallback(() => {
    players.reload();
    teams.reload();
    teamsMap.reload();
    recent.reload();
    ratings.reload();
    histories.reload();
    seasonPlayers.reload();
    seasonTeams.reload();
    seasonMatches.reload();
    allCompleted.reload();
    piasWeeks.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.reload, teams.reload, teamsMap.reload, recent.reload, ratings.reload, histories.reload, seasonPlayers.reload, seasonTeams.reload, seasonMatches.reload, allCompleted.reload, piasWeeks.reload]);
  useRealtime("matches", refresh);

  const pmap = profilesMap.data ?? {};
  // Stabiele referentie: tmap voedt de useMemo van de rangverschuivingen.
  const tmap = useMemo(() => teamsMap.data ?? {}, [teamsMap.data]);
  // Stabiele referenties: rmap/hmap voeden de useMemo van de rangverschuivingen.
  const rmap = useMemo(() => ratings.data ?? {}, [ratings.data]);
  const hmap = useMemo(() => histories.data ?? {}, [histories.data]);

  // AI dictator-portret (#554): pre-warm het eigen portret zodra ik in range kom
  // om dictator te worden (of het al ben), zodat De Troon meteen een vers portret
  // toont i.p.v. de gewone avatar. Fire-and-forget en alleen voor mezelf — de
  // function leidt de userId uit de JWT af en respecteert opt-out/idempotentie.
  // Een ref houdt het op hooguit één aanroep per bron-foto per sessie. Het
  // server-side vangnet (pg_net-trigger op dictator_termijnen) dekt de dictator
  // die de app niet opent.
  const prewarmedRef = useRef<string | null>(null);
  useEffect(() => {
    // Stabiele refs (niet pmap/rmap: die zijn elke render een vers {} zolang de
    // data laadt).
    const pm = profilesMap.data;
    const rm = ratings.data;
    if (!pm || !rm) return;
    const me = pm[myId];
    if (!me || me.dictator_portret === false) return;
    // De zittende ECHTE dictator komt uit dictator_termijnen (nooit de waarnemend
    // Mbappé); ben ik het zelf, dan is het verschil 0 en pre-warmt dit m'n eigen
    // portret als vangnet.
    const echteDictatorRating = dictator.data
      ? (rm[dictator.data.profileId]?.rating ?? dictator.data.claimRating)
      : null;
    if (
      !magDictatorPortretGenereren({
        rating: rm[myId]?.rating ?? null,
        echteDictatorRating,
      })
    )
      return;
    if (!portretVervallen(me, "dictator")) return;
    const bron = me.avatar_url ?? GEEN_AVATAR_BRON;
    if (prewarmedRef.current === bron) return;
    prewarmedRef.current = bron;
    void prewarmPortret("dictator");
  }, [profilesMap.data, ratings.data, dictator.data, myId]);

  // Pias van de week voor de gekozen groep (niets bij "Alle groepen"). De
  // commentator-sneer (#183) volgt de roast-intensiteit van die groep en het
  // roast-schild van de pias zelf.
  const groupPias = useMemo(() => {
    if (!groupId) return null;
    const rows = piasWeeks.data?.[groupId];
    const pias = rows ? currentPias(rows) : null;
    if (!pias) return null;
    const profile = (profilesMap.data ?? {})[pias.playerId];
    const groep = (groups.data ?? []).find((g) => g.id === groupId);
    const ctx = roastCtx(
      { roast_intensiteit: groep?.roast_intensiteit ?? "gemeen" },
      profile,
    );
    return {
      naam: displayName(profile),
      reden: pias.reden,
      waarde: pias.waarde,
      beschermd: profile?.roast_schild ?? false,
      // Coach Rudy spreekt nu als geattribueerde spreker (#287): geef de
      // context + seed door i.p.v. een kant-en-klare 🎙️-string.
      ctx,
      seed: roastSeed(pias.playerId, pias.weekStart),
      // Groepsnaam in de banner (#655): onderscheidt de groeps-pias van de
      // club-brede kaart-editie.
      groepsnaam: groep?.name ?? "je groep",
    };
  }, [groupId, piasWeeks.data, profilesMap.data, groups.data]);

  // Gescopete matches (seizoen óf "stand op datum"), met groepsfilter. Beide
  // rekenen client-side met dezelfde logica als de server-views.
  const usingScope = !!(season || asof);
  // Client-side scope: de tijdmachine (asof) en de GROEP-seizoensstand. De
  // globale seizoensstand komt uit de RPC (seasonPlayers/seasonTeams) en loopt
  // niet via deze matchlijst.
  const scopedSource = asof
    ? allCompleted.data
      ? matchesUpTo(allCompleted.data, asof)
      : null
    : season && !globalSeason
      ? seasonMatches.data
        ? matchesInSeason(seasonMatches.data, season)
        : null
      : null;
  const scoped = scopedSource
    ? scopedSource.filter((m) => !groupId || m.group_id === groupId)
    : null;
  const playerStandings = globalSeason
    ? (seasonPlayers.data ?? [])
    : usingScope
      ? scoped
        ? computePlayerStandings(scoped, tmap, pmap)
        : []
      : (players.data ?? []);
  const teamStandings = globalSeason
    ? (seasonTeams.data ?? [])
    : usingScope
      ? scoped
        ? computeTeamStandings(scoped, tmap)
        : []
      : (teams.data ?? []);

  // Vorm: binnen een scope alleen de matches van die scope tonen.
  const formSource = usingScope ? (scoped ?? []) : (recent.data ?? []);
  const formFor = (playerId: string): Outcome[] =>
    recentForm(formSource, tmap, playerId, 5);

  // Verschuiving t.o.v. vóór de laatste speeldag (▲2 / ▼1 / nieuw) — alleen
  // in "Alle tijden": een seizoensarchief beweegt niet meer.
  const shifts = useMemo(
    () =>
      rankShifts(players.data ?? [], recent.data ?? [], tmap, groupId || null, hmap, rmap),
    [players.data, recent.data, tmap, groupId, hmap, rmap],
  );

  // Datum van mijn laatste afgeronde match — preset voor "stand op datum".
  const myLastMatchDay = useMemo(() => {
    let latest = "";
    for (const m of recent.data ?? []) {
      if (m.status !== "completed") continue;
      const a = tmap[m.team_a_id];
      const b = tmap[m.team_b_id];
      const mine =
        a?.player1_id === myId ||
        a?.player2_id === myId ||
        b?.player1_id === myId ||
        b?.player2_id === myId;
      if (!mine) continue;
      const d = (m.played_at ?? m.created_at).slice(0, 10);
      if (d > latest) latest = d;
    }
    return latest;
  }, [recent.data, tmap, myId]);

  const playerRows = playerStandings.map((p) => ({
    key: p.player_id,
    isMe: p.player_id === myId,
    name: displayName(p),
    profile: pmap[p.player_id] ?? p,
    link: `/spelers/${p.player_id}`,
    played: p.played,
    won: p.won,
    drawn: p.drawn ?? 0,
    lost: p.lost,
    points: p.points,
    goalDiff: p.goal_diff ?? 0,
    // Bij "stand op datum" de rating zoals die tóén was (uit de historie),
    // anders de huidige rating.
    rating: asof
      ? ratingAsOf(hmap[p.player_id], asof)
      : (rmap[p.player_id]?.rating ?? null),
    // Voor de tier-dimming (#127); bij "stand op datum" is dit de huidige
    // teller — kleine bekende onzuiverheid, de tier volgt wel de toenmalige rating.
    games: rmap[p.player_id]?.games ?? 0,
    history: hmap[p.player_id] ?? [],
    form: formFor(p.player_id),
    shift: usingScope ? undefined : shifts.get(p.player_id)?.shift,
  }));

  const teamRows = teamStandings.map((t) => ({
    key: t.team_id,
    isMe: false,
    name: teamLabel(tmap[t.team_id], pmap),
    profile: null,
    link: undefined as string | undefined,
    played: t.played,
    won: t.won,
    drawn: t.drawn ?? 0,
    lost: t.lost,
    points: t.points,
    goalDiff: t.goal_diff ?? 0,
    rating: null,
    games: 0,
    history: [] as RatingPoint[],
    form: [] as Outcome[],
    shift: undefined as Shift | undefined,
  }));

  // Minimaal-aantal-matches: verberg spelers/teams onder de drempel (de
  // overgebleven lijst wordt opnieuw genummerd 1..k).
  const atLeastMin = <T extends { played: number }>(list: T[]): T[] =>
    minMatches > 0 ? list.filter((r) => r.played >= minMatches) : list;
  const shownPlayerRows = atLeastMin(playerRows);
  // Divisies gebruiken dezelfde spelerslijst als het speler-klassement.
  const rows = tab === "team" ? atLeastMin(teamRows) : shownPlayerRows;
  // Rating is de leidende volgorde voor spelers (#52) — speelfrequentie telt
  // niet; de klassieke punten-tie-break geldt bij gelijke/ontbrekende rating.
  const displayRows =
    tab === "team"
      ? rows
      : [...rows].sort(
          (a, b) =>
            (b.rating ?? -Infinity) - (a.rating ?? -Infinity) ||
            byRank(
              { points: a.points, goal_diff: a.goalDiff, won: a.won },
              { points: b.points, goal_diff: b.goalDiff, won: b.won },
            ),
        );
  // Globale seizoensstand → RPC; groep-seizoen/tijdmachine → client-side matches;
  // anders de live views.
  const scopeAsync = season ? seasonMatches : allCompleted;
  const loading = globalSeason
    ? tab === "team"
      ? seasonTeams.loading
      : seasonPlayers.loading
    : usingScope
      ? scopeAsync.loading || teamsMap.loading || profilesMap.loading
      : tab === "team"
        ? teams.loading
        : players.loading;
  const error = globalSeason
    ? tab === "team"
      ? seasonTeams.error
      : seasonPlayers.error
    : usingScope
      ? scopeAsync.error
      : tab === "team"
        ? teams.error
        : players.error;
  // De Kaarten-tab (#497) is een tweede gezicht van het spelersklassement:
  // podium, troon en coach gedragen zich er hetzelfde als op de Spelers-tab.
  const spelerTab = tab === "player" || tab === "kaarten";
  const showPodium = spelerTab && !loading && !error && rows.length >= 3;

  // Kampioensbanner: de nummer 1 van een volledig afgesloten kwartaal.
  const champion =
    season && isSeasonClosed(season) && !loading && !error && shownPlayerRows.length > 0
      ? shownPlayerRows[0]
      : null;

  // "Jouw positie": scrolt naar je eigen rij (tabel op desktop, lijst op mobiel).
  const meRowRef = useRef<HTMLTableRowElement | null>(null);
  const meItemRef = useRef<HTMLLIElement | null>(null);
  const myRankIdx =
    tab === "player" ? displayRows.findIndex((r) => r.isMe) : -1;
  const scrollToMe = () => {
    const el = [meItemRef.current, meRowRef.current].find(
      (e) => e && e.offsetParent !== null,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Coach Rudy over jóuw positie in het klassement (#411), naast de PiasBanner.
  // Alleen op de live stand (geen archief/tijdmachine) en zonder zoekterm; ook
  // bij "Alle groepen", dan over het globale klassement. Intensiteit — bewuste
  // keuze: een groepsklassement spreekt met de toon van die groep (zoals
  // groupPias hierboven); "Alle groepen" is een persoonlijk/globaal oppervlak
  // en volgt jóuw profiel-intensiteit, net als de feed en het dashboard. Het
  // schild is altijd dat van de kijker, want die is hier het doelwit.
  let klassementCoach: { tekst: string; mood: CoachMood } | null = null;
  const mijnIdx =
    tab !== "team" ? displayRows.findIndex((r) => r.isMe) : -1;
  if (mijnIdx >= 0 && !usingScope && !q.trim() && !loading && !error) {
    const feiten = klassementFeiten(
      displayRows.map((r) => ({
        playerId: r.key,
        naam: r.name,
        rating: r.rating,
        games: r.games,
      })),
      myId,
      groupId ? "groep" : "globaal",
      shifts.get(myId)?.shift ?? null,
    );
    if (feiten) {
      // Voor het groep-vs-globaal-contrast: de globale stand uit de al geladen
      // ratings, zonder extra fetch. Benadering zonder punten-tie-break — voor
      // een quip ruim voldoende.
      const globaal = groupId
        ? klassementFeiten(
            Object.values(rmap)
              .map((r) => ({
                playerId: r.player_id,
                naam: displayName(pmap[r.player_id]),
                rating: r.rating,
                games: r.games,
              }))
              .sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity)),
            myId,
            "globaal",
          )
        : null;
      const groep = (groups.data ?? []).find((g) => g.id === groupId);
      const invoer = {
        feiten,
        globaal,
        groepsNaam: groep?.name ?? null,
        seed: `${myId}|${groupId || "globaal"}|${new Date().toISOString().slice(0, 10)}`,
        ctx: {
          intensiteit: groupId
            ? (groep?.roast_intensiteit ?? "gemeen")
            : (pmap[myId]?.roast_intensiteit ?? "gemeen"),
          schild: pmap[myId]?.roast_schild ?? false,
        },
      };
      klassementCoach = {
        tekst: coachKlassement(invoer),
        mood: coachKlassementMood(invoer),
      };
    }
  }

  // Naam-filter (#282): de echte rang blijft op elke rij staan, zodat filteren
  // de nummers niet hernummert. Alleen op de speler-/teamlijst (niet divisies).
  const nq = q.trim().toLowerCase();
  const searchable = tab !== "divisies";
  // De Troon (#528 + #530): op het spelerklassement (buiten zoeken/laden) staat
  // altijd een troon bovenaan. Kwalificeert de #1 als dictator (rating 1600+,
  // #527), dan wordt hij losgekoppeld — van podium én ranglijst — en op de troon
  // gezet; het volk begint bij #2 en het podium draagt geen Big Daddy-kroon.
  // Kwalificeert niemand, dan blijft de troon tóch bezet: Kylian Mbappé regeert
  // bij verstek (#530). Hij zit er "in absentia" boven, dus de echte #1 blijft
  // gewoon op het podium staan — mét z'n Big Daddy-kroon.
  const canThrone =
    spelerTab &&
    !nq &&
    !loading &&
    !error &&
    !dictator.loading &&
    displayRows.length > 0;
  const { throne: throneRow, rest: volkRows } = canThrone
    ? splitDictatorThrone(displayRows, dictator.data?.profileId ?? null)
    : { throne: null, rest: displayRows };
  const rankedRows: Row[] = displayRows.map((r, i) => ({ ...r, rank: i + 1 }));
  // De dictator verdwijnt uit de ranglijst; zijn plek 1 verdwijnt mee zodat het
  // volk zichtbaar bij #2 begint (de rangnummers zelf blijven staan).
  const ladderRows = throneRow
    ? rankedRows.filter((r) => r.key !== throneRow.key)
    : rankedRows;
  // Volkslied (#535): zolang Kylian Mbappé op de troon zit — waarnemend bij
  // verstek (throneRow == null, #530) of een echt clublid dat zo heet — speelt
  // op de zichtbare spelers-tab z'n dictator-anthem, tot je het klassement
  // verlaat of het tabblad verbergt.
  // De troon (#536/#542): een échte dictator (throneRow != null) staat er altijd;
  // de waarnemend Mbappé (throneRow == null) alleen als de globale build-vlag
  // (#536) én de eigen voorkeur (#542) aan staan. Uit → geen troon bij verstek,
  // dus het Big Daddy-podium (#528) blijft gewoon staan. De voorkeur komt uit het
  // eigen profiel (cross-device); ontbreekt/nog-ladend → zichtbaar (default).
  const waarnemendAan = pmap[myId]?.toon_waarnemend_dictator ?? true;
  const toonTroon =
    canThrone &&
    (throneRow != null || (defaultDictatorEnabled() && waarnemendAan));
  const toonWaarnemend = toonTroon && throneRow == null;
  const mbappeRegeert =
    toonTroon &&
    (throneRow == null || throneRow.name === DEFAULT_DICTATOR.name);
  // Een écht clublid (niet Mbappé) op de troon: dan speelt de imperial march
  // i.p.v. het Mbappé-anthem. Beide gevallen sluiten elkaar uit, dus één van de
  // twee tracks is actief (of null → stil als er geen troon is).
  const echteDictatorRegeert =
    toonTroon && throneRow != null && throneRow.name !== DEFAULT_DICTATOR.name;
  const dictatorMuziek = mbappeRegeert
    ? kmAnthem
    : echteDictatorRegeert
      ? imperialMarch
      : null;
  const anthem = useDictatorAnthem(dictatorMuziek);
  // Portret van de waarnemend dictator lui laden — alleen wanneer getoond, zodat
  // de asset niet gefetcht wordt (en bij uitgeschakelde flag niet eens bundelt).
  const [waarnemendPortret, setWaarnemendPortret] = useState<string | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    if (toonWaarnemend) {
      laadWaarnemendPortret().then((src) => {
        if (alive) setWaarnemendPortret(src);
      });
    } else {
      setWaarnemendPortret(null);
    }
    return () => {
      alive = false;
    };
  }, [toonWaarnemend]);
  // Speciale edities (#497), alleen op de live stand (een archief of
  // tijdmachine heeft geen "deze week"): Icon voor de Big Daddy (#1, en die
  // bestaat alleen zonder échte dictator op de troon — anders begint het volk
  // bij #2, zonder kroon) en In-Form voor de speler van de week.
  const inForm = useMemo(
    () => (usingScope ? null : spelerVanDeWeek(hmap)),
    [usingScope, hmap],
  );
  // On-Fire (#632): actieve winstreaks uit dezelfde histories — een archief
  // of tijdmachine heeft geen "nu", dus ook deze alleen op de live stand.
  const onFire = useMemo(
    () => (usingScope ? {} : onFireSpelers(hmap)),
    [usingScope, hmap],
  );
  const iconKey =
    !usingScope && spelerTab && !throneRow && rankedRows[0]?.rating != null
      ? rankedRows[0].key
      : null;
  // Eén editie-context (#625) voor raster én preview — dezelfde opbouw als
  // profiel en matchdetail. Kampioen en In-Form alleen op de live stand.
  const editieCtx: EditieContext = {
    dictatorId: dictator.data?.profileId ?? null,
    iconKey,
    kampioen: usingScope ? null : (kampioen.data ?? null),
    inForm,
    onFire,
    pias: usingScope ? null : currentPias(globalePias.data ?? []),
    piet: usingScope ? null : (globaleZwartePiet.data ?? null),
  };
  // De Schandpaal (#682): de globale pias als uitgelichte kaart ónder de
  // ranglijst — de tegenhanger van De Troon erboven. Zelfde bron als de
  // 🤡-editie hierboven (getGlobalePias → currentPias), dus kaart en editie
  // wijzen per constructie dezelfde speler aan; de selector valt zelf dicht bij
  // een leeg venster of een roast-schild. Alleen op de live stand, om dezelfde
  // reden als editieCtx.pias daar null is: een archief of tijdmachine heeft
  // geen "deze week".
  const schandpaal = useMemo(
    () =>
      usingScope || !spelerTab
        ? null
        : schandpaalUit(globalePias.data ?? [], profilesMap.data ?? {}, myId),
    [usingScope, spelerTab, globalePias.data, profilesMap.data, myId],
  );

  // AI pias-portret (#682): vangnet voor het geval de server-trigger op
  // pias_of_week niet gelopen heeft. Anders dan bij de dictator is er geen
  // goedkope voorspeller (rating ≥ 1576) — je bent de pias of je bent het niet —
  // dus dit vuurt alleen als ík de globale pias ben en m'n portret vervallen is.
  // Zelfde ref-truc: hooguit één aanroep per bron-foto per sessie.
  const piasPrewarmRef = useRef<string | null>(null);
  useEffect(() => {
    const pm = profilesMap.data;
    if (!pm || schandpaal?.playerId !== myId) return;
    const me = pm[myId];
    if (!me || me.pias_portret === false) return;
    if (!portretVervallen(me, "pias")) return;
    const bron = me.avatar_url ?? GEEN_AVATAR_BRON;
    if (piasPrewarmRef.current === bron) return;
    piasPrewarmRef.current = bron;
    void prewarmPortret("pias");
  }, [profilesMap.data, schandpaal?.playerId, myId]);
  // Kaart-preview (#497): geopend vanaf een rij-tik of raster-kaart.
  const [preview, setPreview] = useState<Row | null>(null);

  const matchesName = (r: Row) =>
    r.name.toLowerCase().includes(nq) ||
    (r.profile?.username?.toLowerCase().includes(nq) ?? false);
  const visibleRows =
    nq && searchable ? ladderRows.filter(matchesName) : ladderRows;
  // Vindbare spelers die niet in de ranglijst staan (bv. nog geen matches).
  const rankedKeys = new Set(rows.map((r) => r.key));
  const extraProfiles =
    nq && tab === "player"
      ? extraResults.filter((p) => !rankedKeys.has(p.id))
      : [];

  // Aantal actieve filterkeuzes — als badge op de menuknop, zodat je ook met
  // een dichtgeklapt menu ziet dat er iets gefilterd wordt. (Zoeken staat los
  // zichtbaar en telt hier niet mee.)
  const activeFilters =
    (season ? 1 : 0) +
    (groupId ? 1 : 0) +
    (asof ? 1 : 0) +
    (minMatches > 0 ? 1 : 0);

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Klassement</h1>
        <p className="page-subtitle">
          {tab === "kaarten"
            ? "De hele club als kaartenwand — tik op een kaart voor de close-up."
            : tab === "player"
              ? "Wie is de koning en wie is het slofje? Puur gesorteerd op rating."
              : "Vaste duo's gesorteerd op pure puntenheerschappij."}
        </p>
      </header>

      <FutKaartDefs />
      <div className="lb-toolbar">
        <div className="tabs">
          <button
            className={`tab ${tab === "player" ? "is-active" : ""}`}
            onClick={() => setTab("player")}
          >
            Spelers
          </button>
          <button
            className={`tab ${tab === "team" ? "is-active" : ""}`}
            onClick={() => setTab("team")}
          >
            Teams
          </button>
          <button
            className={`tab ${tab === "divisies" ? "is-active" : ""}`}
            onClick={() => setTab("divisies")}
          >
            Divisies
          </button>
          <button
            className={`tab ${tab === "kaarten" ? "is-active" : ""}`}
            onClick={() => setTab("kaarten")}
          >
            🃏 Kaarten
          </button>
        </div>

        {/* Zoekbalk staat direct zichtbaar tussen de tabs en de filterknop. */}
        {searchable && (
          <div className="lb-search" role="search">
            <svg
              className="lb-search__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="lb-search__input"
              type="search"
              placeholder="Zoek een speler op naam…"
              aria-label="Zoek een speler"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="lb-search__clear"
                aria-label="Zoekterm wissen"
                onClick={() => setQ("")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Alleen de filters (seizoen/groep/geavanceerd) zitten achter de
            menuknop; een telbadge toont hoeveel er actief zijn. */}
        <details className="lb-menu">
          <summary className="lb-menu__btn" aria-label="Filteren">
            <svg
              className="lb-menu__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
            <span className="lb-menu__label">Filter</span>
            {activeFilters > 0 && (
              <span className="lb-filters__count">{activeFilters}</span>
            )}
          </summary>
          <div className="lb-menu__panel">
            <div className="lb-menu__row">
              <label className="lb-filters__field">
                <span>Seizoen</span>
                <select
                  className="select select--filter"
                  aria-label="Seizoen"
                  value={season?.id ?? ""}
                  onChange={(e) => setSeasonId(e.target.value)}
                >
                  <option value="">Alle tijden</option>
                  {/* Gedeeld seizoen uit de URL dat (nog) niet in de lijst zit. */}
                  {season && !seasons.some((s) => s.id === season.id) && (
                    <option value={season.id}>{season.label}</option>
                  )}
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              {tab !== "team" && (
                <label className="lb-filters__field">
                  <span>Groep</span>
                  <select
                    className="select select--filter"
                    aria-label="Groep"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                  >
                    <option value="">Alle groepen</option>
                    {(groups.data ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Geavanceerd: stand-op-datum en minimaal aantal matches (#71). */}
            <label className="lb-filters__field">
              <span>Stand op datum</span>
              <input
                className="input select--filter lb-date"
                type="date"
                aria-label="Stand op datum"
                title="Bekijk de stand zoals hij was t/m deze datum"
                value={asof}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAsof(e.target.value)}
              />
            </label>
            {myLastMatchDay && (
              <button
                type="button"
                className={`tab lb-menu__preset ${asof === myLastMatchDay ? "is-active" : ""}`}
                onClick={() =>
                  setAsof(asof === myLastMatchDay ? "" : myLastMatchDay)
                }
              >
                Mijn laatste match
              </button>
            )}
            <label className="lb-filters__field">
              <span>Minimaal gespeeld</span>
              <select
                className="select select--filter"
                aria-label="Minimaal aantal matches"
                value={minMatches}
                onChange={(e) => setMin(Number(e.target.value))}
              >
                <option value={0}>Alle spelers</option>
                {[3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    ≥ {n} matches
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </div>

      {asof && (
        <p className="lb-asof-note" role="status">
          Stand zoals op <strong>{asof}</strong> — punten en saldo berekend uit
          alle matches t/m die dag.
        </p>
      )}

      {champion && season && (
        <p className="champion-banner" role="status">
          <span className="champion-banner__cup" aria-hidden="true">
            🏆
          </span>
          <span>
            Kampioen {season.label}: <strong>{champion.name}</strong>
          </span>
          <ShareChampion seasonLabel={season.label} rows={shownPlayerRows} />
        </p>
      )}

      {toonTroon && (
        <>
          <DictatorThrone
            variant={throneRow ? "echt" : "waarnemend"}
            seed={throneRow?.key ?? "kylian-mbappe"}
            name={throneRow?.name ?? DEFAULT_DICTATOR.name}
            profile={throneRow?.profile ?? null}
            rating={throneRow?.rating ?? null}
            link={throneRow?.link}
            isMe={throneRow?.isMe}
            delta={
              throneRow ? deltaToday(throneRow.history, club.timezone) : null
            }
            image={
              throneRow
                ? // Echte dictator: z'n AI-portret (#554) als het klaar is en de
                  // opt-out aan staat; anders undefined → gewone avatar. Sinds
                  // #682 loopt die beslissing via portretVoor, dezelfde helper
                  // als de Schandpaal gebruikt.
                  (portretVoor(pmap[throneRow.key], "dictator") ?? undefined)
                : (waarnemendPortret ?? undefined)
            }
            anthem={
              mbappeRegeert
                ? {
                    playing: anthem.playing,
                    blocked: anthem.blocked,
                    muted: anthem.muted,
                    onToggleMute: anthem.toggleMute,
                    onStart: anthem.start,
                  }
                : undefined
            }
            sinds={throneRow ? (dictator.data?.begonOp ?? null) : null}
          />
          {/* Coach Rudy buigt voor de dictator (#531): kijker-gerichte knieval
              in de buiging-mood i.p.v. z'n gebruikelijke roast — voor een echte
              El Padelissimo én voor Mbappé bij verstek. */}
          <KlassementCommentaar
            tekst={coachBuiging(throneRow?.key ?? "kylian-mbappe", buigingRotatie)}
            mood="buiging"
          />
        </>
      )}

      {showPodium && !nq && (
        <Podium
          bigDaddy={!throneRow}
          entries={volkRows
            .filter((r) => r.rating != null)
            // Met De Troon actief is de dictator al uit `volkRows` gehaald, dus
            // dit zijn de eerstvolgende drie — het volk begint bij #2.
            .slice(0, 3)
            .map((r, i) => ({
              key: r.key,
              name: r.name,
              profile: r.profile,
              link: r.link,
              isMe: r.isMe,
              rating: r.rating,
              // Dag-cumulatieve ELO-beweging (#352), niet de laatste match.
              delta: deltaToday(r.history, club.timezone),
              dimmed: r.games > 0 && r.games < THIN_GAMES,
              tier: true,
              // Echte rang op de medaille zodat het volk zichtbaar bij #2 start.
              medal: throneRow ? i + 2 : undefined,
              sub: `${r.points} ptn`,
              record: `${r.won}W · ${r.drawn}G · ${r.lost}V`,
            }))}
        />
      )}

      {klassementCoach && (
        <KlassementCommentaar
          tekst={klassementCoach.tekst}
          mood={klassementCoach.mood}
        />
      )}

      {tab === "divisies" && (
        <>
          <TierProgressBanner rating={rmap[myId]?.rating ?? null} />
          {groupPias && (
            <PiasBanner pias={groupPias} groepsnaam={groupPias.groepsnaam} />
          )}
          <TierLegend pias={groupPias} />
        </>
      )}

      <div className="card">
        {loading ? (
          <StandingsSkeleton rows={6} />
        ) : error ? (
          <p className="msg msg--error">{error}</p>
        ) : rows.length === 0 ? (
          season ? (
            <p className="empty">Geen matches in dit seizoen.</p>
          ) : asof ? (
            <p className="empty">
              {minMatches > 0
                ? `Geen spelers met minstens ${minMatches} matches t/m ${asof}.`
                : `Nog geen matches t/m ${asof}.`}
            </p>
          ) : minMatches > 0 ? (
            <p className="empty">
              Geen spelers met minstens {minMatches} gespeelde matches.
            </p>
          ) : (
            <EmptyState
              icon="🏆"
              title="De trofeeënkast staat nog leeg."
              action={
                <Link className="btn btn--primary" to="/matches">
                  Naar matches
                </Link>
              }
            >
              Zodra de eerste wedstrijdscore binnenrolt, barst de strijd om de topposities los!
            </EmptyState>
          )
        ) : tab === "divisies" ? (
          <TierDivisions rows={displayRows} />
        ) : visibleRows.length === 0 ? (
          <p className="empty">
            Geen speler in de ranglijst gevonden voor “{q.trim()}”.
          </p>
        ) : tab === "kaarten" ? (
          <KaartRaster
            rows={visibleRows}
            edities={editieCtx}
            onPreview={setPreview}
          />
        ) : (
          <div className="standings-switch">
            <StandingsTable
              rows={visibleRows}
              showForm={tab === "player"}
              meRef={meRowRef}
              onPreview={tab === "player" ? setPreview : undefined}
            />
            <RankList
              rows={visibleRows}
              meRef={meItemRef}
              lead={tab === "player" ? "rating" : "points"}
              onPreview={tab === "player" ? setPreview : undefined}
            />
          </div>
        )}
      </div>

      {/* De Schandpaal (#682): de pias van de club onder de ranglijst. De troon
          staat erboven, de schandpaal eronder — de sandwich vertelt het verhaal.
          Zelfde poorten als de troon: niet tijdens laden/fouten en niet terwijl
          je zoekt (dan is de lijst geen klassement meer). */}
      {schandpaal && !loading && !error && !nq && (
        <Schandpaal
          name={schandpaal.naam}
          profile={schandpaal.profile}
          detail={schandpaal.detail}
          weekStart={schandpaal.weekStart}
          link={schandpaal.link}
          isMe={schandpaal.isMe}
          // Het AI-hofnar-portret (#682) zodra het klaar is en de opt-out aan
          // staat; anders undefined → de gewone avatar, geen skeleton (#555).
          image={portretVoor(schandpaal.profile, "pias") ?? undefined}
          ctx={schandpaal.ctx}
          seed={schandpaal.seed}
        />
      )}

      {/* Ook gevonden buiten de ranglijst (#282): vindbare spelers die (nog)
          niet meespelen — met een link naar hun profiel. */}
      {extraProfiles.length > 0 && (
        <section className="card lb-extra">
          <h2 className="card__title card__title--tight">Ook gevonden</h2>
          <p className="lb-extra__sub">
            Deze spelers staan (nog) niet in het klassement.
          </p>
          <ul className="lb-extra__list">
            {extraProfiles.map((p) => (
              <li key={p.id}>
                <Link className="lb-extra__item" to={`/spelers/${p.id}`}>
                  <Avatar profile={p} size={32} />
                  <span className="lb-extra__name">{displayName(p)}</span>
                  <span className="lb-extra__go" aria-hidden="true">
                    Profiel →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Uitleg onderaan: wie hem nodig heeft vindt hem, wie de stand komt
          checken krijgt die meteen bovenaan te zien. */}
      <KlassementUitleg />

      {tab === "player" && myRankIdx >= 0 && rows.length > 8 && !nq &&
        !throneRow?.isMe && (
        <button className="me-chip" onClick={scrollToMe}>
          Jouw positie · #{myRankIdx + 1}
        </button>
      )}

      {preview && (
        <KaartPreview
          row={preview}
          edities={editieCtx}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export default Leaderboard;
