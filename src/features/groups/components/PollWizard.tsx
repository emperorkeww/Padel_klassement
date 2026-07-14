import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { addDays } from "@/lib/utils/time";
import { type WeekDay } from "@/features/availability/api";
import { dayStarts, manualStarts, type FreeStart } from "@/features/availability/availabilityShare";
import { getWeekWeather } from "@/features/availability/weatherApi";
import { summarizeDay } from "@/features/availability/weatherLogic";
import { isPlaytomicClub, type Club } from "@/features/availability/club";
import { type NewPollOption } from "@/features/groups/pollsApi";
import {
  DURATIONS,
  EVENING_FROM,
  MAX_OPTIONS,
  floorHalfHour,
  fmtDate,
  optKey,
  shortDay,
} from "../planPollHelpers";

/* ------------------------------------------------------------------ */
/* Wizard: dag-navigator, alleen vrije slots kiesbaar.                 */
/* ------------------------------------------------------------------ */

export function PollWizard({
  today,
  week,
  weekLoading,
  club,
  initialPicked,
  storageKey,
  submitLabel,
  confirmHint,
  onSubmit,
  onClose,
  onDone,
}: {
  today: string;
  week: WeekDay[];
  weekLoading: boolean;
  /** Club waarvoor deze wizard beschikbaarheid/weer toont (#322). */
  club: Club;
  /** Bestaande selectie voor de "Dagen aanpassen"-modus (#128). */
  initialPicked?: Map<string, NewPollOption>;
  /** sessionStorage-sleutel: selectie overleeft een uitstap naar /banen. */
  storageKey?: string;
  submitLabel: (count: number) => string;
  /** Waarschuwing die eerst bevestigd moet worden (bv. momenten vervallen). */
  confirmHint?: (picked: Map<string, NewPollOption>) => string | null;
  onSubmit: (options: NewPollOption[], picked: Map<string, NewPollOption>) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [duration, setDuration] = useState<number>(90);
  const [selectedDay, setSelectedDay] = useState(today);
  const [wholeDay, setWholeDay] = useState(false);
  // Weericoontjes in de dag-navigator (#83-bonus): alleen bij buitenbanen,
  // en stil bij ontbrekende data — zelfde regels als op de Banen-pagina.
  const wizardOutdoor = week.some((d) =>
    (d.data?.courts ?? []).some((r) => r.court.type !== "roofed"),
  );
  const wizardWeather = useAsync(
    () => (wizardOutdoor ? getWeekWeather(club) : Promise.resolve(null)),
    [wizardOutdoor, club.id],
  );
  const [picked, setPicked] = useState<Map<string, NewPollOption>>(() => {
    if (initialPicked) return new Map(initialPicked);
    if (storageKey) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          return new Map(
            Object.entries(JSON.parse(raw)) as [string, NewPollOption][],
          );
        }
      } catch {
        /* ongeldige of onbeschikbare opslag → verse start */
      }
    }
    return new Map();
  });
  // Selectie live wegschrijven zodat een swipe-terug vanuit /banen hem
  // terugvindt; leeg = sleutel weg (dan heropent de wizard ook niet).
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (picked.size === 0) sessionStorage.removeItem(storageKey);
      else {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify(Object.fromEntries(picked)),
        );
      }
    } catch {
      /* opslag niet beschikbaar — geen probleem */
    }
  }, [picked, storageKey]);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("20:00");
  const [saving, setSaving] = useState(false);
  // Twee-taps bevestiging wanneer de wijziging iets laat vervallen.
  const [armed, setArmed] = useState(false);

  const weekEnd = addDays(today, 6);

  // Handmatige locatie (#322): geen Playtomic-data, maar wel dezelfde
  // selectie-flow via een synthetisch halfuur-raster.
  const manual = !isPlaytomicClub(club);

  // Vrije starttijden per dag, gefilterd op duur (en standaard op avond).
  const startsByDay = useMemo(() => {
    const map = new Map<string, FreeStart[] | null>();
    for (const day of week) {
      map.set(
        day.date,
        manual
          ? manualStarts(day.date, club.timezone)
          : day.data
            ? dayStarts(day, duration)
            : null,
      );
    }
    return map;
  }, [week, duration, manual, club.timezone]);

  const visibleStarts = (date: string) => {
    const starts = startsByDay.get(date);
    if (starts == null) return null;
    // Standaard avond-focus (ook bij een handmatige locatie); de "vroeger"-knop
    // klapt de eerdere uren uit.
    return wholeDay
      ? starts
      : starts.filter((s) => Number(s.time.slice(0, 2)) >= EVENING_FROM);
  };

  function toggle(date: string, time: string, courtsFree: number | null) {
    setArmed(false);
    setPicked((cur) => {
      const next = new Map(cur);
      const key = `${date}|${time}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= MAX_OPTIONS) {
          toast.error(`Maximaal ${MAX_OPTIONS} momenten per poll.`);
          return cur;
        }
        next.set(key, { date, startTime: time, duration, courtsFree });
      }
      return next;
    });
  }

  function addManual() {
    if (!manualDate || !manualTime) return;
    if (picked.size >= MAX_OPTIONS) {
      toast.error(`Maximaal ${MAX_OPTIONS} momenten per poll.`);
      return;
    }
    // Binnen het datavenster is de beschikbaarheid bekend → hard afdwingen.
    let courtsFree: number | null = null;
    if (manualDate >= today && manualDate <= weekEnd) {
      const starts = startsByDay.get(manualDate);
      if (starts) {
        const slot = starts.find(
          (s) => floorHalfHour(s.time) === floorHalfHour(manualTime),
        );
        courtsFree = slot ? slot.courts.length : 0;
        if (courtsFree === 0) {
          toast.error("Op dit uur is er geen baan vrij — kies een ander moment.");
          return;
        }
      }
    }
    setPicked((cur) => {
      const next = new Map(cur);
      next.set(`${manualDate}|${manualTime}`, {
        date: manualDate,
        startTime: manualTime,
        duration,
        courtsFree,
      });
      return next;
    });
    setManualDate("");
  }

  const hint = confirmHint?.(picked) ?? null;

  async function publish() {
    if (picked.size === 0) return;
    // Vervalt er iets (bv. momenten met stemmen)? Eerst bevestigen.
    if (hint && !armed) {
      setArmed(true);
      return;
    }
    setSaving(true);
    try {
      await onSubmit([...picked.values()], picked);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const dayStartsVisible = visibleStarts(selectedDay);
  // Standaard avond-focus; zijn er vroegere uren (ook in het handmatige raster),
  // dan biedt een "vroeger"-knop ze aan om uit/in te klappen.
  const hasEarlier = (startsByDay.get(selectedDay) ?? []).some(
    (s) => Number(s.time.slice(0, 2)) < EVENING_FROM,
  );

  return (
    <div className="poll-wizard">
      <p className="proposals__hint">
        Kies tot {MAX_OPTIONS} momenten waarop een baan vrij is — de groep
        stemt daarna per moment.
      </p>

      {/* Dag-navigator. */}
      <div className="day-strip" role="tablist" aria-label="Kies een dag">
        {week.map((d) => {
          const starts = visibleStarts(d.date);
          const n = starts?.length ?? 0;
          const on = selectedDay === d.date;
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={on}
              className={`day-chip${on ? " is-active" : ""}${n === 0 ? " is-empty" : ""}`}
              onClick={() => setSelectedDay(d.date)}
            >
              <span className="day-chip__name">
                {fmtDate(d.date, { weekday: "short" }).replace(".", "")}
              </span>
              <span className="day-chip__num">
                {fmtDate(d.date, { day: "numeric" })}
              </span>
              {(() => {
                const w = summarizeDay(wizardWeather.data?.[d.date] ?? []);
                return (
                  w && (
                    <span
                      className={`day-chip__weather${w.warn ? " is-warn" : ""}`}
                      title={`${w.temp}° · ${w.rainPct}% regenkans`}
                      aria-label={`Weer: ${w.temp} graden, ${w.rainPct}% regenkans`}
                    >
                      {w.icon}
                    </span>
                  )
                );
              })()}
            </button>
          );
        })}
      </div>

      {/* Uren van de gekozen dag. */}
      <div className="poll-wizard__slots">
        {/* Standaard avond-focus; deze knop klapt de vroegere uren uit/in. */}
        {(hasEarlier || (wholeDay && !manual)) && (
          <button
            type="button"
            className="btn btn--sm poll-wizard__earlier"
            onClick={() => setWholeDay((v) => !v)}
            aria-expanded={wholeDay}
          >
            {wholeDay ? "↓ Alleen avonduren" : "↑ Vroegere uren tonen"}
          </button>
        )}
        {weekLoading && <p className="empty">Vrije banen laden…</p>}
        {!weekLoading && dayStartsVisible == null && (
          <p className="empty">Geen beschikbaarheidsgegevens voor deze dag.</p>
        )}
        {!weekLoading && dayStartsVisible != null && dayStartsVisible.length === 0 && (
          <p className="empty">
            {wholeDay ? "Niets vrij op deze dag." : "Geen vrij avondslot op deze dag."}
          </p>
        )}
        {dayStartsVisible?.map((s) => {
          const key = `${selectedDay}|${s.time}`;
          const on = picked.has(key);
          return (
            <button
              key={s.time}
              type="button"
              className={`slot-chip${on ? " is-active" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(selectedDay, s.time, manual ? null : s.courts.length)}
            >
              {s.time}
              {/* Baan-telling alleen bij Playtomic; een handmatige locatie heeft
                  geen beschikbaarheidsdata (#322). */}
              {!manual && (
                <span
                  className={`slot-chip__count slot-chip__count--c${Math.min(s.courts.length, 4)}`}
                  title={`${s.courts.length} ${s.courts.length === 1 ? "baan" : "banen"} vrij`}
                >
                  {s.courts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="poll-wizard__controls">
        {/* De avond/vroeger-toggle staat nu boven het raster (poll-wizard__earlier).
            Banen-verkenning in context (#106): opent de Banen-pagina in de app
            zelf met de gekozen dag al ingesteld — swipe/ga terug en de wizard
            staat er nog, mét je selectie (sessionStorage). Niet bij een
            handmatige locatie: daar is geen Playtomic-banenpagina (#322). */}
        {!manual && (
          <Link
            className="poll-wizard__toggle"
            to={`/banen?datum=${selectedDay}`}
          >
            Verken alle vrije banen →
          </Link>
        )}
        <label className="poll-wizard__toggle">
          Duur{" "}
          <select
            className="select"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="poll-wizard__manual-details">
        <summary>Ander moment (verder vooruit)</summary>
        <div className="poll-wizard__manual">
          <label className="proposal-form__field">
            <span>Datum</span>
            <input
              type="date"
              className="select"
              min={today}
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
          </label>
          <label className="proposal-form__field">
            <span>Uur</span>
            <input
              type="time"
              className="select"
              step={1800}
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            disabled={!manualDate}
            onClick={addManual}
          >
            + Voeg toe
          </button>
          <p className="proposal-form__note">
            Buiten deze week is de beschikbaarheid nog onbekend; de poll
            markeert dat bij het moment.
          </p>
        </div>
      </details>

      {/* Sticky selectiebalk: gekozen momenten + start-knop altijd in beeld. */}
      <div className="wizard-footer">
        <div className="wizard-footer__picked">
          {picked.size === 0 && (
            <span className="proposal__meta">Nog geen momenten gekozen.</span>
          )}
          {[...picked.values()]
            .sort((a, b) => optKey(a).localeCompare(optKey(b)))
            .map((o) => (
              <button
                key={optKey(o)}
                type="button"
                className="picked-chip"
                title="Verwijderen"
                onClick={() => {
                  setArmed(false);
                  setPicked((cur) => {
                    const next = new Map(cur);
                    next.delete(optKey(o));
                    return next;
                  });
                }}
              >
                {shortDay(o.date)} {o.startTime}
                {o.courtsFree == null ? " ?" : ""} ×
              </button>
            ))}
        </div>
        {armed && hint && (
          <p className="proposal-form__note proposal-form__note--warn" role="alert">
            ⚠ {hint} Tik nogmaals om te bevestigen.
          </p>
        )}
        <div className="proposal-form__actions">
          <button
            className="btn btn--sm btn--primary"
            disabled={saving || picked.size === 0}
            onClick={publish}
          >
            {saving
              ? "Bezig…"
              : armed && hint
                ? "Zeker? Tik nogmaals"
                : submitLabel(picked.size)}
          </button>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}