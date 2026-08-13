import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { addDays } from "@/lib/utils/time";
import type { WeekDay } from "@/features/availability/api";
import { dayStarts, manualStarts, type FreeStart } from "@/features/availability/availabilityShare";
import { getWeekWeather } from "@/features/availability/weatherApi";
import { summarizeDay } from "@/features/availability/weatherLogic";
import { isPlaytomicClub, type Club } from "@/features/availability/club";
import { type NewPollOption } from "@/features/groups/pollsApi";
import {
  bewaarConcept,
  leesConcept,
  wisConcept,
} from "@/features/groups/pollConcept";
import {
  DURATIONS,
  EVENING_FROM,
  MAX_OPTIONS,
  duurLabel,
  floorHalfHour,
  fmtDate,
  longDay,
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
  initialDay,
  initialPicked,
  storageKey,
  bezetteDagen,
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
  /** Dag waarop de wizard opent (#1091), bv. een dag uit de agenda. Hij wordt
   *  altijd de gekozen dag in de navigator — ook voorbij het 7-daagse
   *  beschikbaarheidsvenster, want daar krijgt hij een eigen chip.
   *
   *  Bewust de dág en niet een moment: een poll-optie is dag plus tijd, en die
   *  tijd kan niemand voor de maker verzinnen. */
  initialDay?: string;
  /** Bestaande selectie voor de "Dagen aanpassen"-modus (#128). */
  initialPicked?: Map<string, NewPollOption>;
  /** sessionStorage-sleutel: selectie overleeft een uitstap naar /banen. */
  storageKey?: string;
  /** Dagen waarop al een speeldag staat (#1308) — een stip in de dagstrip.
   *  Ontbreekt waar de wizard die kennis niet heeft (de speeldagkaart). */
  bezetteDagen?: Set<string>;
  submitLabel: (count: number) => string;
  /** Waarschuwing die eerst bevestigd moet worden (bv. momenten vervallen). */
  confirmHint?: (picked: Map<string, NewPollOption>) => string | null;
  onSubmit: (options: NewPollOption[], picked: Map<string, NewPollOption>) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  // Het bewaarde concept, één keer gelezen bij het opbouwen (#1271). Alles
  // hieronder start hieruit als het er is — niet alleen de selectie: kwam je
  // terug op de verkeerde dag, met een andere duur en het handmatige paneel
  // dicht, dan was je selectie er wel maar zag je hem nergens staan.
  const [concept] = useState(() =>
    storageKey && !initialPicked ? leesConcept(storageKey) : null,
  );
  const [duration, setDuration] = useState<number>(concept?.duration ?? 90);
  const weekEnd = addDays(today, 6);
  // Ligt de meegegeven dag voorbij het venster waarvoor we vrije banen hebben?
  const buitenVenster = initialDay != null && initialDay > weekEnd;
  // De gevraagde dag ís de gekozen dag — binnen én buiten het venster.
  // Tot nu toe viel een dag daarbuiten stil terug op vandaag: de navigator kende
  // hem niet, dus stonden de vrije uren van vandáág groot in beeld terwijl de
  // gevraagde dag alleen nog in het handmatige paneel eronder leefde. Wie dan
  // gewoon een uur aantikte, startte een poll op de verkeerde dag zonder dat er
  // iets tegensprak. Een dag in het verleden blijft wél vandaag: daar valt niets
  // meer te plannen.
  const [selectedDay, setSelectedDay] = useState(
    concept?.selectedDay ??
      (initialDay != null && initialDay >= today ? initialDay : today),
  );
  const [wholeDay, setWholeDay] = useState(concept?.wholeDay ?? false);
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
    if (concept) return new Map(Object.entries(concept.picked));
    return new Map();
  });
  // Een dag verder vooruit dan het beschikbaarheidsvenster opent meteen het
  // handmatige pad, met die dag al ingevuld: alleen het uur is nog aan jou.
  // Voorgevuld met de dag die je bedoelde, of anders de eerste dag ná het
  // banenvenster (#1308): een leeg datumveld met een uitgegrijsde knop ernaast
  // liet je zelf uitzoeken waar dit paneel überhaupt over ging.
  const [manualDate, setManualDate] = useState(
    concept?.manualDate ??
      (buitenVenster ? (initialDay as string) : addDays(today, 7)),
  );
  const [manualOpen, setManualOpen] = useState(
    concept?.manualOpen ?? buitenVenster,
  );
  const [manualTime, setManualTime] = useState(concept?.manualTime ?? "20:00");
  // De hele stand live wegschrijven zodat een swipe-terug vanuit /banen hem
  // terugvindt; leeg = sleutel weg (dan heropent de agenda de wizard ook niet).
  useEffect(() => {
    if (!storageKey) return;
    if (picked.size === 0) wisConcept(storageKey);
    else {
      bewaarConcept(storageKey, {
        picked: Object.fromEntries(picked),
        selectedDay,
        duration,
        wholeDay,
        manualOpen,
        manualDate,
        manualTime,
      });
    }
  }, [
    picked,
    storageKey,
    selectedDay,
    duration,
    wholeDay,
    manualOpen,
    manualDate,
    manualTime,
  ]);
  const [saving, setSaving] = useState(false);
  // Twee-taps bevestiging wanneer de wijziging iets laat vervallen.
  const [armed, setArmed] = useState(false);

  // Handmatige locatie (#322): geen Playtomic-data, maar wel dezelfde
  // selectie-flow via een synthetisch halfuur-raster.
  const manual = !isPlaytomicClub(club);

  /**
   * De dagen in de navigator: het opgehaalde venster, plus de gevraagde dag als
   * die er voorbij ligt.
   *
   * Zonder banengegevens (`data: null`) toont die chip geen uren — bij een
   * Playtomic-club wijst de lege staat naar het handmatige paneel eronder. Bij
   * een handmatige locatie draait het synthetische halfuur-raster gewoon door,
   * dus daar is de dag meteen kiesbaar.
   */
  const dagen = useMemo<WeekDay[]>(
    () =>
      buitenVenster
        ? [...week, { date: initialDay as string, data: null, error: null }]
        : week,
    [week, buitenVenster, initialDay],
  );

  // Vrije starttijden per dag, gefilterd op duur (en standaard op avond).
  const startsByDay = useMemo(() => {
    const map = new Map<string, FreeStart[] | null>();
    for (const day of dagen) {
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
  }, [dagen, duration, manual, club.timezone]);

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
          toast.error(`Maximaal ${MAX_OPTIONS} momenten per speeldag.`);
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
      toast.error(`Maximaal ${MAX_OPTIONS} momenten per speeldag.`);
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

  // Staat er al iets gekozen met een andere duur dan de select nu toont? Dan
  // verdient dat één stille regel — zonder die regel lijkt de select over álle
  // momenten te gaan (#1308).
  const gemengdeDuur = [...picked.values()].some((o) => o.duration !== duration);

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
      // De poll staat er: het concept is klaar en mag weg, anders heropent de
      // agenda straks een wizard voor een speeldag die al bestaat (#1271).
      if (storageKey) wisConcept(storageKey);
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
        {dagen.map((d, i) => {
          const starts = visibleStarts(d.date);
          const n = starts?.length ?? 0;
          const on = selectedDay === d.date;
          // De chip voorbij het venster staat los van de week ernaast: alleen
          // "do 20" leest daar als de dag erna, dus draagt hij de volle datum
          // als naam (en een scheiding in de CSS).
          const ver = buitenVenster && d.date === initialDay;
          const isVandaag = d.date === today;
          const bezet = bezetteDagen?.has(d.date) ?? false;
          // De strip liep over een maandgrens zonder dat te zeggen: "Do 13"
          // naast "Za 1" leest als dezelfde maand (#1308). De eerste chip van
          // een nieuwe maand draagt daarom de maandnaam.
          const nieuweMaand =
            i > 0 && d.date.slice(0, 7) !== dagen[i - 1].date.slice(0, 7);
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={on}
              className={`day-chip${on ? " is-active" : ""}${n === 0 ? " is-empty" : ""}${ver ? " day-chip--ver" : ""}${isVandaag ? " is-vandaag" : ""}`}
              title={ver ? longDay(d.date) : undefined}
              // De naam noemt altijd de volle dag plus wat er al staat: "do 13
              // aug" alleen zegt niets over de maand, en een stip zegt niets
              // tegen een schermlezer (#1308).
              aria-label={`${longDay(d.date)}${isVandaag ? " — vandaag" : ""}${bezet ? " — er staat al een speeldag" : ""}`}
              onClick={() => setSelectedDay(d.date)}
            >
              <span className="day-chip__name">
                {nieuweMaand
                  ? fmtDate(d.date, { month: "short" }).replace(".", "")
                  : fmtDate(d.date, { weekday: "short" }).replace(".", "")}
              </span>
              <span className="day-chip__num">
                {fmtDate(d.date, { day: "numeric" })}
              </span>
              {/* Staat er al een speeldag op deze dag? Dan is dat geen verbod —
                  twee groepen plannen los van elkaar — maar wel iets wat je wil
                  weten vóór je hem aantikt. Zelfde stip als in het maandraster,
                  dat pal achter dit sheet ligt. */}
              {bezet && <span className="day-chip__bezet" aria-hidden="true" />}
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
        {/* Laadvorm (#1308): zolang het banenvenster onderweg is stond hier
            hooguit één chip, en zodra het antwoord kwam sprongen er zeven dagen
            bij. Een bottom sheet groeit naar bóven, dus dat is precies de
            stuiter die je onder je duim voelt. Deze chips houden hun plek vrij
            — zelfde maat, zelfde aantal — zoals RasterSkeleton dat voor het
            maandraster doet. */}
        {weekLoading &&
          Array.from({ length: Math.max(0, 7 - dagen.length) }).map((_, i) => (
            <span className="day-chip day-chip--skelet" key={`skelet-${i}`} aria-hidden="true" />
          ))}
      </div>

      {/* Standaard avond-focus; deze knop klapt de vroegere uren uit/in. Boven
          het raster en niet erin (#1308): als flex-item in het raster moest hij
          kiezen tussen een volle regel (een pil van 348px met vier woorden
          erin) en een plek náást de eerste slotchip. */}
      {(hasEarlier || (wholeDay && !manual)) && (
        <p className="poll-wizard__slot-kop">
          <button
            type="button"
            className="btn btn--sm poll-wizard__earlier"
            onClick={() => setWholeDay((v) => !v)}
            aria-expanded={wholeDay}
          >
            {wholeDay ? "↓ Alleen avonduren" : "↑ Vroegere uren tonen"}
          </button>
        </p>
      )}

      {/* Uren van de gekozen dag. */}
      <div className="poll-wizard__slots">
        {weekLoading && (
          <>
            {/* Dezelfde reservering als in de dagstrip hierboven: het raster
                komt zo, en de sheet hoort er niet voor te verspringen. */}
            <span className="sr-only">Vrije banen laden…</span>
            {/* Tien: een gewone avond levert er acht tot elf tussen 17:00 en
                22:00, dus dit zit het dichtst bij wat er straks staat. */}
            {Array.from({ length: 10 }).map((_, i) => (
              <span className="slot-chip slot-chip--skelet" key={`skelet-${i}`} aria-hidden="true" />
            ))}
          </>
        )}
        {!weekLoading && dayStartsVisible == null && (
          <p className="empty">
            {selectedDay === initialDay && buitenVenster
              ? "Zo ver vooruit zijn de vrije banen nog niet bekend — zet het uur hieronder zelf vast."
              : "Geen beschikbaarheidsgegevens voor deze dag."}
          </p>
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
              // Het cijfer erin plakte in de naam aan de tijd vast ("20:001
              // baan vrij") en zei sowieso niet wát er één was (#1308). Eén
              // expliciete naam lost allebei op; de legenda onder het raster
              // doet hetzelfde werk voor het oog.
              aria-label={
                manual
                  ? s.time
                  : `${s.time} — ${s.courts.length} ${s.courts.length === 1 ? "baan" : "banen"} vrij`
              }
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

      {/* Wat het cijfer op een slot betekent (#1308). "21:30 ①" was zonder
          uitleg een raadsel: één wat — banen, plekken, euro's? Eén regel, en
          alleen waar de cijfers ook echt staan. Tijdens het laden staat hij er
          leeg: anders komt er ná het antwoord een regel bij en schuift het
          sheet alsnog omhoog. */}
      {!manual && (weekLoading || (dayStartsVisible?.length ?? 0) > 0) && (
        <p className="poll-wizard__legenda">
          {weekLoading ? "\u00a0" : "Het cijfer is het aantal vrije banen op dat uur."}
        </p>
      )}

      <div className="poll-wizard__controls">
        {/* De avond/vroeger-toggle staat nu boven het raster (poll-wizard__earlier).
            Banen-verkenning in context (#106): opent de Banen-pagina in de app
            zelf met de gekozen dag al ingesteld — swipe/ga terug en de wizard
            staat er nog, mét je selectie (sessionStorage). Niet bij een
            handmatige locatie: daar is geen Playtomic-banenpagina (#322). */}
        {!manual && (
          <Link
            className="btn btn--sm poll-wizard__banen-link"
            to={`/banen?datum=${selectedDay}`}
          >
            Verken alle vrije banen →
          </Link>
        )}
        {/* De duur geldt voor de momenten die je hierná aantikt (#1308). Elk
            gekozen moment houdt de duur waarmee het gekozen is — dat kan de
            database ook (`play_poll_options.duration` staat per rij), en het is
            legitiem: vrijdag 60 minuten omdat er niets anders vrij is, zondag
            90. Wat ontbrak was dat je het zág: de chip in de voet noemde de
            duur niet, dus je startte een speeldag van 90 terwijl het scherm
            120 zei. */}
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
      {gemengdeDuur && (
        <p className="poll-wizard__duur-uitleg">
          De duur geldt voor wat je hierna kiest; gekozen momenten houden de
          hunne.
        </p>
      )}

      {/* Verder vooruit dan het banenvenster (#1308). Was een uitklap met twee
          lege systeemvelden en een uitgegrijsde knop: "Ander moment (verder
          vooruit)" zei niet dat hier de enige weg lag naar een dag over twee
          weken. Nu een gewone stap met een voorgevulde datum — alleen het uur
          is nog aan jou. */}
      <details
        className="poll-wizard__manual-details"
        open={manualOpen}
        onToggle={(e) => setManualOpen(e.currentTarget.open)}
      >
        <summary>Verder vooruit plannen — datum zelf kiezen</summary>
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
            Zo ver vooruit weten we de vrije banen nog niet; bij het moment
            staat dan &ldquo;beschikbaarheid onbekend&rdquo; — dezelfde woorden
            als in de agenda.
          </p>
        </div>
      </details>

      {/* Sticky selectiebalk: gekozen momenten + start-knop altijd in beeld.
          Draagt sinds #1083 het glasmateriaal als balk — zie Proposals.css. */}
      <div className="wizard-footer glas glas--sterk glas--balk">
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
                aria-label={`${shortDay(o.date)} ${o.startTime}, ${duurLabel(o.duration)} — verwijderen`}
                onClick={() => {
                  setArmed(false);
                  setPicked((cur) => {
                    const next = new Map(cur);
                    next.delete(optKey(o));
                    return next;
                  });
                }}
              >
                <span aria-hidden="true">
                  {shortDay(o.date)} {o.startTime} · {duurLabel(o.duration)}
                  {o.courtsFree == null ? " ?" : ""} ×
                </span>
              </button>
            ))}
        </div>
        {armed && hint && (
          <p className="proposal-form__note proposal-form__note--warn" role="alert">
            ⚠ {hint} Tik nogmaals om te bevestigen.
          </p>
        )}
        {/* Zelfde vorm als elke andere sheet-voet in de app (#1144, #1308):
            annuleren links, de hoofdactie rechts, allebei op volle hoogte. Dit
            was een rij `btn--sm` met de hoofdactie vooraan — 40px hoog, terwijl
            dezelfde app 44 aanhoudt, en in de omgekeerde volgorde. */}
        <div className="sheet__foot">
          {/* Annuleren is een besluit, geen omweg: het concept mag weg. Alleen
              wegnavigeren (bv. naar /banen) laat het staan (#1271). */}
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (storageKey) wisConcept(storageKey);
              onClose();
            }}
          >
            Annuleren
          </button>
          <button
            className="btn btn--primary"
            disabled={saving || picked.size === 0}
            onClick={publish}
          >
            {saving
              ? "Bezig…"
              : armed && hint
                ? "Zeker? Tik nogmaals"
                : submitLabel(picked.size)}
          </button>
        </div>
      </div>
    </div>
  );
}