import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRefetchOnFocus } from "@/lib/hooks/useRefetchOnFocus";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import {
  fetchClub,
  getClubAvailability,
  getWeekAvailability,
  bestWeekMoment,
  isStaleAvailability,
  nextFreeSlot,
  type DayAvailability,
  type WeekDay,
} from "./api";
import { useBookingUrl } from "./useBookingUrl";
import { getClub, setClub, useClub } from "./club";
import { AvailabilityUnavailable } from "@/features/availability/components/AvailabilityUnavailable";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { Timetable } from "@/features/availability/components/Timetable";
import { WeekGrid } from "@/features/availability/components/WeekGrid";
import { ShareAvailability } from "@/features/availability/components/ShareAvailability";
import { getWeekWeather } from "./weatherApi";
import {
  summarizeDay,
  summarizeParts,
  type WeatherSummary,
} from "./weatherLogic";
import { WeatherDays, WeatherParts } from "@/features/availability/components/WeatherStrip";
import { addDays, dateInZone, minutesNowInZone } from "@/lib/utils/time";
import { AvailabilityLegend } from "@/features/availability/components/AvailabilityLegend";
import {
  TimetableSkeleton,
  WeekGridSkeleton,
} from "@/features/availability/components/AvailabilitySkeleton";
import "./Availability.css";

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// "za 5 juli" — zelfde dagformaat als de deeltekst (slotShareText in api.ts).
function formatBestDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

