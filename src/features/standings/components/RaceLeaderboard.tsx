import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { Link } from "react-router-dom";
import { BIG_DADDY_EMOJI } from "@/features/dashboard/bigDaddy";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { useFlip } from "@/lib/hooks/useFlip";
import { Avatar } from "@/ui/Avatar";
import { primeAvatarMorph, type Row } from "../leaderboardHelpers";
import {
  buildRaceTimeline,
  MAX_TIMELINE_DAYS,
  type RaceFrame,
} from "../raceTimeline";
import {
  calculateDivisionAxis,
  calculateRacePosition,
  detectRatingPacks,
  divisionCheckpoints,
  findCurrentUser,
  getNextDivision,
  packThresholds,
  raceGoal,
  raceSrSummary,
  rankShiftLabel,
  type DivisionAxis,
  type RacePack,
} from "../raceUtils";
import { RaceDetailSheet } from "./RaceDetailSheet";
import { RaceOverview } from "./RaceOverview";
import "./RaceLeaderboard.css";

type RaceStyle = CSSProperties & Record<`--${string}`, string | number>;

/** Een rij zoals hij op het getoonde moment stond: live is dat het klassement
 *  zelf, in de film komt alles uit één frame. `vorigeRating` tekent het spoor,
 *  `vorigeRang` de verschuiving van die speeldag, en `gedebuteerd` bepaalt of
 *  de speler toen al meedeed (anders staat hij gedimd op zijn startwaarde). */
type ToonRow = Row & {
  rating: number;
  vorigeRating: number;
  vorigeRang: number | null;
  gedebuteerd: boolean;
};

/** Interval van de afspeelknop; ruim boven de 700ms-marker-transitie. */
const SPEEL_INTERVAL_MS = 900;

