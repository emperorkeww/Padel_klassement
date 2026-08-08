import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { BIG_DADDY_EMOJI } from "@/features/dashboard/bigDaddy";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { tierFor } from "@/features/rating/tiers";
import { Avatar } from "@/ui/Avatar";
import { useToast } from "@/ui/ToastProvider";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { primeAvatarMorph, type Row } from "../leaderboardHelpers";
import {
  buildRaceReplay,
  calculateAxisRange,
  calculateRacePosition,
  detectRatingPacks,
  divisionCheckpoints,
  findCurrentUser,
  getNearestCompetitors,
  getNextDivision,
  type RaceAxisRange,
  type RacePack,
  type RaceReplay,
} from "../raceUtils";
import "./RaceLeaderboard.css";

type RaceStyle = CSSProperties & Record<`--${string}`, string | number>;
type ReplayPhase = "idle" | "before" | "moving" | "done";

export function RaceLeaderboard({
  rows,
  allowReplay,
}: {
  rows: Row[];
  allowReplay: boolean;
}) {
  const toast = useToast();
  const ratedRows = useMemo(
    () => rows.filter((row): row is Row & { rating: number } => row.rating != null),
    [rows],
  );
  const replay = useMemo(
    () => (allowReplay ? buildRaceReplay(ratedRows) : null),
    [allowReplay, ratedRows],
  );
  const axis = useMemo(() => {
    const values = ratedRows.map((row) => row.rating);
    if (replay) {
      for (const player of replay.players.values()) values.push(player.previousRating);
    }
    return calculateAxisRange(values);
  }, [ratedRows, replay]);
  const checkpoints = useMemo(() => divisionCheckpoints(axis), [axis]);
  const packs = useMemo(() => detectRatingPacks(ratedRows), [ratedRows]);
  const [phase, setPhase] = useState<ReplayPhase>("idle");
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setPhase("idle");
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    };
  }, [replay]);

  const playReplay = () => {
    if (!replay) return;
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    if (prefersReducedMotion()) {
      setPhase("done");
      if (replay.event) toast.info(replay.event);
      return;
    }
    setPhase("before");
    timers.current.push(
      window.setTimeout(() => setPhase("moving"), 550),
      window.setTimeout(() => {
        setPhase("done");
        if (replay.event) toast.info(replay.event);
      }, 1400),
    );
  };

  if (ratedRows.length === 0) {
    return <p className="empty">Geen spelers met een rating om in de race te tonen.</p>;
  }

  const playerPosition = (row: Row & { rating: number }) => {
    const replayPlayer = replay?.players.get(row.key);
    return phase === "before" && replayPlayer
      ? replayPlayer.previousRating
      : row.rating;
  };

  return (
    <div className={`race-board${phase === "moving" ? " is-moving" : ""}`}>
      <RaceHeader rows={ratedRows} packs={packs} replay={replay} phase={phase} onReplay={playReplay} />

      <div
        className="race-board__course"
        style={{ "--race-intervals": axis.ticks.length - 1 } as RaceStyle}
      >
        <RaceAxis axis={axis} />
        <DivisionCheckpointLabels axis={axis} checkpoints={checkpoints} />
        <div className="race-board__lanes" role="list" aria-label="Raceklassement">
          {renderLanes({
            rows: ratedRows,
            packs,
            axis,
            replay,
            phase,
            checkpoints,
            openPlayer,
            onOpenPlayer: setOpenPlayer,
            playerPosition,
          })}
        </div>
      </div>

      {rows.length > ratedRows.length && (
        <p className="race-board__unrated">
          {rows.length - ratedRows.length} {rows.length - ratedRows.length === 1 ? "speler heeft" : "spelers hebben"} nog geen rating en staat daarom niet op de baan.
        </p>
      )}
    </div>
  );
}