// "22:54" vandaag (clubtijd), anders "wo 22:54" — het tijdstip waarop de
// cron de getoonde snapshot ophaalde (#405).
function formatFetchedAt(iso: string, timeZone: string): string {
  const fetched = new Date(iso);
  const sameDay =
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(fetched) ===
    dateInZone(timeZone);
  return new Intl.DateTimeFormat("nl-BE", {
    timeZone,
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fetched);
}

/**
 * Versheid van de getoonde stand (#405). Stil regeltje wanneer de data uit
 * de cron-snapshot komt; waarschuwend wanneer een verouderde snapshot het
 * vangnet was omdat Playtomic zelf niet bereikbaar is. Live data → niets.
 * Bij de week telt de oudste snapshot-dag.
 */
function FreshnessLine({ days }: { days: DayAvailability[] }) {
  const snapshots = days.filter(
    (d) => d.source === "snapshot" && d.fetchedAt != null,
  );
  if (snapshots.length === 0) return null;
  // ISO-tijdstippen sorteren lexicografisch; de oudste is de eerlijke claim.
  const oldest = snapshots.reduce((a, b) =>
    a.fetchedAt! <= b.fetchedAt! ? a : b,
  );
  const time = formatFetchedAt(oldest.fetchedAt!, oldest.timeZone);
  if (snapshots.some(isStaleAvailability)) {
    return (
      <p className="avail-fresh avail-fresh--stale">
        Live gegevens tijdelijk niet bereikbaar — stand van {time}.
      </p>
    );
  }
  return <p className="avail-fresh">Laatst bijgewerkt {time}</p>;
}

// Speelduren die Playtomic aanbiedt; null = geen filter (alle duren tonen).
const DURATION_FILTERS = [null, 60, 90, 120] as const;

// Weergavewissel als echte tabbladen (#910).
const WEERGAVE_TABS: { id: "dag" | "week"; label: string }[] = [
  { id: "dag", label: "Dag" },
  { id: "week", label: "Week" },
];

export function Availability() {
  usePageTitle("Banen");
  const club = useClub();
  // "Vandaag" in clubtijd, zodat de dagkeuze klopt vanuit elke tijdzone.
  const today = dateInZone(club.timezone);

  // Weergave, datum en duurfilter leven in de URL (?weergave=week&datum=…&
  // duur=…): deelbaar en refresh-bestendig — handig om in de vriendengroep
  // te droppen. Ongeldige of verstreken waarden vallen terug op de defaults.
  const [params, setParams] = useSearchParams();
  const view = params.get("weergave") === "week" ? "week" : "dag";
  const rawDate = params.get("datum") ?? "";
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate >= today ? rawDate : today;
  const rawDuration = Number(params.get("duur"));
  const duration = (DURATION_FILTERS as readonly (number | null)[]).includes(
    rawDuration,
  )
    ? rawDuration
    : null;

  // Gedeelde link met ?club=…: neem die club eenmalig over (de keuze leeft
  // in localStorage, niet in de URL) en haal de parameter daarna weg.
  // Ongeldig id of fetch-fout → gewoon de huidige club blijven tonen.
  const clubParam = params.get("club");
  useEffect(() => {
    if (!clubParam) return;
    let active = true;
    const clearParam = () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("club");
          return next;
        },
        { replace: true },
      );
    if (clubParam === getClub().id) {
      clearParam();
      return;
    }
    fetchClub(clubParam)
      .then((c) => {
        if (active) setClub(c);
      })
      .catch(() => {})
      .finally(() => {
        if (active) clearParam();
      });
    return () => {
      active = false;
    };
  }, [clubParam, setParams]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }
  const bookHref = useBookingUrl(club, date);
  const setDate = (d: string) => update({ datum: d === today ? null : d });
  const setDuration = (d: number | null) =>
    update({ duur: d == null ? null : String(d) });
  const setView = (v: "dag" | "week") =>
    update({ weergave: v === "week" ? "week" : null });
  // Cel in het weekoverzicht aangeklikt: door naar de dagweergave.
  const pickDay = (d: string) =>
    update({ weergave: null, datum: d === today ? null : d });

  return (
    <div>
      <div className="avail-header">
        <header className="page-head">
          <h1 className="page-title">Baanbeschikbaarheid</h1>
          <p className="page-subtitle">
            Vind direct een vrije baan. Geen excuses meer om niet te spelen!
          </p>
          <ClubPicker />
        </header>
        <a
          className="btn avail-book"
          href={bookHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="avail-book__logo"
            src="/playtomic-logo.svg"
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
            loading="lazy"
            decoding="async"
          />
          <span>Reserveren op Playtomic</span>
        </a>
      </div>

      <div className="avail-controls avail-controls--date">
        <div className="avail-quick">
          <button
            type="button"
            className={`tab ${date === today ? "is-active" : ""}`}
            onClick={() => setDate(today)}
          >
            Vandaag
          </button>
          <button
            type="button"
            className={`tab ${date === addDays(today, 1) ? "is-active" : ""}`}
            onClick={() => setDate(addDays(today, 1))}
          >
            Morgen
          </button>
        </div>
        <input
          type="date"
          className="select avail-date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
        />
        {/* De weekweergave bladert al per zeven dagen; de dagweergave had
            alleen "Vandaag"/"Morgen" en een datumveld (#920). Terug vóór
            vandaag heeft geen zin — daar is geen beschikbaarheid meer. */}
        {view === "dag" && (
          <div className="avail-quick avail-daynav">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Vorige dag"
              disabled={date <= today}
              onClick={() => setDate(addDays(date, -1))}
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Volgende dag"
              onClick={() => setDate(addDays(date, 1))}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Weergave (dag/week) + duurfilter, zoals op de Playtomic-pagina.
          De weergavekeuze is een écht tabblad — twee panelen, één zichtbaar —
          en draait daarom op de gedeelde PageTabs (#910). Het duurfilter niet:
          dat verandert niet van paneel maar filtert de inhoud, dus dat krijgt
          groep-semantiek met aria-pressed in plaats van tabs. */}
      <div className="avail-controls">
        <PageTabs
          tabs={WEERGAVE_TABS}
          value={view}
          onChange={setView}
          ariaLabel="Weergave"
          idPrefix="banen"
        />
        <div className="tabs" role="group" aria-label="Duur">
          {DURATION_FILTERS.map((d) => (
            <button
              key={d ?? "alle"}
              type="button"
              className={`tab ${duration === d ? "is-active" : ""}`}
              aria-pressed={duration === d}
              onClick={() => setDuration(d)}
            >
              {d == null ? "Alle duren" : `${d} min`}
            </button>
          ))}
        </div>
      </div>

      {/* Deze zin stond als kleine letters onderaan, terwijl hij precies
          verklaart waarom het raster soms verwarrend is (#920). Bij het filter
          waar hij over gaat dus. */}
      <p className="avail-duur-uitleg">
        Playtomic verhuurt vanaf 60 minuten, dus een korter gaatje kan als
        geboekt tonen.
      </p>

      <TabPanel id={view} idPrefix="banen">
        {view === "dag" ? (
          <DaySection date={date} today={today} duration={duration} />
        ) : (
          <WeekSection
            start={date}
            today={today}
            duration={duration}
            onPickDay={pickDay}
            onShift={(days) => {
              const next = addDays(date, days);
              setDate(next < today ? today : next);
            }}
          />
        )}
      </TabPanel>
    </div>
  );
}

function DaySection({
  date,
  today,
  duration,
}: {
  date: string;
  today: string;
  duration: number | null;
}) {
  // Clubwissel = andere data: het club-id in de deps zorgt voor een refetch.
  const club = useClub();
  const availability = useAsync<DayAvailability>(
    () => getClubAvailability(date),
    [date, club.id],
  );
  // Ververs de (Playtomic-)beschikbaarheid zodra de gebruiker terugkeert.
  useRefetchOnFocus(availability.reload);

  // Weer alleen relevant bij buitenbanen (#83); laadt async ná de banen en
  // faalt stil (null) zodat de bestaande flow er nooit op wacht.
  const hasOutdoor = (availability.data?.courts ?? []).some(
    (r) => r.court.type === "outdoor",
  );
  const weather = useAsync(
    () => (hasOutdoor ? getWeekWeather(club) : Promise.resolve(null)),
    [hasOutdoor, club.id],
  );
  const parts = summarizeParts(weather.data?.[date] ?? []);

  return (
    <>
      <p className="avail-day">{formatDay(date)}</p>

      {availability.loading ? (
        <TimetableSkeleton />
      ) : availability.error ? (
        <AvailabilityUnavailable club={club} date={date} message={availability.error} />
      ) : availability.data ? (
        <>
          {/* Vier gelijkwaardige alinea's boven het raster (#920): weer,
              versheid, eerstvolgend vrij en delen. Nu één samenvattingsblok —
              waar je voor komt bovenaan met de deelknop ernaast, de context
              (weer, versheid) er rustig onder. */}
          <div className="avail-summary">
            <div className="avail-summary__lead">
              <NextFreeLine
                data={availability.data}
                date={date}
                duration={duration}
              />
              <ShareAvailability
                mode="dag"
                data={availability.data}
                date={date}
                duration={duration}
                club={club}
              />
            </div>
            <div className="avail-summary__meta">
              {hasOutdoor && <WeatherParts parts={parts} />}
              <FreshnessLine days={[availability.data]} />
            </div>
          </div>
          <Timetable data={availability.data} date={date} duration={duration} />
        </>
      ) : null}

      <AvailabilityLegend modus="dag" toonVoorbij={date === today} />
    </>
  );
}

/** Samenvatting boven het raster: de eerstvolgende boekbare starttijd,
 *  zodat je niet zelf het hele raster hoeft af te scannen. */
function NextFreeLine({
  data,
  date,
  duration,
}: {
  data: DayAvailability;
  date: string;
  duration: number | null;
}) {
  // Zelfde "voorbij"-semantiek als het raster: vandaag (in clubtijd!) tellen
  // alleen starttijden ná nu mee.
  const isToday = date === dateInZone(data.timeZone);
  const next = nextFreeSlot(
    data,
    duration,
    isToday ? minutesNowInZone(data.timeZone) : null,
  );

  if (!next) {
    return (
      <p className="avail-next">
        {isToday ? "Vandaag helaas alles bezet." : "Geen vrije banen beschikbaar op deze dag."}
      </p>
    );
  }
  const extra = next.courts.length - 1;
  return (
    <p className="avail-next">
      Eerstvolgend vrij:{" "}
      <strong className="avail-next__time">{next.time}</strong> ·{" "}
      {next.courts[0].name}
      {extra > 0 &&
        ` (+${extra} ${extra === 1 ? "andere baan" : "andere banen"})`}
    </p>
  );
}

/** Samenvatting boven het weekraster: het moment waarop de meeste banen
 *  tegelijk vrij zijn — de weektegenhanger van NextFreeLine. Geen data of
 *  niets vrij → geen regel (de week toont fouten al per dag). */
function BestWeekLine({
  week,
  duration,
}: {
  week: WeekDay[];
  duration: number | null;
}) {
  const best = bestWeekMoment(week, duration);
  if (!best) return null;
  return (
    <p className="avail-next">
      Beste moment: {formatBestDay(best.date)} om{" "}
      <strong className="avail-next__time">{best.time}</strong> — {best.count}{" "}
      {best.count === 1 ? "baan" : "banen"} vrij
    </p>
  );
}

function WeekSection({
  start,
  today,
  duration,
  onPickDay,
  onShift,
}: {
  start: string;
  today: string;
  duration: number | null;
  onPickDay: (date: string) => void;
  onShift: (days: number) => void;
}) {
  const club = useClub();
  const week = useAsync<WeekDay[]>(() => getWeekAvailability(start), [start, club.id]);
  useRefetchOnFocus(week.reload);

  // Weer per dagkolom, alleen bij buitenbanen (#83); stil bij falen.
  const hasOutdoor = (week.data ?? []).some((d) =>
    (d.data?.courts ?? []).some((r) => r.court.type === "outdoor"),
  );
  const weather = useAsync(
    () => (hasOutdoor ? getWeekWeather(club) : Promise.resolve(null)),
    [hasOutdoor, club.id],
  );
  const weatherDays = (week.data ?? [])
    .map((d) => {
      const summary = summarizeDay(weather.data?.[d.date] ?? []);
      return summary ? { date: d.date, summary } : null;
    })
    .filter((d): d is { date: string; summary: WeatherSummary } => d !== null);

  return (
    <>
      <div className="avail-weeknav">
        <p className="avail-day">
          {formatShort(start)} – {formatShort(addDays(start, 6))}
        </p>
        <div className="avail-quick">
          <button
            type="button"
            className="btn btn--sm"
            disabled={start === today}
            onClick={() => onShift(-7)}
          >
            ← Vorige 7 dagen
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onShift(7)}
          >
            Volgende 7 dagen →
          </button>
        </div>
      </div>

      {week.loading ? (
        <WeekGridSkeleton />
      ) : week.error ? (
        <AvailabilityUnavailable club={club} date={start} message={week.error} />
      ) : week.data ? (
        <>
          <div className="avail-summary">
            <div className="avail-summary__lead">
              <BestWeekLine week={week.data} duration={duration} />
              <ShareAvailability
                mode="week"
                week={week.data}
                date={start}
                duration={duration}
                club={club}
              />
            </div>
            <div className="avail-summary__meta">
              {hasOutdoor && <WeatherDays days={weatherDays} />}
              <FreshnessLine
                days={week.data
                  .map((d) => d.data)
                  .filter((d): d is DayAvailability => d !== null)}
              />
            </div>
          </div>
          <WeekGrid week={week.data} duration={duration} onPickDay={onPickDay} />
        </>
      ) : null}

      <AvailabilityLegend
        modus="week"
        toonVoorbij={start === today}
        duration={duration}
      />
    </>
  );
}

export default Availability;
