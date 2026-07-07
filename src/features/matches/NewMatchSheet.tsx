import { useEffect, useRef, useState } from "react";
import { ScoreStepper } from "../../components/ScoreStepper";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { Avatar } from "../../components/Avatar";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { tap, winPulse } from "../../lib/haptics";
import { displayName } from "../profiles/api";
import {
  createCompletedMatch,
  createGuestPlayer,
  createPlannedMatch,
  emptySet,
  toSetScores,
  type SetPair,
} from "./api";
import { SetScoresInput } from "./SetScoresInput";
import type { Profile } from "../../lib/types";

export type NewMatchMode = "score" | "plan";

/** Match loggen of plannen in twee stappen: spelers aantikken, dan de
 *  eindscore ("score") of het tijdstip ("plan"). Een geplande match komt in
 *  "Te spelen" te staan, met inline score-invoer voor na afloop.
 *  Op mobiel een bottom sheet, op desktop een gecentreerde dialoog. */
export function NewMatchSheet({
  open,
  players,
  mode = "score",
  onClose,
  onCreated,
  onGuestCreated,
}: {
  open: boolean;
  players: Profile[];
  mode?: NewMatchMode;
  onClose: () => void;
  onCreated: () => void;
  /** Aangeroepen nadat een gastspeler is aangemaakt, zodat de ouder zijn
   *  spelerslijst kan verversen. */
  onGuestCreated?: () => void;
}) {
  // Expliciete team-indeling: twee aparte lijstjes i.p.v. "eerste twee = A".
  // Aantikken vult team A, dan team B; in de teamzones kun je spelers wisselen.
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [showSets, setShowSets] = useState(false);
  const [sets, setSets] = useState<SetPair[]>([emptySet()]);
  const [when, setWhen] = useState(""); // datetime-local; "" = zonder tijdstip
  const [repeat, setRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  // Gasten die tijdens deze sessie zijn aangemaakt (meteen kiesbaar).
  const [extraGuests, setExtraGuests] = useState<Profile[]>([]);
  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Vers beginnen bij elk openen.
  useEffect(() => {
    if (open) {
      setTeamA([]);
      setTeamB([]);
      setStep(1);
      setQuery("");
      setScoreA("");
      setScoreB("");
      setShowSets(false);
      setSets([emptySet()]);
      setWhen("");
      setRepeat(false);
      setRepeatWeeks(4);
      setExtraGuests([]);
      setGuestName("");
      setAddingGuest(false);
    }
  }, [open]);

  // Focus in de dialoog bij openen; terug naar de opener bij sluiten.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  // Escape sluit; de pagina eronder scrollt niet mee.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Kiesbare spelers = de van buiten meegegeven lijst plus de gasten die je
  // net in deze sessie aanmaakte (ontdubbeld op id).
  const allPlayers: Profile[] = [
    ...players,
    ...extraGuests.filter((g) => !players.some((p) => p.id === g.id)),
  ];
  const isGuest = (p: Profile | undefined) =>
    !!(p as { is_guest?: boolean } | undefined)?.is_guest;

  const picked = teamA.length + teamB.length;
  const full = teamA.length === 2 && teamB.length === 2;
  const byId = (id: string) => allPlayers.find((p) => p.id === id);
  const nameOf = (id: string) => displayName(byId(id));
  const teamOf = (id: string): "a" | "b" | null =>
    teamA.includes(id) ? "a" : teamB.includes(id) ? "b" : null;

  // Bij een lange spelerslijst is zoeken sneller dan scrollen.
  const searchable = allPlayers.length > 8;
  const visiblePlayers = searchable
    ? allPlayers.filter((p) =>
        displayName(p).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : allPlayers;

  /** Voegt een gast toe (naam-only) en selecteert hem meteen in een team. */
  async function addGuest() {
    const naam = guestName.trim();
    if (!naam || addingGuest) return;
    if (full) {
      toast.error("Beide teams zijn al vol.");
      return;
    }
    setAddingGuest(true);
    try {
      const id = await createGuestPlayer(naam);
      const guest = {
        id,
        username: naam,
        full_name: naam,
        avatar_url: null,
        is_guest: true,
        created_at: new Date().toISOString(),
      } as unknown as Profile;
      setExtraGuests((g) => [...g, guest]);
      // Meteen selecteren: eerst team A, dan B.
      if (teamA.length < 2) setTeamA((a) => [...a, id]);
      else if (teamB.length < 2) setTeamB((b) => [...b, id]);
      setGuestName("");
      tap();
      onGuestCreated?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAddingGuest(false);
    }
  }

  const sa = scoreA === "" ? null : Number(scoreA);
  const sb = scoreB === "" ? null : Number(scoreB);
  const scored = sa !== null && sb !== null && sa >= 0 && sb >= 0;
  const preview = scored
    ? sa === sb
      ? "Gelijkspel — beide teams krijgen 1 punt."
      : `${(sa > sb ? teamA : teamB).map(nameOf).join(" & ")} winnen — 3 punten.`
    : null;

  /** Aantikken in het rooster: los een gekozen speler weer, of voeg hem toe aan
   *  het eerste team met plek (A, dan B). */
  function toggle(id: string) {
    const t = teamOf(id);
    if (t === "a") setTeamA((a) => a.filter((x) => x !== id));
    else if (t === "b") setTeamB((b) => b.filter((x) => x !== id));
    else if (teamA.length < 2) setTeamA((a) => [...a, id]);
    else if (teamB.length < 2) setTeamB((b) => [...b, id]);
  }

  /** Verplaats een gekozen speler naar het andere team (als daar plek is). */
  function switchTeam(id: string) {
    const t = teamOf(id);
    if (t === "a" && teamB.length < 2) {
      setTeamA((a) => a.filter((x) => x !== id));
      setTeamB((b) => [...b, id]);
    } else if (t === "b" && teamA.length < 2) {
      setTeamB((b) => b.filter((x) => x !== id));
      setTeamA((a) => [...a, id]);
    }
  }

  function swapTeams() {
    setTeamA(teamB);
    setTeamB(teamA);
    setScoreA(scoreB);
    setScoreB(scoreA);
    setSets((prev) => prev.map((s) => ({ a: s.b, b: s.a })));
  }

  /** Plan-modus: zet de match klaar zonder uitslag; spelen komt later.
   *  Optioneel wekelijks herhalen (genereert meerdere geplande matches). */
  async function plan() {
    if (!full) return;
    setBusy(true);
    try {
      const weeks =
        repeat && when ? Math.max(2, Math.min(12, repeatWeeks)) : 1;
      const base = when ? new Date(when) : null;
      for (let i = 0; i < weeks; i++) {
        let playedAt: string | null = null;
        if (base) {
          const d = new Date(base);
          d.setDate(base.getDate() + i * 7);
          playedAt = d.toISOString();
        }
        await createPlannedMatch({
          a1: teamA[0],
          a2: teamA[1],
          b1: teamB[0],
          b2: teamB[1],
          playedAt,
        });
      }
      tap();
      toast.success(
        weeks > 1
          ? `${weeks} matches gepland — je vindt ze bij Te spelen.`
          : "Match gepland — je vindt hem bij Te spelen.",
      );
      onCreated();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!full || !scored) return;
    setBusy(true);
    try {
      const setScores = toSetScores(sets);
      await createCompletedMatch({
        a1: teamA[0],
        a2: teamA[1],
        b1: teamB[0],
        b2: teamB[1],
        winner: sa === sb ? "draw" : sa! > sb! ? "a" : "b",
        scoreA: sa,
        scoreB: sb,
        setScores: setScores.length > 0 ? setScores : null,
      });
      // Vieren als de logger zelf in het winnende team zit.
      if (sa !== sb && (sa! > sb! ? teamA : teamB).includes(myId)) {
        celebrate();
        winPulse();
      } else {
        tap();
      }
      toast.success("Match toegevoegd.");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "plan" ? "Match plannen" : "Match loggen"}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">
            {step === 1
              ? mode === "plan"
                ? "Wie spelen er?"
                : "Wie speelden er?"
              : mode === "plan"
                ? "Wanneer spelen jullie?"
                : "Wat was de eindscore?"}
          </h2>
          <button className="sheet__close" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </header>
        <ol className="steps" aria-label={`Stap ${step} van 2`}>
          <li
            className={`steps__item ${step === 1 ? "is-current" : "is-done"}`}
            aria-current={step === 1 ? "step" : undefined}
          >
            <span className="steps__dot" aria-hidden="true">
              {step > 1 ? "✓" : "1"}
            </span>
            Spelers
          </li>
          <li
            className={`steps__item ${step === 2 ? "is-current" : ""}`}
            aria-current={step === 2 ? "step" : undefined}
          >
            <span className="steps__dot" aria-hidden="true">
              2
            </span>
            {mode === "plan" ? "Plannen" : "Score"}
          </li>
        </ol>

        {step === 1 && (
          <>
            {searchable && (
              <input
                className="input pick-search"
                type="search"
                placeholder="Zoek een speler…"
                aria-label="Zoek een speler"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            {visiblePlayers.length === 0 && (
              <p className="empty empty--bare">
                {query.trim()
                  ? `Geen speler gevonden voor "${query.trim()}".`
                  : "Nog geen spelers — voeg een vriend of een gast toe."}
              </p>
            )}
            <div className="pick-grid">
              {visiblePlayers.map((p) => {
                const team = teamOf(p.id);
                const guest = isGuest(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pick-chip ${team ? `pick-chip--${team}` : ""} ${
                      guest ? "pick-chip--guest" : ""
                    } ${!team && full ? "is-dim" : ""}`}
                    aria-pressed={team !== null}
                    onClick={() => toggle(p.id)}
                  >
                    <Avatar profile={p} size={30} />
                    <span className="pick-chip__name">{displayName(p)}</span>
                    {guest && (
                      <span className="pick-chip__guest" title="Gastspeler zonder account">
                        gast
                      </span>
                    )}
                    {team && (
                      <span className="pick-chip__team">{team.toUpperCase()}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Gast toevoegen: iemand zonder app-account, gewoon met een naam. */}
            <div className="guest-add">
              <input
                className="input guest-add__input"
                type="text"
                placeholder="Speelt iemand zonder account mee? Typ zijn naam…"
                aria-label="Naam van een gastspeler"
                value={guestName}
                maxLength={40}
                disabled={full || addingGuest}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addGuest();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => void addGuest()}
                disabled={!guestName.trim() || full || addingGuest}
              >
                {addingGuest ? "Bezig…" : "+ Gast"}
              </button>
            </div>

            <p className="sheet__hint">
              {full
                ? "Tik op een speler om die weer los te laten, of wissel iemand van team met de pijl."
                : `Tik de spelers aan: ze vullen eerst team A, dan team B (${picked}/4).`}
            </p>

            {picked > 0 && (
              <div className="pick-teams">
                <TeamZone
                  label="Team A"
                  side="a"
                  ids={teamA}
                  byId={byId}
                  nameOf={nameOf}
                  canSwitch={teamB.length < 2}
                  onSwitch={switchTeam}
                />
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={swapTeams}
                  disabled={!full}
                  title="Wissel team A en B"
                  aria-label="Wissel team A en B"
                >
                  ⇄
                </button>
                <TeamZone
                  label="Team B"
                  side="b"
                  ids={teamB}
                  byId={byId}
                  nameOf={nameOf}
                  canSwitch={teamA.length < 2}
                  onSwitch={switchTeam}
                />
              </div>
            )}

            <footer className="sheet__foot">
              <button className="btn" onClick={onClose}>
                Annuleren
              </button>
              <button
                className="btn btn--primary"
                disabled={!full}
                onClick={() => setStep(2)}
              >
                {mode === "plan" ? "Naar plannen →" : "Naar de score →"}
              </button>
            </footer>
          </>
        )}

        {step === 2 && mode === "plan" && (
          <>
            <div className="pick-teams pick-teams--stacked">
              <div className="pick-teams__team pick-teams__team--a">
                <span className="pick-teams__label">Team A</span>
                <TeamPreview ids={teamA} byId={byId} nameOf={nameOf} />
              </div>
              <span className="pick-teams__vs" aria-hidden="true">
                vs
              </span>
              <div className="pick-teams__team pick-teams__team--b">
                <span className="pick-teams__label">Team B</span>
                <TeamPreview ids={teamB} byId={byId} nameOf={nameOf} />
              </div>
            </div>

            <label className="label mt-4">
              Wanneer? (optioneel)
              <input
                className="input"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </label>
            <p className="sheet__hint">
              Laat het tijdstip leeg om alleen de teams klaar te zetten. De
              match komt bij "Te spelen" te staan; de score vul je na afloop in.
            </p>

            <div className="repeat-row">
              <label className="repeat-row__toggle">
                <input
                  type="checkbox"
                  checked={repeat}
                  disabled={!when}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                Herhaal wekelijks
              </label>
              {repeat && when && (
                <label className="repeat-row__weeks">
                  aantal weken
                  <input
                    className="input"
                    type="number"
                    min={2}
                    max={12}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                  />
                </label>
              )}
            </div>
            {!when && (
              <p className="sheet__hint">
                Kies eerst een tijdstip om wekelijks te kunnen herhalen.
              </p>
            )}

            <footer className="sheet__foot">
              <button className="btn" onClick={() => setStep(1)} disabled={busy}>
                ← Spelers
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !full}
                onClick={plan}
              >
                {busy
                  ? "Plannen…"
                  : repeat && when
                    ? `${Math.max(2, Math.min(12, repeatWeeks))} matches plannen`
                    : "Match plannen"}
              </button>
            </footer>
          </>
        )}

        {step === 2 && mode === "score" && (
          <>
            <div className="score-entry">
              <div
                className={`score-entry__team ${
                  scored && sa! > sb! ? "is-leading" : ""
                }`}
              >
                <span className="pick-teams__label">Team A</span>
                <span className="avatar-pair">
                  {teamA.map((id) => (
                    <Avatar key={id} profile={byId(id)} size={26} short />
                  ))}
                </span>
                <span className="score-entry__names">
                  {teamA.map(nameOf).join(" & ")}
                </span>
                <ScoreStepper
                  value={scoreA}
                  onChange={setScoreA}
                  label="Score team A"
                  autoFocus
                />
              </div>
              <span className="score-entry__dash">–</span>
              <div
                className={`score-entry__team ${
                  scored && sb! > sa! ? "is-leading" : ""
                }`}
              >
                <span className="pick-teams__label">Team B</span>
                <span className="avatar-pair">
                  {teamB.map((id) => (
                    <Avatar key={id} profile={byId(id)} size={26} short />
                  ))}
                </span>
                <span className="score-entry__names">
                  {teamB.map(nameOf).join(" & ")}
                </span>
                <ScoreStepper
                  value={scoreB}
                  onChange={setScoreB}
                  label="Score team B"
                />
              </div>
            </div>
            {preview ? (
              <p
                className={`sheet-preview ${
                  sa === sb ? "sheet-preview--draw" : "sheet-preview--win"
                }`}
              >
                <span aria-hidden="true">{sa === sb ? "🤝" : "🏆"}</span>{" "}
                {preview}
              </p>
            ) : (
              <p className="sheet__hint">
                De hoogste score wint. Een gelijke score telt als gelijkspel.
              </p>
            )}

            <div className="sheet-sets">
              <button
                type="button"
                className="planned-card__sets-toggle"
                aria-expanded={showSets}
                onClick={() => setShowSets((s) => !s)}
              >
                {showSets
                  ? "− Sets verbergen"
                  : "+ Sets per set invoeren (optioneel)"}
              </button>
              {showSets && (
                <div className="mt-4">
                  <SetScoresInput
                    sets={sets}
                    onChange={setSets}
                    labelA={teamA.map(nameOf).join(" & ") || "Team A"}
                    labelB={teamB.map(nameOf).join(" & ") || "Team B"}
                  />
                </div>
              )}
            </div>

            <footer className="sheet__foot">
              <button className="btn" onClick={() => setStep(1)} disabled={busy}>
                ← Spelers
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !scored}
                onClick={save}
              >
                {busy ? "Opslaan…" : "Match opslaan"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/** Interactieve teamzone in stap 1: toont de gekozen spelers met per speler een
 *  pijl om hem naar het andere team te verplaatsen. */
function TeamZone({
  label,
  side,
  ids,
  byId,
  nameOf,
  canSwitch,
  onSwitch,
}: {
  label: string;
  side: "a" | "b";
  ids: string[];
  byId: (id: string) => Profile | undefined;
  nameOf: (id: string) => string;
  canSwitch: boolean;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className={`pick-teams__team pick-teams__team--${side}`}>
      <span className="pick-teams__label">{label}</span>
      {ids.length === 0 ? (
        <span className="pick-teams__names">—</span>
      ) : (
        <ul className="teamzone__list">
          {ids.map((id) => (
            <li key={id} className="teamzone__player">
              <Avatar profile={byId(id)} size={20} short />
              <span className="teamzone__name">{nameOf(id)}</span>
              <button
                type="button"
                className="teamzone__switch"
                onClick={() => onSwitch(id)}
                disabled={!canSwitch}
                title={`Verplaats naar team ${side === "a" ? "B" : "A"}`}
                aria-label={`${nameOf(id)} naar team ${side === "a" ? "B" : "A"}`}
              >
                {side === "a" ? "→" : "←"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Avatars + namen van een (half gevuld) team in het teamoverzicht. */
function TeamPreview({
  ids,
  byId,
  nameOf,
}: {
  ids: string[];
  byId: (id: string) => Profile | undefined;
  nameOf: (id: string) => string;
}) {
  if (ids.length === 0) return <span className="pick-teams__names">—</span>;
  return (
    <span className="pick-teams__players">
      <span className="avatar-pair">
        {ids.map((id) => (
          <Avatar key={id} profile={byId(id)} size={20} short />
        ))}
      </span>
      <span className="pick-teams__names">{ids.map(nameOf).join(" & ")}</span>
    </span>
  );
}

export default NewMatchSheet;