function RaceHeader({
  rows,
  packs,
  replay,
  phase,
  onReplay,
}: {
  rows: Row[];
  packs: RacePack[];
  replay: RaceReplay | null;
  phase: ReplayPhase;
  onReplay: () => void;
}) {
  const me = findCurrentUser(rows);
  const next = getNextDivision(me?.rating ?? null);
  const nearest = me ? getNearestCompetitors(rows, me.key) : null;
  const myPack = me ? packs.find((pack) => pack.rows.some((row) => row.key === me.key)) : null;

  return (
    <div className="race-board__head">
      {me?.rating != null ? (
        <aside className="race-summary" aria-label="Jouw racepositie">
          <span className="race-summary__eyebrow">Jouw positie</span>
          <span className="race-summary__position">#{me.rank}</span>
          <span className="race-summary__rating">{me.rating} rating</span>
          <TierBadge rating={me.rating} size="sm" capDictator />
          <span className="race-summary__goal">
            {nearest?.above
              ? `${nearest.above.gap} rating achter ${nearest.above.row.name}`
              : "Je leidt het klassement"}
          </span>
          {next?.volgende && (
            <span className="race-summary__goal">
              {next.puntenNodig} rating tot {next.volgende.naam}
            </span>
          )}
          {myPack && <span className="badge badge--accent">Jouw gevecht · #{myPack.startRank}–#{myPack.endRank}</span>}
        </aside>
      ) : (
        <div className="race-board__intro">
          <strong>De race om de toppositie</strong>
          <span>Elke marker staat op zijn echte rating.</span>
        </div>
      )}

      {replay && (
        <div className="race-replay">
          <button
            type="button"
            className="btn btn--sm race-replay__button"
            onClick={onReplay}
            disabled={phase === "before" || phase === "moving"}
          >
            <span aria-hidden="true">{phase === "done" ? "↻" : "▶"}</span>
            {phase === "done"
              ? "Opnieuw bekijken"
              : phase === "before"
                ? "Vorige stand…"
                : phase === "moving"
                  ? "In beweging…"
                  : "Bekijk verschuivingen"}
          </button>
          <span className="race-replay__status" aria-live="polite">
            {phase === "before"
              ? `Stand vóór ${formatDay(replay.day)}`
              : phase === "moving"
                ? "Nieuwe stand wordt zichtbaar"
                : "Na de laatste speeldag"}
          </span>
        </div>
      )}
    </div>
  );
}

function RaceAxis({ axis }: { axis: RaceAxisRange }) {
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
  axis: RaceAxisRange;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
}) {
  return (
    <div className="race-divisions" aria-label="Divisiecheckpoints">
      <span className="race-axis__spacer" aria-hidden="true" />
      <div className="race-divisions__track">
        {checkpoints.map((checkpoint) => (
          <span
            key={checkpoint.key}
            className={`race-checkpoint-label tier-badge--${checkpoint.key}`}
            style={{ "--race-x": `${calculateRacePosition(checkpoint.min, axis)}%` } as RaceStyle}
            title={`${checkpoint.naam} vanaf ${checkpoint.min} rating`}
          >
            <span aria-hidden="true">{checkpoint.emoji}</span>
            <span className="race-checkpoint-label__name">{checkpoint.naam}</span>
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
  rows: (Row & { rating: number })[];
  packs: RacePack[];
  axis: RaceAxisRange;
  replay: RaceReplay | null;
  phase: ReplayPhase;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
  openPlayer: string | null;
  onOpenPlayer: (key: string | null) => void;
  playerPosition: (row: Row & { rating: number }) => number;
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
            <RaceLane key={member.key} row={member as Row & { rating: number }} pack={pack} {...laneProps} />
          ))}
        </section>,
      );
    } else if (!packedKeys.has(row.key)) {
      rendered.push(<RaceLane key={row.key} row={row} pack={null} {...laneProps} />);
    }
  }
  return rendered;
}

