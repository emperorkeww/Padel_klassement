import { useEffect, useState } from "react";
import { ScoreStepper } from "@/ui/ScoreStepper";
import { useAsync } from "@/lib/hooks/useAsync";
import { getMyGroups } from "@/features/groups/api";
import { Sheet } from "@/ui/Sheet";
import { useAuth } from "@/features/auth/AuthProvider";
import { useToast } from "@/ui/ToastProvider";
import { Avatar } from "@/ui/Avatar";
import { errorMessage } from "@/lib/utils/errors";
import { coachMatchQuip } from "@/features/coach/coachMoments";
import { celebrate } from "@/lib/utils/confetti";
import { tap, winPulse } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import {
  createGuestPlayer,
  emptySet,
  toSetScores,
  type SetPair,
} from "@/features/matches/api";
import {
  saveCompletedMatch,
  savePlannedMatch,
} from "@/features/matches/outbox";
import { SetScoresInput } from "@/features/matches/components/SetScoresInput";
import { COURT_TYPES } from "@/features/matches/courtType";
import {
  readDraft,
  writeDraft,
  clearDraft,
  isDraftMeaningful,
  type MatchDraft,
} from "@/features/matches/matchDraft";
import { useSmoesPrompt } from "@/features/matches/SmoesPromptProvider";
import type { CourtType, MatchFormat, Profile, RoastIntensiteit } from "@/types";

export type NewMatchMode = "score" | "plan";

// Zonder verbinding kan de RPC niet slagen; het concept blijft wél lokaal
// bewaard (matchDraft), dus de boodschap is geruststellend i.p.v. een kale
// netwerkfout (#462). De echte wachtrij-afhandeling volgt in een latere stap.
const OFFLINE_SUBMIT_MESSAGE =
  "Geen verbinding — je invoer blijft bewaard. Probeer het opnieuw zodra je weer online bent.";

/** Match loggen of plannen in twee stappen: spelers aantikken, dan de
 *  eindscore ("score") of het tijdstip ("plan"). Een geplande match komt in
 *  "Te spelen" te staan, met inline score-invoer voor na afloop.
 *  Op mobiel een bottom sheet, op desktop een gecentreerde dialoog. */