export function RaceLeaderboard({
  rows,
  axisRows,
  timelineUit,
  meRef,
  onJumpToMe,
}: {
  rows: Row[];
  /** Het VOLLEDIGE veld (ongefilterd): hier hangen as en pack-drempels aan,
   *  zodat zoeken of filteren de baan niet onder je voeten verschuift. */
  axisRows: Row[];
  /** Waaróm er geen tijdlijn is (zoeken, gekozen periode), of null als hij mag.
   *  Eén bron: eerder verdween de hele bediening zonder een woord uitleg. */
  timelineUit: string | null;
  /** Anker op de eigen lane, voor de "Jouw positie"-chip (#1241). */
  meRef?: Ref<HTMLDivElement>;
  /** Spring-naar-mij vanaf de kijker-punt in de overzichtsstrook. */
  onJumpToMe?: () => void;
}) {
  const ratedRows = useMemo(
    () => rows.filter((row): row is Row & { rating: number } => row.rating != null),
    [rows],
  );
  // Handtekening van de film (#1254). Het klassement geeft bij elke render
  // nieuwe (inhoudelijk gelijke) rij-arrays door — scrollen alleen al zet state
  // in `useVerbergBijScrollen` (#942) — en daarmee bouwde de tijdlijn zich
  // telkens opnieuw op. Het afspelen viel dan terug naar de live stand. Deze
  // string verandert pas als de historie of het veld écht anders is.
  const timelineSig = useMemo(
    () =>
      ratedRows
        .map(
          (row) =>
            `${row.key}:${row.rating}:${row.history.length}:${row.history.at(-1)?.match_id ?? ""}`,
        )
        .join("|"),
    [ratedRows],
  );
  const timeline = useMemo(
    () => (timelineUit == null ? buildRaceTimeline(ratedRows) : null),
    // `ratedRows` staat er bewust niet bij: de handtekening hierboven dekt de
    // inhoud, de array-identiteit zegt niets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timelineUit, timelineSig],
  );
  const me = useMemo(() => findCurrentUser(axisRows), [axisRows]);
  const axis = useMemo(() => {
    const values = axisRows
      .map((row) => row.rating)
      .filter((rating): rating is number => rating != null);
    // Historische tijdlijnposities voeden de as bewust niet: die klemmen op
    // de rand, zodat de as niet verspringt zodra je gaat scrubben.
    return calculateDivisionAxis(values, me?.rating ?? null);
  }, [axisRows, me]);
  const checkpoints = useMemo(() => divisionCheckpoints(axis), [axis]);
  const packs = useMemo(() => {
    const drempels = packThresholds(
      axisRows
        .map((row) => row.rating)
        .filter((rating): rating is number => rating != null),
    );
    return detectRatingPacks(ratedRows, drempels.neighborGap, drempels.maxSpread);
  }, [axisRows, ratedRows]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const tijdlijnRef = useRef<HTMLDivElement | null>(null);

  // null = live (het laatste frame); een getal = de kijker scrubt of speelt af.
  const [frameIdx, setFrameIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  const laatste = timeline ? timeline.frames.length - 1 : 0;
  const shownIdx = Math.min(frameIdx ?? laatste, laatste);
  const frame = timeline?.frames[shownIdx] ?? null;
  // Het vorige frame tekent het spoor — in de live stand is dat de laatste
  // speeldag, zodat de richting ook in rust zichtbaar is.
  const vorigFrame = timeline && shownIdx > 0 ? timeline.frames[shownIdx - 1] : null;
  // De kijker zit ín de film zodra hij stapt, scrubt of afspeelt — óók op het
  // slotframe (#1254). Dat was eerder `shownIdx < laatste`, waardoor de film op
  // het eind terugklapte naar de live waarden: rangen en het dimmen van wie nog
  // niet gedebuteerd was vielen in één tik weg. Nu landt hij.
  const frameView = timeline != null && frame != null && frameIdx != null;

  // Terug naar live zodra er een ándere film is: een nieuwe uitslag, een ander
  // seizoen, een andere groep. Bewust aan de handtekening en niet aan het
  // `timeline`-object: `useMemo` is een optimalisatie, geen garantie, en dit
  // effect mag de kijker nooit onderbreken om een identiteitswissel.
  useEffect(() => {
    setFrameIdx(null);
    setPlaying(false);
  }, [timelineSig, timelineUit]);

  useEffect(() => {
    if (!playing || !timeline) return;
    const id = window.setInterval(() => {
      setFrameIdx((huidig) => Math.min((huidig ?? 0) + 1, timeline.frames.length - 1));
    }, SPEEL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, timeline]);

  useEffect(() => {
    if (playing && timeline && frameIdx != null && frameIdx >= timeline.frames.length - 1) {
      setPlaying(false);
    }
  }, [playing, timeline, frameIdx]);

  // Afspelen heeft geen zin als niemand kijkt: een verborgen tabblad, of een
  // baan die helemaal uit beeld is gescrold. Scrollen bínnen de baan speelt
  // gewoon door — dat is juist het moment waarop je kijkt.
  useEffect(() => {
    if (!playing) return;
    const stop = () => setPlaying(false);
    const bijZichtbaarheid = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", bijZichtbaarheid);
    const board = boardRef.current;
    // Ontbreekt IntersectionObserver (jsdom, oudere webviews), dan blijft het
    // afspelen gewoon doorlopen — stil niets doen is hier het veilige gedrag.
    const kijker =
      board && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) stop();
          })
        : null;
    if (board) kijker?.observe(board);
    return () => {
      document.removeEventListener("visibilitychange", bijZichtbaarheid);
      kijker?.disconnect();
    };
  }, [playing]);

  // De as en de divisiepoorten plakken onder de bediening; hoe hoog die is
  // hangt aan de tekst erin ("Speeldag 12 september · stand 3 van 8" wikkelt op
  // een smal scherm), dus meten in plaats van een vaste waarde in CSS.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const balk = tijdlijnRef.current;
    if (!balk) {
      board.style.removeProperty("--race-tijdlijn-h");
      return;
    }
    const meet = () => board.style.setProperty("--race-tijdlijn-h", `${balk.offsetHeight}px`);
    meet();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(meet);
    ro.observe(balk);
    return () => ro.disconnect();
  }, [timeline]);

  // Eén lijst die het getoonde moment beschrijft (#1254). Eerder haalde elke
  // lane zijn rating uit het frame maar zijn rang, volgorde en verschuiving uit
  // de live stand — dan zegt de baan "Gevecht om #4–#6" op grond van vandaag
  // terwijl je zes speeldagen terugkijkt. Nu komt alles uit dezelfde bron.
  const toonRows: ToonRow[] = useMemo(() => {
    const maak = (row: Row & { rating: number }): ToonRow => {
      const rating = frameView ? (frame.ratings.get(row.key) ?? row.rating) : row.rating;
      return {
        ...row,
        rating,
        rank: frameView ? (frame.ranks.get(row.key) ?? row.rank ?? 0) : row.rank,
        // In de film vertelt de verschuiving wat er díe speeldag gebeurde; de
        // live `shift` (van de laatste speeldag) hoort daar niet bij.
        shift: frameView ? undefined : row.shift,
        vorigeRating: vorigFrame?.ratings.get(row.key) ?? rating,
        vorigeRang: frameView ? (vorigFrame?.ranks.get(row.key) ?? null) : null,
        gedebuteerd: frameView ? frame.debuted.has(row.key) : true,
      };
    };
    const rijen = ratedRows.map(maak);
    // Alleen in de film herschikken: live houdt de baan de volgorde van het
    // klassement zelf aan (inclusief wat de troon eruit haalt).
    return frameView
      ? rijen.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      : rijen;
  }, [ratedRows, frameView, frame, vorigFrame]);

  const toonPacks = useMemo(() => {
    if (!frameView) return packs;
    const drempels = packThresholds(
      axisRows
        .map((row) => row.rating)
        .filter((rating): rating is number => rating != null),
    );
    return detectRatingPacks(toonRows, drempels.neighborGap, drempels.maxSpread);
  }, [frameView, packs, axisRows, toonRows]);

  // De banen glijden naar hun nieuwe plek zodra de volgorde wisselt, net als in
  // de tabel en de ranglijst. Zonder dit sprong alleen het rangnummer om en
  // bleef de baan staan waar hij stond.
  const lanesRef = useFlip<HTMLDivElement>(toonRows.map((row) => row.key).join("|"));

  if (ratedRows.length === 0) {
    return <p className="empty">Geen spelers met een rating om in de race te tonen.</p>;
  }

  const kiesFrame = (idx: number) => {
    setPlaying(false);
    setFrameIdx(idx);
  };
  const toggleSpelen = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (shownIdx >= laatste) setFrameIdx(0);
    setPlaying(true);
  };

  const riser = frameIdx != null && shownIdx > 0 ? (frame?.riser ?? null) : null;
  const riserRow = riser ? ratedRows.find((row) => row.key === riser.key) : null;

  // De divisiepoort waar de kijker naartoe rijdt, voor het accent op de eigen lane.
  const doelVanaf =
    me?.rating != null ? (getNextDivision(me.rating)?.volgende?.vanaf ?? null) : null;

  const selectedRow =
    ratedRows.find((row) => row.key === openPlayer) ?? null;
  const selectedPack = selectedRow
    ? (packs.find((pack) =>
        pack.rows.some((row) => row.key === selectedRow.key),
      ) ?? null)
    : null;

  return (
    <div className="race-board" ref={boardRef}>
      <RaceHeader rows={axisRows} packs={packs} />

      {/* Bewust een eigen balk onder de kop en niet ín de kop: alleen als
          directe zoon van de baan kan hij over de volle hoogte blijven plakken
          (#1254). Anders scrolde de dagaanduiding weg juist terwijl je langs de
          banen keek, en was er geen pauzeknop meer in beeld. */}
      {timeline ? (
        <RaceTijdlijn
          balkRef={tijdlijnRef}
          frames={timeline.frames}
          shownIdx={shownIdx}
          playing={playing}
          onKies={kiesFrame}
          onSpeel={toggleSpelen}
        />
      ) : (
        timelineUit && <p className="race-tijdlijn__uit">{timelineUit}</p>
      )}

      {/* De strook is decor; dit is hetzelfde verhaal voor schermlezers. */}
      <p className="sr-only">{raceSrSummary(axisRows, checkpoints)}</p>

      <div
        className="race-board__course"
        style={{ "--race-intervals": axis.ticks.length - 1 } as RaceStyle}
      >
        <RaceOverview
          rows={axisRows}
          axis={axis}
          checkpoints={checkpoints}
          onJumpToMe={onJumpToMe}
        />
        <RaceAxis axis={axis} />
        <DivisionCheckpointLabels axis={axis} checkpoints={checkpoints} />
        {riser && riserRow && (
          <p className="race-tijdlijn__verhaal" aria-live={playing ? "off" : "polite"}>
            <span aria-hidden="true">📈</span> {riserRow.name} klimt van #{riser.from}{" "}
            naar #{riser.to}
          </p>
        )}
        <div
          className="race-board__lanes"
          role="list"
          aria-label="Raceklassement"
          ref={lanesRef}
        >
          {renderLanes({
            rows: toonRows,
            packs: toonPacks,
            axis,
            checkpoints,
            doelVanaf,
            onOpenPlayer: setOpenPlayer,
            meRef,
          })}
        </div>
      </div>

      <RaceDetailSheet
        row={selectedRow}
        pack={selectedPack}
        onClose={() => setOpenPlayer(null)}
      />

      {rows.length > ratedRows.length && (
        <p className="race-board__unrated">
          {rows.length - ratedRows.length} {rows.length - ratedRows.length === 1 ? "speler heeft" : "spelers hebben"} nog geen rating en staat daarom niet op de baan.
        </p>
      )}
    </div>
  );
}

