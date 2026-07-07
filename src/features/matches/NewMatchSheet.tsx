import { useEffect, useRef, useState } from "react";
import { ScoreStepper } from "../../components/ScoreStepper";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { Avatar } from "../../components/Avatar";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { tap, winPulse } from "../../lib/haptics";
import { displayName } from "../profiles/api";
import { createCompletedMatch, createPlannedMatch } from "./api";
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
}: {
  open: boolean;
  players: Profile[];
  mode?: NewMatchMode;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Volgorde van aantikken bepaalt de teams: eerste twee = A, laatste twee = B.
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [when, setWhen] = useState(""); // datetime-local; "" = zonder tijdstip
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Vers beginnen bij elk openen.
  useEffect(() => {
    if (open) {
      setPicked([]);
      setStep(1);
      setQuery("");
      setScoreA("");
      setScoreB("");
      setWhen("");
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

  const full = picked.length === 4;
  const teamA = picked.slice(0, 2);
  const teamB = picked.slice(2, 4);
  const byId = (id: string) => players.find((p) => p.id === id);
  const nameOf = (id: string) => displayName(byId(id));

  // Bij een lange vriendenlijst is zoeken sneller dan scrollen.
  const searchable = players.length > 8;
  const visiblePlayers = searchable
    ? players.filter((p) =>
        displayName(p).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : players;

  const sa = scoreA === "" ? null : Number(scoreA);
  const sb = scoreB === "" ? null : Number(scoreB);
  const scored = sa !== null && sb !== null && sa >= 0 && sb >= 0;
  const preview = scored
    ? sa === sb
      ? "Gelijkspel — beide teams krijgen 1 punt."
      : `${(sa > sb ? teamA : teamB).map(nameOf).join(" & ")} winnen — 3 punten.`
    : null;

  function toggle(id: string) {
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id],
    );
  }

  function swapTeams() {
    setPicked([...teamB, ...teamA]);
    setScoreA(scoreB);
    setScoreB(scoreA);
  }

  /** Plan-modus: zet de match klaar zonder uitslag; spelen komt later. */
  async function plan() {
    if (!full) return;
    setBusy(true);
    try {
      await createPlannedMatch({
        a1: teamA[0],
        a2: teamA[1],
        b1: teamB[0],
        b2: teamB[1],
        playedAt: when ? new Date(when).toISOString() : null,
      });
      tap();
      toast.success("Match gepland — je vindt hem bij Te spelen.");
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
      await createCompletedMatch({
        a1: teamA[0],
        a2: teamA[1],
        b1: teamB[0],
        b2: teamB[1],
        winner: sa === sb ? "draw" : sa! > sb! ? "a" : "b",
        scoreA: sa,
        scoreB: sb,
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
            {players.length < 4 ? (
              <p className="empty">
                Je kunt alleen jezelf en je vrienden kiezen. Voeg eerst meer
                vrienden toe voor een volledige match (4 spelers).
              </p>
            ) : (
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
                    Geen speler gevonden voor "{query.trim()}".
                  </p>
                )}
              <div className="pick-grid">
                {visiblePlayers.map((p) => {
                  const idx = picked.indexOf(p.id);
                  const team = idx === -1 ? null : idx < 2 ? "a" : "b";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pick-chip ${team ? `pick-chip--${team}` : ""} ${
                        !team && full ? "is-dim" : ""
                      }`}
                      aria-pressed={team !== null}
                      onClick={() => toggle(p.id)}
                    >
                      <Avatar profile={p} size={30} />
                      <span className="pick-chip__name">{displayName(p)}</span>
                      {team && (
                        <span className="pick-chip__team">{team.toUpperCase()}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              </>
            )}

            <p className="sheet__hint">
              {full
                ? "Tik op een speler om die weer los te laten, of wissel de teams."
                : `Tik de spelers aan in volgorde: eerst team A, dan team B (${picked.length}/4).`}
            </p>

            {picked.length > 0 && (
              <div className="pick-teams">
                <div className="pick-teams__team pick-teams__team--a">
                  <span className="pick-teams__label">Team A</span>
                  <TeamPreview ids={teamA} byId={byId} nameOf={nameOf} />
                </div>
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
                <div className="pick-teams__team pick-teams__team--b">
                  <span className="pick-teams__label">Team B</span>
                  <TeamPreview ids={teamB} byId={byId} nameOf={nameOf} />
                </div>
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

            <footer className="sheet__foot">
              <button className="btn" onClick={() => setStep(1)} disabled={busy}>
                ← Spelers
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !full}
                onClick={plan}
              >
                {busy ? "Plannen…" : "Match plannen"}
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
