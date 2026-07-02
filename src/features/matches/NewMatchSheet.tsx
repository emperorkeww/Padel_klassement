import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { Avatar } from "../../components/Avatar";
import { errorMessage } from "../../lib/errors";
import { celebrate } from "../../lib/confetti";
import { displayName } from "../profiles/api";
import { createCompletedMatch } from "./api";
import type { Profile } from "../../lib/types";

/** Match loggen in twee stappen: spelers aantikken, dan de eindscore.
 *  Op mobiel een bottom sheet, op desktop een gecentreerde dialoog. */
export function NewMatchSheet({
  open,
  players,
  onClose,
  onCreated,
}: {
  open: boolean;
  players: Profile[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // Volgorde van aantikken bepaalt de teams: eerste twee = A, laatste twee = B.
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Vers beginnen bij elk openen.
  useEffect(() => {
    if (open) {
      setPicked([]);
      setStep(1);
      setScoreA("");
      setScoreB("");
    }
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
  const nameOf = (id: string) =>
    displayName(players.find((p) => p.id === id));

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
      if (sa !== sb && (sa! > sb! ? teamA : teamB).includes(myId)) celebrate();
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
        aria-label="Match loggen"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">
            {step === 1 ? "Wie speelden er?" : "Wat was de eindscore?"}
          </h2>
          <button className="sheet__close" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </header>
        <p className="sheet__step">Stap {step} van 2</p>

        {step === 1 && (
          <>
            {players.length < 4 ? (
              <p className="empty">
                Je kunt alleen jezelf en je vrienden kiezen. Voeg eerst meer
                vrienden toe om een volledige match (4 spelers) te loggen.
              </p>
            ) : (
              <div className="pick-grid">
                {players.map((p) => {
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
            )}

            <p className="sheet__hint">
              {full
                ? "Tik op een speler om die weer los te laten, of wissel de teams."
                : `Tik de spelers aan in volgorde: eerst team A, dan team B (${picked.length}/4).`}
            </p>

            {picked.length > 0 && (
              <div className="pick-teams">
                <div className="pick-teams__team">
                  <span className="pick-teams__label">Team A</span>
                  <span>{teamA.map(nameOf).join(" & ") || "—"}</span>
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
                <div className="pick-teams__team">
                  <span className="pick-teams__label">Team B</span>
                  <span>{teamB.map(nameOf).join(" & ") || "—"}</span>
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
                Naar de score →
              </button>
            </footer>
          </>
        )}

        {step === 2 && (
          <>
            <div className="score-entry">
              <label className="score-entry__team">
                <span className="pick-teams__label">Team A</span>
                <span className="score-entry__names">
                  {teamA.map(nameOf).join(" & ")}
                </span>
                <input
                  className="input score-entry__input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  aria-label="Score team A"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                />
              </label>
              <span className="score-entry__dash">–</span>
              <label className="score-entry__team">
                <span className="pick-teams__label">Team B</span>
                <span className="score-entry__names">
                  {teamB.map(nameOf).join(" & ")}
                </span>
                <input
                  className="input score-entry__input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="Score team B"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                />
              </label>
            </div>
            <p className="sheet__hint">
              {preview ??
                "De hoogste score wint. Een gelijke score telt als gelijkspel."}
            </p>

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

export default NewMatchSheet;