function RaceHeader({ rows, packs }: { rows: Row[]; packs: RacePack[] }) {
  const me = findCurrentUser(rows);
  const goal =
    me?.rating != null ? raceGoal(me as Row & { rating: number }, rows) : null;
  const myPack = me ? packs.find((pack) => pack.rows.some((row) => row.key === me.key)) : null;

  return (
    <div className="race-board__head">
      {me?.rating != null && goal ? (
        <aside className="race-summary" aria-label="Jouw racepositie">
          <span className="race-summary__eyebrow">Jouw doel</span>
          <strong className="race-summary__kop">{goal.kop}</strong>
          {goal.sub && <span className="race-summary__sub">{goal.sub}</span>}
          <span className="race-summary__feiten">
            <span className="race-summary__position">#{me.rank}</span>
            <span className="race-summary__rating">{me.rating} rating</span>
            <TierBadge rating={me.rating} size="sm" capDictator />
          </span>
          {myPack && <span className="badge badge--accent">Jouw gevecht · #{myPack.startRank}–#{myPack.endRank}</span>}
        </aside>
      ) : (
        <div className="race-board__intro">
          <strong>De race om de toppositie</strong>
          <span>Elke marker staat op zijn echte rating.</span>
        </div>
      )}
    </div>
  );
}

function RaceTijdlijn({
  balkRef,
  frames,
  shownIdx,
  playing,
  onKies,
  onSpeel,
}: {
  balkRef: Ref<HTMLDivElement>;
  frames: RaceFrame[];
  shownIdx: number;
  playing: boolean;
  onKies: (idx: number) => void;
  onSpeel: () => void;
}) {
  const laatste = frames.length - 1;
  const frame = frames[shownIdx];
  const label = frame.day ? `Speeldag ${formatDay(frame.day)}` : "Startstand";
  // De scrubber suggereert "het hele verhaal", maar de film is begrensd. Dat
  // zeggen we alleen als de grens ook echt knelt (#1254).
  const geknipt = laatste >= MAX_TIMELINE_DAYS;

  return (
    <div className="race-tijdlijn" ref={balkRef}>
      <div className="race-tijdlijn__knoppen">
        <button
          type="button"
          className="btn btn--sm"
          aria-label="Vorige speeldag"
          onClick={() => onKies(Math.max(0, shownIdx - 1))}
          disabled={shownIdx === 0}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <input
          type="range"
          className="race-tijdlijn__scrubber"
          min={0}
          max={laatste}
          step={1}
          value={shownIdx}
          aria-label="Tijdlijn van speeldagen"
          aria-valuetext={label}
          onChange={(e) => onKies(Number(e.currentTarget.value))}
        />
        <button
          type="button"
          className="btn btn--sm"
          aria-label="Volgende speeldag"
          onClick={() => onKies(Math.min(laatste, shownIdx + 1))}
          disabled={shownIdx === laatste}
        >
          <span aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          className="btn btn--sm race-tijdlijn__speel"
          onClick={onSpeel}
        >
          <span aria-hidden="true">{playing ? "⏸" : "▶"}</span>{" "}
          {playing ? "Pauzeer" : "Speel af"}
        </button>
      </div>
      {/* Tijdens het afspelen wisselt dit elke 900ms; een schermlezer zou dan
          onafgebroken door de film heen praten. De stand wordt gemeld zodra de
          film stilstaat — bij pauze, bij het einde, en na elke stap of scrub. */}
      <span className="race-tijdlijn__status" aria-live={playing ? "off" : "polite"}>
        {shownIdx === laatste && !playing
          ? "Na de laatste speeldag"
          : `${label} · stand ${shownIdx + 1} van ${frames.length}`}
        {geknipt && (
          <span className="race-tijdlijn__bereik">
            {" "}
            · laatste {MAX_TIMELINE_DAYS} speeldagen
          </span>
        )}
      </span>
    </div>
  );
}

function RaceAxis({ axis }: { axis: DivisionAxis }) {
  return (
    <div className="race-axis" aria-label={`Rating-as van ${axis.min} tot ${axis.max}`}>
      <span className="race-axis__spacer" aria-hidden="true" />
      <div className="race-axis__track" aria-hidden="true">
        {axis.ticks.map((tick) => (
          <span
            className="race-axis__tick"
            key={tick}
            style={{ "--race-x": `${calculateRacePosition(tick, axis)}%` } as RaceStyle}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

function DivisionCheckpointLabels({
  axis,
  checkpoints,
}: {
  axis: DivisionAxis;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
}) {
  return (
    <div className="race-divisions" role="list" aria-label="Divisiecheckpoints">
      <span className="race-axis__spacer" aria-hidden="true" />
      <div className="race-divisions__track">
        {checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.naam}
            role="listitem"
            className={`race-checkpoint-label tier-badge--${checkpoint.key}`}
            style={{ "--race-x": `${calculateRacePosition(checkpoint.min, axis)}%` } as RaceStyle}
            title={`${checkpoint.naam} vanaf ${checkpoint.min} rating`}
          >
            <span aria-hidden="true">{checkpoint.emoji}</span>
            {/* De zichtbare naam verdwijnt op mobiel; de sr-tekst benoemt de
                poort altijd volledig (en maar één keer). */}
            <span className="race-checkpoint-label__name" aria-hidden="true">
              {checkpoint.naam}
            </span>
            <span className="sr-only">
              {checkpoint.naam} vanaf {checkpoint.min} rating
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function renderLanes({
  rows,
  packs,
  ...laneProps
}: {
  rows: ToonRow[];
  packs: RacePack[];
  axis: DivisionAxis;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
  doelVanaf: number | null;
  onOpenPlayer: (key: string | null) => void;
  meRef?: Ref<HTMLDivElement>;
}) {
  const firstToPack = new Map(packs.map((pack) => [pack.rows[0].key, pack]));
  const packedKeys = new Set(packs.flatMap((pack) => pack.rows.map((row) => row.key)));
  const rendered: React.ReactNode[] = [];

  for (const row of rows) {
    const pack = firstToPack.get(row.key);
    if (pack) {
      rendered.push(
        <section
          className={`race-pack${pack.includesCurrentUser ? " is-mine" : ""}`}
          role="group"
          aria-label={`${pack.includesCurrentUser ? "Jouw gevecht" : "Gevecht"} om plaats ${pack.startRank} tot ${pack.endRank}`}
          key={pack.id}
        >
          <div className="race-pack__label">
            <span aria-hidden="true">⚔</span>
            <span>{pack.includesCurrentUser ? "Jouw gevecht" : "Gevecht"} om plaats #{pack.startRank}–#{pack.endRank}</span>
            <span className="race-pack__spread">{pack.rows.length} spelers binnen {pack.spread} rating</span>
          </div>
          {pack.rows.map((member) => (
            <RaceLane key={member.key} row={member as ToonRow} {...laneProps} />
          ))}
        </section>,
      );
    } else if (!packedKeys.has(row.key)) {
      rendered.push(<RaceLane key={row.key} row={row} {...laneProps} />);
    }
  }
  return rendered;
}

function RaceLane({
  row,
  axis,
  checkpoints,
  doelVanaf,
  onOpenPlayer,
  meRef,
}: {
  row: ToonRow;
  axis: DivisionAxis;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
  doelVanaf: number | null;
  onOpenPlayer: (key: string | null) => void;
  meRef?: Ref<HTMLDivElement>;
}) {
  const shownRating = row.rating;
  const shownRank = row.rank ?? 0;
  const x = calculateRacePosition(shownRating, axis);
  const prevX = calculateRacePosition(row.vorigeRating, axis);
  // Buiten de (aan het veld verankerde) as geknipt: klem op de rand, maar
  // toon het echte getal met een richtingpijl.
  const offAxis =
    shownRating < axis.min ? "onder" : shownRating > axis.max ? "boven" : null;
  // Live valt dit terug op `row.shift`; in de film op de rangwissel van die dag.
  const shiftLabel = rankShiftLabel(row, row.vorigeRang);
  const laneStyle = {
    "--race-x": `${x}%`,
    "--race-rating-x": x,
    "--race-spoor-links": `${Math.min(x, prevX)}%`,
    "--race-spoor-breedte": `${Math.abs(x - prevX)}%`,
  } as RaceStyle;

  return (
    <div
      className={`race-lane${row.isMe ? " is-me" : ""}${shownRank === 1 ? " is-leader" : ""}${row.gedebuteerd ? "" : " is-voor-debuut"}`}
      role="listitem"
      data-flip-key={row.key}
      data-rank={shownRank}
      style={laneStyle}
      ref={row.isMe ? meRef : undefined}
    >
      <div className="race-lane__identity">
        <span className={`rank rank--${shownRank}`}>{shownRank}</span>
        {row.link ? (
          <Link to={row.link} viewTransition onClick={primeAvatarMorph} aria-label={`Profiel van ${row.name}`}>
            <Avatar profile={row.profile} name={row.name} size={32} />
          </Link>
        ) : (
          <Avatar profile={row.profile} name={row.name} size={32} />
        )}
        <span className="race-lane__name-wrap">
          {row.link ? (
            <Link className="profile-link race-lane__name" to={row.link} viewTransition onClick={primeAvatarMorph}>
              {row.name}
            </Link>
          ) : (
            <span className="race-lane__name">{row.name}</span>
          )}
          <span className="race-lane__meta">
            {row.isMe && <span className="badge badge--accent">jij</span>}
            {shownRank === 1 && <span className="race-lane__leader" title="Leider">{BIG_DADDY_EMOJI}<span className="sr-only">Leider</span></span>}
            {shiftLabel && (
              <span
                className={`rankshift ${
                  row.shift === "nieuw"
                    ? "rankshift--new"
                    : typeof row.shift === "number" && row.shift < 0
                      ? "is-down"
                      : "is-up"
                }`}
              >
                {shiftLabel}
              </span>
            )}
          </span>
        </span>
      </div>

      <div className="race-lane__track" aria-label={`${row.name}: ${shownRating} rating`}>
        <span className="race-lane__grid" aria-hidden="true" />
        {checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.naam}
            className={`race-lane__checkpoint tier-badge--${checkpoint.key}${
              row.isMe && doelVanaf === checkpoint.min ? " is-doel" : ""
            }`}
            style={{ "--race-x": `${calculateRacePosition(checkpoint.min, axis)}%` } as RaceStyle}
            aria-hidden="true"
          />
        ))}
        <span className="race-lane__progress" aria-hidden="true" />
        {x !== prevX && (
          <span
            className={`race-lane__spoor${x >= prevX ? " is-op" : " is-neer"}`}
            aria-hidden="true"
          />
        )}
        <span
          className={`race-lane__marker${x > 82 ? " is-near-end" : ""}${
            offAxis ? " is-off-axis" : ""
          }`}
        >
          {row.link ? (
            <Link
              className="race-lane__marker-link"
              to={row.link}
              viewTransition
              onClick={primeAvatarMorph}
              aria-label={`${row.name}, ${shownRating} rating — profiel bekijken`}
            >
              <Avatar profile={row.profile} name={row.name} size={shownRank === 1 ? 36 : 30} />
            </Link>
          ) : (
            <Avatar profile={row.profile} name={row.name} size={30} />
          )}
          <span className="race-lane__rating">
            {offAxis === "onder" && <span aria-hidden="true">‹&#8202;</span>}
            {shownRating}
            {offAxis === "boven" && <span aria-hidden="true">&#8202;›</span>}
          </span>
        </span>
        <button
          type="button"
          className="race-lane__info"
          aria-label={`Details van ${row.name}`}
          aria-haspopup="dialog"
          onClick={() => onOpenPlayer(row.key)}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}

function formatDay(isoDay: string): string {
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long" }).format(
    new Date(`${isoDay}T12:00:00`),
  );
}