function RaceLane({
  row,
  pack,
  axis,
  replay,
  phase,
  checkpoints,
  openPlayer,
  onOpenPlayer,
  playerPosition,
}: {
  row: Row & { rating: number };
  pack: RacePack | null;
  axis: RaceAxisRange;
  replay: RaceReplay | null;
  phase: ReplayPhase;
  checkpoints: ReturnType<typeof divisionCheckpoints>;
  openPlayer: string | null;
  onOpenPlayer: (key: string | null) => void;
  playerPosition: (row: Row & { rating: number }) => number;
}) {
  const replayPlayer = replay?.players.get(row.key);
  const shownRating = playerPosition(row);
  const shownRank =
    phase === "before" && replayPlayer?.previousRank != null
      ? replayPlayer.previousRank
      : (row.rank ?? 0);
  const x = calculateRacePosition(shownRating, axis);
  const tier = tierFor(row.rating);
  const latestDay = row.history.map((point) => point.played_at.slice(0, 10)).sort().at(-1);
  const dayDelta = latestDay
    ? row.history
        .filter((point) => point.played_at.slice(0, 10) === latestDay)
        .reduce((sum, point) => sum + point.delta, 0)
    : null;
  const competitorAbove = getNearestCompetitors(
    pack?.rows ?? [row],
    row.key,
  ).above;
  const shiftLabel = rankShiftLabel(row, replayPlayer?.previousRank ?? null);
  const previousRank =
    replayPlayer?.previousRank ??
    (typeof row.shift === "number" && row.rank != null ? row.rank + row.shift : null);
  const tooltipId = `race-tip-${row.key}`;
  const open = openPlayer === row.key;
  const laneStyle = {
    "--race-x": `${x}%`,
    "--race-rating-x": x,
  } as RaceStyle;

  return (
    <div
      className={`race-lane${row.isMe ? " is-me" : ""}${(row.rank ?? 0) === 1 ? " is-leader" : ""}${open ? " is-open" : ""}`}
      role="listitem"
      data-flip-key={row.key}
      data-rank={shownRank}
      style={laneStyle}
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
            {(row.rank ?? 0) === 1 && <span className="race-lane__leader" title="Leider">{BIG_DADDY_EMOJI}<span className="sr-only">Leider</span></span>}
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
            key={checkpoint.key}
            className={`race-lane__checkpoint tier-badge--${checkpoint.key}`}
            style={{ "--race-x": `${calculateRacePosition(checkpoint.min, axis)}%` } as RaceStyle}
            aria-hidden="true"
          />
        ))}
        <span className="race-lane__progress" aria-hidden="true" />
        <span className={`race-lane__marker${x > 82 ? " is-near-end" : ""}`}>
          {row.link ? (
            <Link
              className="race-lane__marker-link"
              to={row.link}
              viewTransition
              onClick={primeAvatarMorph}
              aria-label={`${row.name}, ${shownRating} rating — profiel bekijken`}
            >
              <Avatar profile={row.profile} name={row.name} size={(row.rank ?? 0) === 1 ? 40 : 36} />
            </Link>
          ) : (
            <Avatar profile={row.profile} name={row.name} size={36} />
          )}
          <span className="race-lane__rating">{shownRating}</span>
        </span>
        <button
          type="button"
          className="race-lane__info"
          aria-label={`Details van ${row.name}`}
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => onOpenPlayer(open ? null : row.key)}
        >
          i
        </button>
        <div className="race-lane__tooltip" role="tooltip" id={tooltipId}>
          <strong>{row.name}</strong>
          <span>#{row.rank} · {row.rating} rating</span>
          {tier && <span>{tier.emoji} {tier.label}</span>}
          {dayDelta != null && dayDelta !== 0 && <span>{dayDelta > 0 ? "+" : ""}{dayDelta} laatste speeldag</span>}
          {shiftLabel && (
            <span>
              {previousRank != null && row.rank != null
                ? `Van #${previousRank} naar #${row.rank} sinds vorige speeldag`
                : `${shiftLabel} sinds vorige speeldag`}
            </span>
          )}
          {competitorAbove && <span>{competitorAbove.gap} rating achter {competitorAbove.row.name}</span>}
          {pack && (
            <span className="race-lane__pack-gaps">
              {pack.rows
                .filter((competitor) => competitor.key !== row.key && competitor.rating != null)
                .map((competitor) => `${Math.abs(row.rating - (competitor.rating ?? row.rating))} t.o.v. ${competitor.name}`)
                .join(" · ")}
            </span>
          )}
          {row.form.length > 0 && <span>Vorm: {row.form.join(" · ")}</span>}
        </div>
      </div>
    </div>
  );
}

function rankShiftLabel(row: Row, previousRank: number | null): string | null {
  if (row.shift === "nieuw") return "nieuw";
  if (typeof row.shift === "number" && row.shift !== 0) {
    return row.shift > 0 ? `▲${row.shift}` : `▼${-row.shift}`;
  }
  if (previousRank != null && row.rank != null && previousRank !== row.rank) {
    const delta = previousRank - row.rank;
    return delta > 0 ? `▲${delta}` : `▼${-delta}`;
  }
  return null;
}

function formatDay(isoDay: string): string {
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long" }).format(
    new Date(`${isoDay}T12:00:00`),
  );
}
