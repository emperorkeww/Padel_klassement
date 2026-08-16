import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useCacheRevision } from "@/lib/hooks/useCacheRevision";
import { errorMessage } from "@/lib/utils/errors";
import { celebrate } from "@/lib/utils/confetti";
import { tap, winPulse } from "@/lib/utils/haptics";
import { formatPlannedDay, formatTime } from "@/lib/utils/format";
import { winChance } from "@/features/rating/elo";
import { inTeam } from "@/features/rating/results";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { coachPreMatch } from "@/features/coach/coachMoments";
import { verliesreeksTegen } from "@/features/coach/coachStats";
import {
  groupRivalries,
  rivalryForMatch,
  rivalryHeadline,
  standAfter,
} from "@/features/groups/rivalry";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { displayName } from "@/features/profiles/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { getMyGroups } from "@/features/groups/api";
import { useClub } from "@/features/availability/club";
import { predictionPoints } from "@/features/matches/predictions";
import { getMatchPredictions } from "@/features/matches/predictionsApi";
import type { Match, Profile, RoastIntensiteit, Team } from "@/types";
import { teamLabel } from "@/features/matches/api";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import {
  slaCorrectieOp,
  verwijderMatchSlim,
  verzetTijdstip,
  vulUitslagIn,
} from "@/features/admin/matchBeheer";
import { serveerTeam } from "@/features/matches/serve";
import { lefGestart, stakeSwing } from "@/features/matches/stakes";
import { drankIcon, drankLabel } from "@/features/matches/drankkaart";
import { getMatchStakes } from "@/features/matches/stakesApi";
import {
  eigenSwing,
  jokerIcoon,
  jokerLabel,
  zichtbareJokers,
} from "@/features/matches/jokers";
import { getMatchJokers } from "@/features/matches/jokersApi";
import { BountyBanner } from "@/features/matches/components/BountyBanner";
import { JokerBlock } from "@/features/matches/components/JokerBlock";
import { TraktatieBlock } from "@/features/matches/components/TraktatieBlock";
import {
  MatchOptions,
  type MatchOptie,
} from "@/features/matches/components/MatchOptions";
import {
  TotoTegel,
  totoSamenvatting,
} from "@/features/matches/components/TotoTegel";
import { LefTipBlock } from "@/features/matches/components/LefTipBlock";
import { MatchCalendarButton } from "@/features/matches/components/MatchCalendarButton";
import { BezettingPaneel } from "@/features/matches/components/BezettingPaneel";
import { MatchManagementSheet } from "@/features/matches/components/MatchManagementSheet";
import { TeamSide } from "@/features/matches/components/TeamSide";
import { MatchProbability } from "@/features/matches/components/MatchProbability";
import {
  ACTIE_LABEL,
  matchFase,
  matchRechten,
  primaireActie,
  tippenOpen,
} from "@/features/matches/matchState";
import { RatingPreview } from "@/features/matches/components/RatingPreview";
import {
  ScoreSheet,
  type ScoreInvoer,
} from "@/features/matches/components/ScoreSheet";
import "./PlannedMatchCard.css";

const UNDO_MS = 6000;
/** Countdown-pil pas binnen dit venster: verder weg zegt de datumregel genoeg. */
const DEADLINE_WINDOW_MS = 24 * 3600_000;

/** ISO-tijdstip -> waarde voor een <input type="datetime-local"> ("" = geen). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** "2 u 14 m" / "41 m" voor de countdown naar de starttijd. */
function overLabel(ms: number): string {
  const min = Math.max(1, Math.floor(ms / 60_000));
  const u = Math.floor(min / 60);
  return u > 0 ? `${u} u ${min % 60} m` : `${min} m`;
}

/** Geplande match als kaart met inline score-invoer. Opbouw (#362, herzien in
 *  #941): bovenaan wanneer/waar met de tipdeadline als countdown, dan de
 *  team-rijen met één gedeelde winkansbalk ertussen, de bounty, en een voet met
 *  één knop. Agenda en beheer (⋯) zitten als icoonknoppen in de kop.
 *
 *  Dát is de hele kaart zolang ze dicht staat. Achter die ene knop zitten de
 *  score-steppers, de sets, de inzetten (toto + lef) en de contextgroep (coach +
 *  rivaliteit) — samen zo'n 800px per kaart, en met een handvol geplande
 *  matches was de lijst daardoor niet meer te overzien. Wat zichtbaar blijft is
 *  wat je zónder invullen wil weten.
 *  De winnaar volgt automatisch uit de score; gelijke score = gelijkspel.
 *
 *  Opslaan is optimistisch: de kaart klapt direct om naar de uitslag — mét
 *  wat je toto-tip en lef-inzet opleverden — en wordt alleen teruggedraaid
 *  als de server weigert (bv. al door een ander ingevuld). */