export function NewMatchSheet({
  open,
  players,
  mode = "score",
  groupId,
  intensiteit = "gemeen",
  onClose,
  onCreated,
  onGuestCreated,
}: {
  open: boolean;
  players: Profile[];
  mode?: NewMatchMode;
  /** Als gezet: de match wordt vast aan deze groep gekoppeld (telt mee in de
   *  groepsstand en avondsamenvatting) en de groep-keuze verschijnt niet.
   *  Zonder waarde kan de gebruiker zelf optioneel een groep kiezen (#361). */
  groupId?: string | null;
  /** Roast-toon van de groep waarin gelogd wordt (#183), voor Coach Rudy's
   *  reactie op je eigen uitslag. Buiten groepscontext valt hij op `gemeen`. */
  intensiteit?: RoastIntensiteit;
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
  // Speelvorm (#279): dubbel (standaard) of singles; bepaalt de teamgrootte.
  const [format, setFormat] = useState<MatchFormat>("2v2");
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [showSets, setShowSets] = useState(false);
  const [sets, setSets] = useState<SetPair[]>([emptySet()]);
  const [when, setWhen] = useState(""); // datetime-local; "" = zonder tijdstip
  // Optioneel baantype (#471); null = niet opgegeven.
  const [courtType, setCourtType] = useState<CourtType | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  // Buiten groepscontext: zelf gekozen groep ("" = losse match, #361).
  const [pickedGroupId, setPickedGroupId] = useState("");
  // Gasten die tijdens deze sessie zijn aangemaakt (meteen kiesbaar).
  const [extraGuests, setExtraGuests] = useState<Profile[]>([]);
  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  // Toont de "concept hervat"-strook als er bij het openen een bewaarde,
  // onafgemaakte invoer uit localStorage is teruggehaald (#462).
  const [resumed, setResumed] = useState(false);
  const toast = useToast();
  const promptSmoes = useSmoesPrompt();
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Zonder vaste groep van de aanroeper: eigen groepen laden voor de keuze
  // (RLS geeft alleen groepen waar de gebruiker lid van is).
  const myGroups = useAsync(
    () => (open && groupId == null ? getMyGroups() : Promise.resolve([])),
    [open, groupId],
  );
  // De groep die daadwerkelijk meegaat in de submit: vast (prop) of gekozen.
  const effectiveGroupId = groupId ?? (pickedGroupId || null);

  /** Zet alle invoervelden terug op hun beginwaarden (verse start). Gasten en
   *  zoekterm horen bij de sessie, niet bij het concept — die altijd leeg. */
  function resetFields() {
    setTeamA([]);
    setTeamB([]);
    setFormat("2v2");
    setStep(1);
    setScoreA("");
    setScoreB("");
    setShowSets(false);
    setSets([emptySet()]);
    setWhen("");
    setCourtType(null);
    setRepeat(false);
    setRepeatWeeks(4);
    setPickedGroupId("");
  }

  /** "Opnieuw beginnen": wis het bewaarde concept en start met een schone lei. */
  function startFresh() {
    clearDraft(mode, groupId ?? null);
    resetFields();
    setResumed(false);
    tap();
  }

  // Bij openen: een eerder afgebroken concept hervatten (#462), of anders vers
  // beginnen. Gasten/zoekterm zijn sessie-state en starten altijd leeg.
  useEffect(() => {
    if (!open) return;
    const draft = readDraft(mode, groupId ?? null);
    if (draft) {
      setTeamA(draft.teamA);
      setTeamB(draft.teamB);
      setFormat(draft.format);
      setStep(draft.step);
      setScoreA(draft.scoreA);
      setScoreB(draft.scoreB);
      setShowSets(draft.showSets);
      setSets(draft.sets);
      setWhen(draft.when);
      setCourtType(draft.courtType);
      setRepeat(draft.repeat);
      setRepeatWeeks(draft.repeatWeeks);
      setPickedGroupId(draft.pickedGroupId);
      setResumed(true);
    } else {
      resetFields();
      setResumed(false);
    }
    setQuery("");
    setExtraGuests([]);
    setGuestName("");
    setAddingGuest(false);
  }, [open, mode, groupId]);

  // Concept debounced bewaren zolang de sheet open is en er iets is ingevuld;
  // een leeg concept juist wissen. Zo overleeft de invoer een refresh of een
  // per ongeluk gesloten sheet (#462).
  useEffect(() => {
    if (!open) return;
    const draft: MatchDraft = {
      teamA,
      teamB,
      format,
      step,
      scoreA,
      scoreB,
      showSets,
      sets,
      when,
      courtType,
      repeat,
      repeatWeeks,
      pickedGroupId,
      savedAt: Date.now(),
    };
    if (!isDraftMeaningful(draft)) {
      clearDraft(mode, groupId ?? null);
      return;
    }
    const t = setTimeout(() => writeDraft(mode, groupId ?? null, draft), 400);
    return () => clearTimeout(t);
  }, [
    open,
    mode,
    groupId,
    teamA,
    teamB,
    format,
    step,
    scoreA,
    scoreB,
    showSets,
    sets,
    when,
    courtType,
    repeat,
    repeatWeeks,
    pickedGroupId,
  ]);

  if (!open) return null;

  // Kiesbare spelers = de van buiten meegegeven lijst plus de gasten die je
  // net in deze sessie aanmaakte (ontdubbeld op id).
  const allPlayers: Profile[] = [
    ...players,
    ...extraGuests.filter((g) => !players.some((p) => p.id === g.id)),
  ];
  const isGuest = (p: Profile | undefined) => !!p?.is_guest;

  const picked = teamA.length + teamB.length;
  // Teamgrootte volgt de speelvorm: 1 bij singles, 2 bij dubbel.
  const teamSize = format === "1v1" ? 1 : 2;
  const full = teamA.length === teamSize && teamB.length === teamSize;
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
      if (teamA.length < teamSize) setTeamA((a) => [...a, id]);
      else if (teamB.length < teamSize) setTeamB((b) => [...b, id]);
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
    else if (teamA.length < teamSize) setTeamA((a) => [...a, id]);
    else if (teamB.length < teamSize) setTeamB((b) => [...b, id]);
  }

  /** Verplaats een gekozen speler naar het andere team (als daar plek is). */
  function switchTeam(id: string) {
    const t = teamOf(id);
    if (t === "a" && teamB.length < teamSize) {
      setTeamA((a) => a.filter((x) => x !== id));
      setTeamB((b) => [...b, id]);
    } else if (t === "b" && teamA.length < teamSize) {
      setTeamB((b) => b.filter((x) => x !== id));
      setTeamA((a) => [...a, id]);
    }
  }

  /** Wissel van speelvorm. Van 2v2 naar 1v1: houd per team de eerst gekozen
   *  speler aan (sluit aan op "vult eerst A, dan B"); andersom komen er
   *  gewoon slots vrij. */
  function switchFormat(f: MatchFormat) {
    if (f === format) return;
    setFormat(f);
    if (f === "1v1") {
      setTeamA((a) => a.slice(0, 1));
      setTeamB((b) => b.slice(0, 1));
    }
    tap();
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
      let queued = 0;
      for (let i = 0; i < weeks; i++) {
        let playedAt: string | null = null;
        if (base) {
          const d = new Date(base);
          d.setDate(base.getDate() + i * 7);
          playedAt = d.toISOString();
        }
        // Online direct, offline in de wachtrij (#462).
        const result = await savePlannedMatch({
          a1: teamA[0],
          a2: teamA[1] ?? null,
          b1: teamB[0],
          b2: teamB[1] ?? null,
          playedAt,
          groupId: effectiveGroupId,
          courtType,
        });
        if (result.status === "queued") queued++;
      }
      tap();
      if (queued > 0) {
        toast.success(
          "Opgeslagen — wordt gepland zodra je weer online bent.",
        );
      } else {
        toast.success(
          weeks > 1
            ? `${weeks} matches gepland — je vindt ze bij Te spelen.`
            : "Match gepland — je vindt hem bij Te spelen.",
        );
      }
      clearDraft(mode, groupId ?? null);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(navigator.onLine ? errorMessage(err) : OFFLINE_SUBMIT_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!full || !scored) return;
    setBusy(true);
    try {
      const setScores = toSetScores(sets);
      // Online direct, offline in de wachtrij (#462).
      const result = await saveCompletedMatch({
        a1: teamA[0],
        a2: teamA[1] ?? null,
        b1: teamB[0],
        b2: teamB[1] ?? null,
        winner: sa === sb ? "draw" : sa! > sb! ? "a" : "b",
        scoreA: sa,
        scoreB: sb,
        setScores: setScores.length > 0 ? setScores : null,
        groupId: effectiveGroupId,
        courtType,
      });
      const winnaar = sa === sb ? null : sa! > sb! ? "a" : "b";
      const loggerTeam = teamA.includes(myId)
        ? "a"
        : teamB.includes(myId)
          ? "b"
          : null;
      // Lokale emotie viert de dáád van loggen (niet het versturen), dus ook
      // offline: confetti als de logger zelf in het winnende team zit.
      if (winnaar && loggerTeam === winnaar) {
        celebrate();
        winPulse();
      } else {
        tap();
      }
      if (result.status === "queued") {
        // Offline: geen smoes/quip — die horen bij een bevestigde opslag en de
        // Smoesjesmachine heeft een echte matchId nodig. Eerlijke melding, en de
        // outbox verstuurt de match zodra de verbinding terug is.
        toast.success("Opgeslagen — wordt verstuurd zodra je weer online bent.");
      } else {
        const ctx = { intensiteit, schild: byId(myId)?.roast_schild ?? false };
        // Verloor je zelf een groepsmatch? Dan meteen een smoes kunnen plaatsen
        // (#296): een tikbare toast opent de Smoesjesmachine voor deze match,
        // i.p.v. de gewone quip. Anders reageert Coach Rudy zoals vanouds op je
        // uitslag — of neutraal als de logger niet zelf meespeelde.
        const verlies = !!winnaar && !!loggerTeam && winnaar !== loggerTeam;
        if (verlies && effectiveGroupId && myId) {
          promptSmoes({ matchId: result.matchId, groupId: effectiveGroupId, playerId: myId, ctx });
        } else {
          toast.success(
            loggerTeam
              ? coachMatchQuip({
                  uitkomst:
                    winnaar === null ? "D" : winnaar === loggerTeam ? "W" : "L",
                  bagel: sa !== sb && Math.min(sa!, sb!) === 0,
                  seed: `${myId}-${sa}-${sb}`,
                  ctx,
                })
              : "Match toegevoegd.",
          );
        }
      }
      clearDraft(mode, groupId ?? null);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(navigator.onLine ? errorMessage(err) : OFFLINE_SUBMIT_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      ariaLabel={mode === "plan" ? "Match plannen" : "Match loggen"}
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

        {resumed && (
          <div className="draft-resume" role="status">
            <span>Onafgemaakte match hervat.</span>
            <button
              type="button"
              className="draft-resume__reset"
              onClick={startFresh}
            >
              Opnieuw beginnen
            </button>
          </div>
        )}

        {step === 1 && (
          <>
            {/* Speelvorm kiezen (#279): dubbel of singles. */}
            <div className="tabs" role="radiogroup" aria-label="Speelvorm">
              {(
                [
                  { value: "2v2", label: "2 tegen 2" },
                  { value: "1v1", label: "1 tegen 1" },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={format === o.value}
                  className={`tab ${format === o.value ? "is-active" : ""}`}
                  onClick={() => switchFormat(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {/* Buiten groepscontext: optioneel aan een eigen groep koppelen,
             *  zodat de match meetelt voor groepsstand en toto (#361). */}
            {groupId == null && (myGroups.data?.length ?? 0) > 0 && (
              <label className="label">
                Koppel aan groep (optioneel)
                <select
                  className="select"
                  value={pickedGroupId}
                  onChange={(e) => setPickedGroupId(e.target.value)}
                >
                  <option value="">Losse match — geen groep</option>
                  {(myGroups.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
              {/* De uitleg zat in de placeholder en verdween zodra je typte
                  (#924); ze staat nu boven het veld als label. */}
              <label className="label guest-add__veld">
                Speelt iemand zonder account mee?
                <input
                  className="input guest-add__input"
                  type="text"
                  placeholder="Typ zijn naam"
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
              </label>
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
                : `Tik de spelers aan: ze vullen eerst team A, dan team B (${picked}/${teamSize * 2}).`}
            </p>

            {picked > 0 && (
              <div className="pick-teams">
                <TeamZone
                  label="Team A"
                  side="a"
                  ids={teamA}
                  byId={byId}
                  nameOf={nameOf}
                  canSwitch={teamB.length < teamSize}
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
                  canSwitch={teamA.length < teamSize}
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
                    inputMode="numeric"
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

            <CourtPicker value={courtType} onChange={setCourtType} />

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

            <CourtPicker value={courtType} onChange={setCourtType} />

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
    </Sheet>
  );
}

/** Optionele baantype-keuze (#471) in stap 2: een rij chips die je aan- en weer
 *  uitzet. Voedt de baanvoorkeuren-statistiek op het profiel; leeg laten mag. */
function CourtPicker({
  value,
  onChange,
}: {
  value: CourtType | null;
  onChange: (v: CourtType | null) => void;
}) {
  return (
    <div className="court-picker">
      <span className="court-picker__label">Baantype (optioneel)</span>
      <div
        className="tabs court-picker__opts"
        role="radiogroup"
        aria-label="Baantype"
      >
        {COURT_TYPES.map((c) => {
          const active = value === c.type;
          return (
            <button
              key={c.type}
              type="button"
              role="radio"
              aria-checked={active}
              className={`tab ${active ? "is-active" : ""}`}
              // Nogmaals tikken op de actieve knop wist de keuze weer.
              onClick={() => onChange(active ? null : c.type)}
            >
              <span aria-hidden="true">{c.icon}</span> {c.label}
            </button>
          );
        })}
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