export function PlannedMatchCard({
  match: m,
  teams,
  profiles,
  perspectiveId,
  history,
  intensiteit = "gemeen",
  rondeMatches,
  onSaved,
  onDeleted,
}: {
  match: Match;
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Speler vanuit wiens oogpunt gevierd wordt (confetti bij eigen winst). */
  perspectiveId?: string;
  /** Roast-toon van de groep van deze match (#183), voor Coach Rudy's pre-match
   *  hype. Buiten groepscontext valt hij op `gemeen`. */
  intensiteit?: RoastIntensiteit;
  /** Eerdere matches waaruit de onderlinge rivaliteit wordt afgeleid; zonder
   *  deze prop toont de kaart geen head-to-head-balans. */
  history?: Match[];
  /** De andere wedstrijden van dezelfde ronde (#1327). Alleen de speeldag kent
   *  die context; zonder deze prop biedt "Spelers wijzigen" geen ruil met een
   *  andere baan aan, en blijven vervangen en van team wisselen over. */
  rondeMatches?: Match[];
  onSaved?: () => void;
  /** Aangeroepen nadat de match echt verwijderd is (bv. terugnavigeren op de
   *  detailpagina). Zonder deze prop valt het terug op onSaved. */
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const club = useClub();
  // De score-invoer zelf zit in ScoreSheet (#1144); hier blijft alleen of hij
  // openstaat en wat er (optimistisch) is opgeslagen.
  const [scoreOpen, setScoreOpen] = useState(false);
  // Corrigeren vanaf de kaart (#1271), zonder de omweg via /matches/:id.
  const [corrigeren, setCorrigeren] = useState(false);
  const [saved, setSaved] = useState<{
    a: number;
    b: number;
    /** Bijgewerkte onderlinge stand, bevroren op het moment van opslaan
     *  (daarna telt de match zelf mee in `history`). */
    rivalryLine?: string;
  } | null>(null);

  // De context achter de kaart — toto, lef, joker, coach, rivaliteit — zit nog
  // achter één uitklapper. De score zat daar tot #1144 bij in; die is naar een
  // sheet verhuisd, zodat de primaire actie één tik is en de lijst eronder niet
  // meer verspringt.
  const [open, setOpen] = useState(false);
  const bodyId = `planned-body-${m.id}`;

  // Beheeracties (tijd/verwijderen) zitten achter de ⋯-sheet in de kop.
  const [manageOpen, setManageOpen] = useState(false);

  // Tijd wijzigen (uitklapbaar).
  const [timeVal, setTimeVal] = useState(() => toLocalInput(m.played_at));
  const [busyTime, setBusyTime] = useState(false);

  // Verwijderen met undo: we wachten UNDO_MS vóór de server-call, zodat de
  // gebruiker het ongedaan kan maken zonder dat er iets hersteld hoeft te worden.
  const [pendingDelete, setPendingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    },
    [],
  );

  // Countdown naar de starttijd (= tipdeadline): elke minuut bijwerken zolang
  // de pil in beeld kan zijn; buiten het venster draait er geen timer.
  const startMs = m.played_at ? new Date(m.played_at).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const tikt =
    m.status === "scheduled" &&
    startMs != null &&
    startMs - now > 0 &&
    startMs - now <= DEADLINE_WINDOW_MS;
  useEffect(() => {
    if (!tikt) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [tikt]);

  // Spannendste rivaliteit tussen de vier tegenover-elkaar-paren, afgeleid
  // uit de meegegeven historiek (alleen afgeronde matches tellen mee).
  const rivalry = useMemo(() => {
    if (!history?.length) return null;
    return rivalryForMatch(m, teams, groupRivalries(history, teams));
  }, [history, teams, m]);
  const nameOf = (id: string) => displayName(profiles[id]);

  // Verwachte winstkans uit de (gecachte) ratings — zelfde Elo als de databank.
  const ratings = useAsync(getPlayerRatings, []);
  const chance =
    ratings.data && teams[m.team_a_id] && teams[m.team_b_id]
      ? winChance(teams[m.team_a_id], teams[m.team_b_id], ratings.data)
      : null;
  const pctA = chance != null ? Math.round(chance * 100) : null;

  // Toto (#116): tips op deze match. Alleen groepsmatches zijn tipbaar; de
  // guard-trigger dwingt dat ook serverside af.
  const { user } = useAuth();
  const myId = user?.id ?? null;
  // Coach Rudy's pre-match hype (#213): kansinschatting vanuit jóuw team.
  const mijnTeam =
    myId && inTeam(teams[m.team_a_id], myId)
      ? "a"
      : myId && inTeam(teams[m.team_b_id], myId)
        ? "b"
        : null;
  const mijnKans =
    chance == null || mijnTeam == null
      ? null
      : mijnTeam === "a"
        ? chance
        : 1 - chance;
  // Head-to-head tegen de tegenstander (#581): leid het uit de al berekende
  // `rivalry` af, mits ík in het rivaliteitspaar zit; anders geen H2H-hook.
  const preH2H =
    rivalry && myId && (myId === rivalry.a || myId === rivalry.b)
      ? {
          rivaal: displayName(
            profiles[myId === rivalry.a ? rivalry.b : rivalry.a],
          ),
          mijnWins: myId === rivalry.a ? rivalry.winsA : rivalry.winsB,
          oppWins: myId === rivalry.a ? rivalry.winsB : rivalry.winsA,
          verliesreeks: verliesreeksTegen(
            history ?? [],
            teams,
            myId,
            myId === rivalry.a ? rivalry.b : rivalry.a,
            m,
          ),
        }
      : null;
  const coachPre =
    mijnKans != null && myId
      ? coachPreMatch(
          mijnKans,
          `${m.id}-${myId}`,
          {
            intensiteit,
            schild: profiles[myId]?.roast_schild ?? false,
          },
          preH2H,
        )
      : null;
  // Eerste opslag (#435): alleen relevant zolang de match nog gespeeld moet
  // worden; na afronding verdwijnt de chip.
  const serveKant = m.status === "scheduled" ? serveerTeam(m) : null;

  const isGroupMatch = m.group_id != null;
  // Teamlabels: één keer afgeleid, gebruikt door de winkansbalk, de steppers,
  // de toto-tegel en de setinvoer.
  const labelA = teamLabel(teams[m.team_a_id], profiles);
  const labelB = teamLabel(teams[m.team_b_id], profiles);
  // De organisator van een speeldag staat vaak niet zelf op de baan en drukte
  // ook niet op "ronde maken", maar mag de uitslag wél invullen (RLS). Zijn
  // eigen groepen zijn genoeg om dat te weten; getMyGroups is gecacht en wordt
  // over alle kaarten op het scherm gedeeld.
  const myGroups = useAsync(
    () => (isGroupMatch ? getMyGroups() : Promise.resolve([])),
    [isGroupMatch],
  );
  const isGroupOwner =
    !!myId &&
    (myGroups.data ?? []).some(
      (g) => g.id === m.group_id && g.created_by === myId,
    );
  // Lidmaatschap van de groep telt alleen voor de bezetting (#1327). Zelfde
  // (gecachte) lijst, dus het kost geen extra vraag. Wel `member_ids` en niet
  // "staat erin": getMyGroups is RLS-gefilterd, niet tot je eigen groepen.
  const isGroupMember =
    !!myId &&
    (myGroups.data ?? []).some(
      (g) => g.id === m.group_id && g.member_ids.includes(myId),
    );
  // Lef op de kaartkop (#981): vóór de aftrap alleen je éígen inzet — een
  // 🎲-pil die je vertelt waar je dagtegoed staat zonder de kaart te openen.
  // Vanaf de aftrap onthult dezelfde pil voor iedereen wie er lef had; de
  // volgorde van die twee staten is de anti-meelift-garantie uit LefTipBlock.
  // getMatchStakes is gecacht en gedeeld met de tegel; de cache-revisie trekt
  // de pil bij zodra ergens een inzet gezet of ingetrokken wordt (#907).
  const stakesRev = useCacheRevision("match-stakes");
  const kaartStakes = useAsync(
    () => (isGroupMatch ? getMatchStakes(m.id) : Promise.resolve([])),
    [m.id, isGroupMatch, stakesRev],
  );
  const lefOnthuld =
    lefGestart(m, now) && (kaartStakes.data?.length ?? 0) > 0;
  const mijnLefHier =
    !lefGestart(m, now) &&
    !!myId &&
    (kaartStakes.data ?? []).some((s) => s.player_id === myId);
  const lefInzetters = (kaartStakes.data ?? []).map((s) =>
    displayName(profiles[s.player_id]),
  );
  // Staat er lef van mij op deze match? Anders dan `mijnLefHier` (die de pil
  // vóór de aftrap stuurt) geldt dit ook ná de aftrap — precies wanneer je de
  // uitslag invult en de ratingpreview wil kloppen.
  const mijnLefOpDezeMatch =
    !!myId && (kaartStakes.data ?? []).some((s) => s.player_id === myId);
  // Joker op de kaartkop (#1003), langs dezelfde route als de lef-pil: vóór de
  // aftrap alleen je eigen kaart plus de sociale kaarten van anderen (die
  // veranderen hoe er gespeeld wordt), daarna alles. zichtbareJokers draagt die
  // regel, zodat kop en tegel niet uit elkaar kunnen lopen.
  const jokersRev = useCacheRevision("match-jokers");
  const kaartJokers = useAsync(
    () => (isGroupMatch ? getMatchJokers(m.id) : Promise.resolve([])),
    [m.id, isGroupMatch, jokersRev],
  );
  // Mijn eigen kaart op deze match; die zie ik altijd, ook vóór de aftrap.
  const mijnJoker =
    (kaartJokers.data ?? []).find((j) => j.player_id === myId)?.joker ?? null;
  const zichtbareKaarten = zichtbareJokers({
    match: m,
    jokers: kaartJokers.data ?? [],
    myId,
    now,
  });

  const predictions = useAsync(
    () => (isGroupMatch ? getMatchPredictions(m.id) : Promise.resolve([])),
    [m.id, isGroupMatch],
  );
  const preds = predictions.data ?? [];
  const myPrediction = myId
    ? (preds.find((p) => p.player_id === myId) ?? null)
    : null;
  const tippingOpen =
    isGroupMatch &&
    m.status === "scheduled" &&
    (!m.played_at || new Date(m.played_at).getTime() > Date.now());
  const showTips = isGroupMatch && !!myId && (tippingOpen || preds.length > 0);

  // Wie wat mag, in één keer afgeleid (#1144). De regels zelf — en waarom
  // beheer op `perspectiveId` hangt en invullen op `myId` — staan in
  // matchState.ts, zodat kaart, detail en groepsronde niet uit elkaar lopen.
  // De beheerder van de app mag overal aan (#1159); useIsAdmin cachet per
  // sessie, dus een lijst met twintig kaarten kost één vraag.
  const isAppAdmin = useIsAdmin() === true;
  const rechten = matchRechten({
    match: m,
    teams,
    myId,
    perspectiveId,
    isGroupOwner,
    isGroupMember,
    isAppAdmin,
  });
  const canManage = rechten.magBeheren;
  const canScore = rechten.magInvullen;
  const mijnGames = (myId && ratings.data?.[myId]?.games) || 0;

  // Matchopties (#1144): elke rij zegt hoe het ervoor staat en opent het
  // bestaande blok in een sheet. Rijen die niet van toepassing zijn verschijnen
  // niet — buiten een groep bestaan toto, lef en joker gewoon niet.
  const opties: MatchOptie[] = [];
  if (showTips) {
    opties.push({
      sleutel: "toto",
      icoon: "🎯",
      naam: "Toto",
      waarde: totoSamenvatting({ preds, myId, teams, profiles, tippingOpen }),
      inhoud: (
        <TotoTegel
          match={m}
          teams={teams}
          profiles={profiles}
          myId={myId}
          preds={preds}
          chance={chance}
          pctA={pctA}
          tippingOpen={tippingOpen}
          onChanged={predictions.reload}
        />
      ),
    });
  }
  // Deelnemers zien deze twee altijd; anderen alleen als er iets te zien is —
  // dezelfde regel die JokerBlock en LefTipBlock zelf hanteren. Zonder deze
  // spiegel zou er een rij staan die een leeg blok opent.
  if (isGroupMatch && (mijnTeam != null || zichtbareKaarten.length > 0)) {
    opties.push({
      sleutel: "joker",
      icoon: "🃏",
      naam: "Speciale kaart",
      // Volgt zichtbareJokers: vóór de aftrap dus alleen je eigen kaart en de
      // sociale kaarten van anderen. De anti-meelift-garantie mag hier niet
      // alsnog uit lekken.
      waarde: mijnJoker
        ? jokerLabel(mijnJoker)
        : zichtbareKaarten.length > 0
          ? `${zichtbareKaarten.length} gespeeld`
          : "Geen",
      inhoud: (
        <JokerBlock
          match={m}
          profiles={profiles}
          myId={myId}
          isDeelnemer={mijnTeam != null}
          mijnKans={mijnKans}
          games={mijnGames}
        />
      ),
    });
  }
  if (isGroupMatch && (mijnTeam != null || lefOnthuld)) {
    opties.push({
      sleutel: "lef",
      icoon: "🎲",
      naam: "Lef",
      waarde: mijnLefOpDezeMatch
        ? "Jouw lef staat erop"
        : lefOnthuld
          ? `${lefInzetters.length} ${lefInzetters.length === 1 ? "inzet" : "inzetten"}`
          : "Geen",
      inhoud: (
        <LefTipBlock
          match={m}
          profiles={profiles}
          myId={myId}
          isDeelnemer={mijnTeam != null}
          mijnKans={mijnKans}
          games={mijnGames}
          matches={history}
        />
      ),
    });
  }
  // TraktatieBlock verbergt zichzelf als er niets staat en jij er niets aan mag
  // veranderen; de rij volgt dat.
  if (m.wager_drink || canScore) {
    opties.push({
        sleutel: "inzet",
      icoon: "🍻",
      naam: "Inzet",
      waarde: m.wager_drink
        ? `${m.wager_drink_qty ?? 1}× ${drankLabel(m.wager_drink)}`
        : "Nog niets afgesproken",
      inhoud: (
        <TraktatieBlock
          match={m}
          profiles={profiles}
          magBeheren={canScore}
          onSaved={() => onSaved?.()}
        />
      ),
    });
  }
  if (mijnTeam != null && mijnKans != null) {
    const swing = eigenSwing({
      mijnKans,
      staked: mijnLefOpDezeMatch,
      joker: mijnJoker,
    });
    opties.push({
      sleutel: "rating",
      icoon: "📊",
      naam: "Rating",
      waarde: `+${swing.winst} / ${swing.verlies}`,
      inhoud: (
        <RatingPreview
          mijnKans={mijnKans}
          staked={mijnLefOpDezeMatch}
          joker={mijnJoker}
        />
      ),
    });
  }

  /** Slaat de uitslag op. Optimistisch: de kaart klapt meteen om naar de
   *  uitslag — mét wat je toto-tip en lef-inzet opleverden — en draait alleen
   *  terug als de server weigert (bv. al door een ander ingevuld). De fout
   *  wordt doorgegooid zodat ScoreSheet hem meldt en openblijft. */
  async function save(invoer: ScoreInvoer) {
    if (saved) return;
    const a = invoer.scoreA;
    const b = invoer.scoreB;

    // Rivaliteitsmoment: wie van het rivalenpaar won dit duel (null = gelijk),
    // en hoe staat het daarna? Vastleggen vóór de herlaadde data binnenkomt.
    const winnerTeam = a === b ? null : teams[a > b ? m.team_a_id : m.team_b_id];
    const rivalWinner =
      rivalry === null
        ? null
        : winnerTeam === null
          ? null
          : inTeam(winnerTeam, rivalry.a)
            ? rivalry.a
            : rivalry.b;
    const rivalryLine = rivalry
      ? (() => {
          const after = standAfter(rivalry, rivalWinner);
          return `${nameOf(rivalry.a)} ${after.winsA}–${after.winsB} ${nameOf(rivalry.b)}`;
        })()
      : undefined;

    setSaved({ a, b, rivalryLine }); // optimistisch: meteen als uitslag tonen
    try {
      await vulUitslagIn(
        {
          matchId: m.id,
          winnerTeamId: a === b ? null : a > b ? m.team_a_id : m.team_b_id,
          scoreA: a,
          scoreB: b,
          setScores: invoer.setScores,
          // De geplande speeltijd blijft staan, zodat de match op zijn eigen
          // speeldag blijft als je hem pas later invult (#1271).
          playedAt: m.played_at,
        },
        rechten.alsBeheerder,
      );
      const iWon =
        !!perspectiveId &&
        !!winnerTeam &&
        (winnerTeam.player1_id === perspectiveId ||
          winnerTeam.player2_id === perspectiveId);
      if (iWon) {
        celebrate();
        winPulse();
      } else {
        tap();
      }
      if (rivalry) {
        toast.success(`🔥 ${rivalryHeadline(rivalry, rivalWinner, nameOf)}`);
      } else {
        toast.success("Resultaat opgeslagen.");
      }
      onSaved?.();
    } catch (err) {
      setSaved(null); // terugdraaien; de kaart is weer invulbaar
      throw err; // ScoreSheet meldt de fout en houdt je invoer vast
    }
  }

  async function saveTime() {
    setBusyTime(true);
    try {
      await verzetTijdstip(
        m.id,
        timeVal ? new Date(timeVal).toISOString() : null,
        rechten.alsBeheerder,
      );
      tap();
      toast.success("Tijdstip bijgewerkt.");
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyTime(false);
    }
  }

  function startDelete() {
    setPendingDelete(true);
    deleteTimer.current = setTimeout(async () => {
      try {
        await verwijderMatchSlim(m.id, rechten.alsBeheerder);
        tap();
        (onDeleted ?? onSaved)?.();
      } catch (err) {
        setPendingDelete(false); // terug tevoorschijn; niets verwijderd
        toast.error(errorMessage(err));
      }
    }, UNDO_MS);
  }

  function undoDelete() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    setPendingDelete(false);
  }

  // Undo-strook zolang de verwijdering nog kan worden teruggedraaid.
  if (pendingDelete) {
    return (
      <div className="planned-card__undo" role="status">
        <span>
          {rechten.alsBeheerder
            ? "Match verwijderd als beheerder."
            : "Match verwijderd."}
        </span>
        <button className="btn btn--sm" onClick={undoDelete}>
          Ongedaan maken
        </button>
      </div>
    );
  }

  if (saved) {
    const aWon = saved.a > saved.b;
    const bWon = saved.b > saved.a;
    const draw = !aWon && !bWon;
    // Uitkomst van de eigen inzetten meteen bij de uitslag: het
    // beloningsmoment dat toto en lef de volgende keer relevant maakt.
    const winnerId = draw ? null : aWon ? m.team_a_id : m.team_b_id;
    const tipJuist =
      myPrediction != null && myPrediction.predicted_team_id === winnerId;
    const tipPts = myPrediction
      ? predictionPoints(myPrediction.win_chance)
      : null;
    const ikWon = mijnTeam != null && (mijnTeam === "a" ? aWon : bWon);
    return (
      <div className="planned-saved">
        <div className="match-card">
          <TeamSide team={teams[m.team_a_id]} profiles={profiles} won={aWon} />
          <span className="match-card__mid">
            <span className="match-card__score">
              {saved.a}–{saved.b}
            </span>
            <span className="match-card__meta">
              {aWon || bWon ? "opgeslagen ✓" : "gelijkspel · opgeslagen ✓"}
              {saved.rivalryLine ? ` · 🔥 ${saved.rivalryLine}` : ""}
            </span>
          </span>
          <TeamSide team={teams[m.team_b_id]} profiles={profiles} won={bWon} right />
        </div>
        {isGroupMatch && (myPrediction || (mijnTeam != null && myId)) && (
          <div className="planned-saved__bets">
            {myPrediction && (
              <p className="planned-saved__line planned-saved__line--toto">
                <span aria-hidden="true">🎯</span>
                <span className="planned-saved__what">
                  Jouw tip:{" "}
                  {draw ? "gelijkspel — geen punten" : tipJuist ? "juist" : "mis"}
                </span>
                <strong
                  className={`planned-saved__amount${tipJuist ? " is-up" : ""}`}
                >
                  {tipJuist ? `+${tipPts} pt` : "0 pt"}
                </strong>
              </p>
            )}
            {mijnTeam != null && myId && (
              <LefSavedLine
                matchId={m.id}
                myId={myId}
                mijnKans={mijnKans}
                draw={draw}
                won={ikWon}
              />
            )}
          </div>
        )}
        {/* Een typfout rechtzetten (#1271). De kaart klapte na het opslaan om
            naar "opgeslagen ✓" en bood daarna niets meer: corrigeren betekende
            naar /matches/:id, dan ⋯, dan "Score corrigeren". Op de avond zelf,
            met natte handen, is dat de verkeerde kant op. */}
        {rechten.magCorrigeren && (
          <>
            <button
              className="btn btn--sm planned-saved__corrigeer"
              onClick={() => setCorrigeren(true)}
            >
              Score corrigeren
            </button>
            {corrigeren && (
              <ScoreSheet
                open
                match={
                  {
                    ...m,
                    status: "completed",
                    score_a: saved.a,
                    score_b: saved.b,
                  } as Match
                }
                labelA={labelA}
                labelB={labelB}
                titel="Uitslag corrigeren"
                opslaanLabel="Score opslaan"
                onClose={() => setCorrigeren(false)}
                onSave={async (invoer) => {
                  const { scoreA: a, scoreB: b } = invoer;
                  await slaCorrectieOp(
                    {
                      matchId: m.id,
                      winnerTeamId:
                        a === b ? null : a > b ? m.team_a_id : m.team_b_id,
                      scoreA: a,
                      scoreB: b,
                      setScores: invoer.setScores,
                    },
                    rechten.alsBeheerder,
                  );
                  setSaved((v) => (v ? { ...v, a, b } : v));
                  setCorrigeren(false);
                  onSaved?.();
                }}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // Kopregel: wanneer & waar — de essentie van een géplande match. De dagnaam
  // met een hoofdletter; de waar-regel volgt de rustige meta-toon van de app.
  const dag = formatPlannedDay(m.played_at);
  const dagLabel = dag ? dag.charAt(0).toUpperCase() + dag.slice(1) : null;
  const whereLine = [
    m.round_number != null ? `ronde ${m.round_number}` : null,
    club.name,
  ]
    .filter(Boolean)
    .join(" · ");
  // Countdown-pil naar de tipdeadline (= starttijd), alleen binnen 24 uur.
  const msLeft = startMs != null ? startMs - now : null;
  const deadline =
    m.status === "scheduled" &&
    msLeft != null &&
    msLeft > 0 &&
    msLeft <= DEADLINE_WINDOW_MS
      ? {
          label: isGroupMatch
            ? `tippen sluit over ${overLabel(msLeft)}`
            : `start over ${overLabel(msLeft)}`,
          closing: msLeft < 3600_000,
        }
      : null;

  // Eén dominante actie per staat (#1144); welke dat is beslist matchState.
  // Invullen en corrigeren openen de sheet, een half klaargezette match opent
  // het tijdstip. Tippen en kijken hebben geen eigen knop nodig — daarvoor is
  // de uitklapper er al, en die belooft dan ook "Tippen".
  const actie = primaireActie({
    fase: matchFase(m),
    rechten,
    tippenOpen: tippenOpen(m, now),
  });
  const actieKnop =
    actie === "uitslag-invullen" || actie === "score-invoeren"
      ? { label: ACTIE_LABEL[actie], onClick: () => setScoreOpen(true) }
      : actie === "match-vervolledigen"
        ? { label: ACTIE_LABEL[actie], onClick: () => setManageOpen(true) }
        : null;
  const meerLabel = actie === "tippen" ? "Tippen" : "Details";

  // Welke modifier de ene plek in de kop verdient. Volgorde: de joker weegt het
  // zwaarst (één per maand, en "wissel van kant" verandert zelfs de opstelling),
  // dan de lef-inzet (één per dag, verdubbelt je mutatie), dan het drankje —
  // sociaal, en de enige die de rating niet raakt.
  const modifierPil = (() => {
    if (zichtbareKaarten.length > 0) {
      const eerste = zichtbareKaarten[0];
      return {
        soort: "joker" as const,
        tekst:
          zichtbareKaarten.length === 1
            ? `${jokerIcoon(eerste.joker)} ${jokerLabel(eerste.joker)}`
            : `🃏 ${zichtbareKaarten.length} jokers`,
        titel: zichtbareKaarten
          .map(
            (j) => `${displayName(profiles[j.player_id])}: ${jokerLabel(j.joker)}`,
          )
          .join(" · "),
      };
    }
    if (mijnLefHier || lefOnthuld) {
      return {
        soort: "lef" as const,
        tekst: lefOnthuld
          ? `🎲 Lef: ${
              lefInzetters.length > 1
                ? `${lefInzetters[0]} +${lefInzetters.length - 1}`
                : lefInzetters[0]
            }`
          : "🎲 jouw lef",
        titel: lefOnthuld
          ? `Lef getoond door ${lefInzetters.join(", ")}`
          : "Jouw lef staat op deze match",
      };
    }
    if (m.wager_drink) {
      return {
        soort: "inzet" as const,
        tekst: `${drankIcon(m.wager_drink)} ${m.wager_drink_qty ?? 1}× ${drankLabel(m.wager_drink)}`,
        titel: "De verliezers trakteren de winnaars",
      };
    }
    return null;
  })();

  // Scorebord-layout: per rij een team met zijn eigen stepper; de verwachte
  // winkans als één gedeelde balk tussen de twee rijen.
  return (
    // Het id is het anker voor "je lef staat al op …" op een andere kaart van
    // dezelfde speeldag (#981): tikken scrolt hierheen.
    <div className="planned-card" id={`match-${m.id}`}>
      <div className="planned-card__head">
        <div className="planned-card__when">
          <span className="planned-card__when-day">
            {m.played_at ? (
              <>
                {dagLabel} ·{" "}
                <time dateTime={m.played_at}>{formatTime(m.played_at)}</time>
              </>
            ) : (
              <span className="planned-card__when-tbd">Nog geen tijdstip</span>
            )}
            {deadline && (
              <span
                className={`planned-card__deadline${
                  deadline.closing ? " planned-card__deadline--closing" : ""
                }`}
              >
                {deadline.label}
              </span>
            )}
            {/* Hoogstens één modifier-pil (#1144). Er konden er drie naast
                elkaar staan — lef, joker en drankje — die op telefoonbreedte
                naar drie regels wrapten en de kop lieten concurreren met de
                namen eronder. De rest staat als optierij achter "Details", dus
                er verdwijnt niets; er staat alleen niet alles tegelijk. */}
            {modifierPil && (
              <span
                className={`planned-card__pil planned-card__pil--${modifierPil.soort}`}
                title={modifierPil.titel}
              >
                {modifierPil.tekst}
              </span>
            )}          </span>
          {whereLine && <span className="planned-card__where">{whereLine}</span>}
        </div>
        <MatchCalendarButton match={m} teams={teams} profiles={profiles} />
        {(canManage || rechten.magBezetting) && (
          <button
            type="button"
            className="iconbtn"
            aria-label="Meer acties"
            aria-haspopup="dialog"
            onClick={() => setManageOpen(true)}
          >
            ⋯
          </button>
        )}
      </div>

      <div className="planned-card__row">
        <TeamSide
          team={teams[m.team_a_id]}
          profiles={profiles}
          won={false}
          ratings={ratings.data ?? undefined}
        />
        {serveKant === "a" && <ServeChip teamName={labelA} />}
      </div>

      <MatchProbability pctA={pctA} labelA={labelA} labelB={labelB} />

      <div className="planned-card__row">
        <TeamSide
          team={teams[m.team_b_id]}
          profiles={profiles}
          won={false}
          ratings={ratings.data ?? undefined}
        />
        {serveKant === "b" && <ServeChip teamName={labelB} />}
      </div>

      {/* Bounty (#805): staat er een leider op het veld, dan hoort iedereen
          vóór de aftrap te weten wat er te halen valt — ook zonder de kaart uit
          te klappen. */}
      <BountyBanner match={m} teams={teams} profiles={profiles} />

      {/* Alles hieronder is het invulformulier met zijn context; ingeklapt
          blijft de kaart kop + teams + winkans + bounty + één knop (#941). */}
      {open && (
        <div className="planned-card__body" id={bodyId}>
          {/* Wie niet mag invullen krijgt uitleg in plaats van een stilletjes
              lege kaart; de toto hieronder blijft juist voor kijkers relevant. */}
          {!canScore && (
            <p className="planned-card__noscore">
              Alleen de spelers, de aanmaker of de groepseigenaar kunnen het
              resultaat invullen.
            </p>
          )}

          {/* Matchopties (#1144): toto, speciale kaart, inzet en rating als
              compacte rijen in plaats van drie gekleurde tegels onder elkaar.
              De blokken erachter zijn ongewijzigd — alleen hun verpakking. */}
          <MatchOptions opties={opties} />

          {/* Coach en rivaliteit gegroepeerd als rustig tussenblok. */}
          {(coachPre || rivalry) && (
            <div className="planned-card__context">
              {coachPre && (
                <p className="planned-card__coach" role="note">
                  <CoachAvatar size={24} className="planned-card__coach-face" />
                  <span>{coachPre}</span>
                </p>
              )}
              {rivalry && (
                <p className="planned-card__rivalry">
                  🔥 Onderling: {nameOf(rivalry.a)}{" "}
                  <strong>
                    {rivalry.winsA}–{rivalry.winsB}
                  </strong>{" "}
                  {nameOf(rivalry.b)}
                  {rivalry.draws > 0 ? ` (${rivalry.draws} gelijk)` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voet: links de ene primaire actie, rechts de uitklapper naar de rest.
          Welke actie primair is bepaalt matchState (#1144), niet een ternary
          hier — zo beloven kaart, detail en groepsronde hetzelfde.
          Agenda en ⋯ zitten in de kop, en de kop zegt al wanneer/waar. */}
      <div className="planned-card__foot planned-card__actions">
        {actieKnop && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={actieKnop.onClick}
          >
            {actieKnop.label}
          </button>
        )}
        <button
          type="button"
          className={`btn btn--sm${actieKnop ? " planned-card__meer" : " btn--primary"}`}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Inklappen" : meerLabel}
        </button>
      </div>

      {/* De uitslag zelf: één sheet, gedeeld met het matchdetail en de wizard.
          Alleen voor wie mag invullen; de rechten worden serverzijdig
          afgedwongen (#413, #978). */}
      {canScore && (
        <ScoreSheet
          open={scoreOpen}
          match={m}
          labelA={labelA}
          labelB={labelB}
          onClose={() => setScoreOpen(false)}
          onSave={save}
          ratingPreview={
            <RatingPreview
              mijnKans={mijnTeam != null ? mijnKans : null}
              staked={mijnLefOpDezeMatch}
              joker={mijnJoker}
            />
          }
        />
      )}

      {/* Eén beheermenu (#1144), gedeeld met het matchdetail. Tijd wijzigen
          klapt als paneel open; verwijderen valt meteen — met de undo-strook
          als vangnet. */}
      <MatchManagementSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        acties={[
          // Eigen poort, ruimer dan `canManage`: wie meespeelt of in de groep
          // zit mag de opstelling van een geplande wedstrijd rechtzetten.
          ...(rechten.magBezetting
            ? [
                {
                  sleutel: "spelers",
                  label: "Spelers wijzigen",
                  hint:
                    m.status === "completed"
                      ? "Zet recht wie er speelde; de ratings worden herberekend."
                      : "Vervang iemand, wissel van team of ruil met een andere baan.",
                  inhoud: (
                    <BezettingPaneel
                      match={m}
                      teams={teams}
                      profiles={profiles}
                      myId={myId ?? ""}
                      alsBeheerder={rechten.bezettingAlsBeheerder}
                      buurmatches={rondeMatches}
                      onSaved={() => onSaved?.()}
                      onKlaar={() => setManageOpen(false)}
                    />
                  ),
                },
              ]
            : []),
          {
            sleutel: "tijd",
            label: "Tijd wijzigen",
            hint: m.played_at
              ? "Verzet deze match naar een ander moment."
              : "Zet een starttijd; zonder tijd kan er geen lef of joker op.",
            inhoud: (
              <div className="planned-card__time">
                <input
                  className="input"
                  type="datetime-local"
                  value={timeVal}
                  onChange={(e) => setTimeVal(e.target.value)}
                  aria-label="Nieuw tijdstip"
                />
                <button
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    await saveTime();
                    setManageOpen(false);
                  }}
                  disabled={busyTime}
                >
                  {busyTime ? "Opslaan…" : "Tijd opslaan"}
                </button>
              </div>
            ),
          },
          {
            sleutel: "verwijderen",
            label: "Verwijderen",
            hint: "Je kunt dit nog even ongedaan maken.",
            gevaarlijk: true,
            onClick: startDelete,
          },
        ]}
      />
    </div>
  );
}

/** Uitkomst van de eigen lef-inzet, direct bij de zojuist opgeslagen uitslag.
 *  Leest de (gecachte) inzetten; zonder eigen inzet blijft de regel weg. */
function LefSavedLine({
  matchId,
  myId,
  mijnKans,
  draw,
  won,
}: {
  matchId: string;
  myId: string;
  mijnKans: number | null;
  draw: boolean;
  won: boolean;
}) {
  const stakes = useAsync(() => getMatchStakes(matchId), [matchId]);
  const mijn = stakes.data?.some((s) => s.player_id === myId) ?? false;
  if (!mijn) return null;
  // Zelfde belofte als de lef-tegel vóór de match: de verdubbelde mutatie.
  const swing = mijnKans != null ? stakeSwing(mijnKans, true) : null;
  return (
    <p className="planned-saved__line planned-saved__line--lef">
      <span aria-hidden="true">🎲</span>
      <span className="planned-saved__what">
        Lef — dubbel of niets:{" "}
        {draw ? "gelijkspel, inzet telt niet" : won ? "gewonnen" : "verloren"}
      </span>
      {!draw && swing && (
        <strong className={`planned-saved__amount ${won ? "is-up" : "is-down"}`}>
          {won ? `+${swing.winst}` : swing.verlies} Elo
        </strong>
      )}
    </p>
  );
}

/** Pil die markeert welk team de eerste opslag heeft (#435). Op team-niveau:
 *  het team kiest op de baan zelf wie van de twee serveert. */
function ServeChip({ teamName }: { teamName: string }) {
  return (
    <span
      className="servechip"
      role="img"
      title={`${teamName} begint met opslaan`}
      aria-label={`${teamName} begint met opslaan`}
    >
      <span aria-hidden="true">🎾</span>
      <span className="servechip__label">begint</span>
    </span>
  );
}

export default PlannedMatchCard;