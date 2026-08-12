import { addDays, clubEpoch, fromMinutes, toMinutes } from "@/lib/utils/time";
import { longDay } from "@/features/groups/planPollHelpers";
import type {
  PlayPoll,
  PollOption,
  PollVoteStatus,
  PollWindow,
} from "@/features/groups/pollsApi";
import { PLAYERS_PER_COURT } from "@/features/groups/pollLogic";
import type { GroupSummary } from "@/features/groups/api";

/* ------------------------------------------------------------------ */
/* Agenda (#1091): van poll-rijen naar dagen in een maandraster.       */
/*                                                                     */
/* Alles hier is puur — geen React, geen supabase — zodat het raster,   */
/* de dag-sheet en de tests dezelfde afleiding delen.                   */
/* ------------------------------------------------------------------ */

/** Wat een dag draagt. De vorm (niet de kleur) van de glyph volgt hieruit. */
export type AgendaStatus = "booked" | "locked" | "open";

export type AgendaMarker = {
  pollId: string;
  optionId: string;
  groupId: string;
  groupName: string;
  clubName: string;
  /** Playtomic-tenant en stad van de club: genoeg om er een Club van te maken
   *  en de vrije banen van dít moment op te vragen (#1121). */
  clubId: string;
  clubCity: string;
  clubTimezone: string;
  /** Kalenderdatum in clubtijd — precies zoals de kolom hem bewaart. */
  date: string;
  /** "HH:MM" in clubtijd. */
  startTime: string;
  duration: number;
  status: AgendaStatus;
  /** Slot al voorbij, gerekend in de tijdzone van díe club. */
  past: boolean;
  /** Stemde ik al op deze poll? Alleen zinvol bij een open poll. */
  iVoted: boolean;
  /** Mijn stem op dít moment; null als ik er niets over zei (#1104). Los van
   *  `iVoted`, dat over de hele poll gaat: op een poll met drie kandidaten kun
   *  je twee momenten beantwoord hebben en het derde niet. */
  myVote: PollVoteStatus | null;
  /** Aantal spelers dat op deze poll stemde (open-poll-hint). */
  voterCount: number;
  /** Spelers met "ik kan" op dít moment — de avatarstapel in het detail. */
  yesVoterIds: string[];
  /** Spelers met "misschien" op dít moment (#1121). Juist bij "nog één speler
   *  nodig" wil je weten wie je nog kunt porren — de Plannen-tab toonde die
   *  rij wel, de agenda niet. */
  maybeVoterIds: string[];
  /** Groepsleden die op deze poll nog helemaal niets zeiden. Per poll en niet
   *  per moment: wie één kandidaat beantwoordde, heeft gestemd. */
  nietGestemdIds: string[];
  /** Geboekte banen (#802) en toegangscode (#675); null zolang onbekend. */
  courts: string | null;
  accessCode: string | null;
  /** Laatste wijziging aan deze speeldag — voedt de SEQUENCE van de .ics
   *  (#1099), zodat een herimport het bestaande event bijwerkt. */
  changedAt: string;
};

/**
 * De kalenderdag van een speeldag komt uit `play_poll_options.date` en niet uit
 * een timestamp: die kolom bewaart de dag al in clubtijd, met `start_time` als
 * kloktijd van diezelfde club. Er valt hier dus niets te converteren — een
 * `dayInZone` over `created_at` zou juist een fout introduceren.
 *
 * Waar de tijdzone wél telt is "is dit al geweest?": dat is een vergelijking
 * met nu, en die moet per poll in de zone van díe club (#783). Vandaar
 * `clubEpoch` met `poll.club_timezone` hieronder.
 */
function isPast(option: PollOption, timeZone: string, nowMs: number): boolean {
  return (
    clubEpoch(option.date, option.start_time, timeZone) +
      option.duration * 60_000 <
    nowMs
  );
}

/**
 * Dezelfde vraag, maar voor een marker die al gebouwd is (#1104). `past` is
 * bevroren op het moment dat het venster geladen werd, en een dag-sheet kan
 * lang openstaan — over dat ene moment heen dat er nog te stemmen viel. Wie
 * stemknoppen toont, moet de vraag opnieuw stellen in plaats van `past` te
 * geloven.
 */
export function momentVoorbij(m: AgendaMarker, nowMs: number): boolean {
  return (
    clubEpoch(m.date, m.startTime, m.clubTimezone) + m.duration * 60_000 < nowMs
  );
}

/**
 * Markers van één venster.
 *
 * Vastgelegde en geboekte speeldagen leveren precies hun gekozen moment; een
 * open poll levert al zijn kandidaat-momenten, want dat is wat er te zien valt:
 * een vraag met meerdere antwoorden. Geannuleerde polls vallen weg.
 *
 * Een verlopen kandidaat-moment van een open poll valt óók weg: dat is een
 * vraag waar nooit iets van kwam, en op een kalender is dat ruis. Een geboekte
 * of vastgelegde dag in het verleden blijft juist staan — daar is gepadeld.
 *
 * Bewust géén `pollExpired`-filter: dat kijkt naar álle momenten van een poll,
 * en een venster bevat er soms maar een deel (een poll rond een maandgrens).
 * De vraag "is dit moment geweest?" is per moment te beantwoorden en heeft dat
 * probleem niet.
 */
export function buildMarkers(
  window: PollWindow,
  groups: GroupSummary[],
  myId: string,
  nowMs: number,
): AgendaMarker[] {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const groupMembers = new Map(groups.map((g) => [g.id, g.member_ids]));
  const pollById = new Map<string, PlayPoll>(
    window.polls.map((p) => [p.id, p]),
  );

  // Stemmen per moment, per poll wie er stemde, en mijn eigen stem per moment:
  // één doorloop i.p.v. een filter per marker (een maandvenster kan honderden
  // stemmen dragen).
  const yesByOption = new Map<string, string[]>();
  const maybeByOption = new Map<string, string[]>();
  const votersByPoll = new Map<string, Set<string>>();
  const mineByOption = new Map<string, PollVoteStatus>();
  const optionPoll = new Map(window.options.map((o) => [o.id, o.poll_id]));
  for (const vote of window.votes) {
    if (vote.status === "yes") {
      const list = yesByOption.get(vote.option_id);
      if (list) list.push(vote.player_id);
      else yesByOption.set(vote.option_id, [vote.player_id]);
    }
    if (vote.status === "maybe") {
      const list = maybeByOption.get(vote.option_id);
      if (list) list.push(vote.player_id);
      else maybeByOption.set(vote.option_id, [vote.player_id]);
    }
    if (vote.player_id === myId) mineByOption.set(vote.option_id, vote.status);
    const pollId = optionPoll.get(vote.option_id);
    if (pollId == null) continue;
    const voters = votersByPoll.get(pollId);
    if (voters) voters.add(vote.player_id);
    else votersByPoll.set(pollId, new Set([vote.player_id]));
  }

  const markers: AgendaMarker[] = [];
  for (const option of window.options) {
    const poll = pollById.get(option.poll_id);
    if (!poll || poll.status === "cancelled") continue;

    const vastgelegd = poll.status === "booked" || poll.status === "locked";
    // Bij een vastgelegde poll telt alleen het gekozen moment; de afgevallen
    // kandidaten zijn geen speeldag meer.
    if (vastgelegd && poll.locked_option_id !== option.id) continue;

    const past = isPast(option, poll.club_timezone, nowMs);
    if (!vastgelegd && past) continue;

    const voters = votersByPoll.get(poll.id);
    markers.push({
      pollId: poll.id,
      optionId: option.id,
      groupId: poll.group_id,
      groupName: groupName.get(poll.group_id) ?? "Groep",
      clubName: poll.club_name,
      clubId: poll.club_id,
      clubCity: poll.club_city ?? "",
      clubTimezone: poll.club_timezone,
      date: option.date,
      startTime: option.start_time,
      duration: option.duration,
      status: vastgelegd ? (poll.status as AgendaStatus) : "open",
      past,
      iVoted: voters?.has(myId) ?? false,
      myVote: mineByOption.get(option.id) ?? null,
      voterCount: voters?.size ?? 0,
      yesVoterIds: yesByOption.get(option.id) ?? [],
      maybeVoterIds: maybeByOption.get(option.id) ?? [],
      nietGestemdIds: (groupMembers.get(poll.group_id) ?? []).filter(
        (id) => !voters?.has(id),
      ),
      courts: poll.courts,
      accessCode: poll.access_code,
      // Boeken is de laatste stap, vastleggen de stap ervoor; zonder beide is
      // de poll sinds het aanmaken niet meer van fase veranderd.
      changedAt: poll.booked_at ?? poll.locked_at ?? poll.created_at,
    });
  }
  return markers;
}

/**
 * Alleen de speeldagen van de gekozen groepen (#1121); een lege keuze is
 * "alles".
 *
 * Bewust hier en niet in de query: `getPollWindow` haalt het venster toch al
 * voor al je groepen op, dus schakelen kost geen ronde naar de server en de
 * cache blijft één entry per maand.
 */
export function filterOpGroepen(
  markers: AgendaMarker[],
  groepIds: string[],
): AgendaMarker[] {
  if (groepIds.length === 0) return markers;
  const gekozen = new Set(groepIds);
  return markers.filter((m) => gekozen.has(m.groupId));
}

/**
 * De onthouden filterkeuze, ontdaan van groepen die je intussen verlaten hebt.
 * Zonder die schoonmaak zou een oude id de agenda leeg houden zonder dat er nog
 * een chip staat om hem uit te zetten.
 */
export function leesGroepKeuze(
  bewaard: string | null,
  geldigeIds: string[],
): string[] {
  if (!bewaard) return [];
  const bekend = new Set(geldigeIds);
  return bewaard.split(",").filter((id) => bekend.has(id));
}

/** Volgorde binnen een dag: op tijd, dan op groep — stabiel tussen renders. */
function byTime(a: AgendaMarker, b: AgendaMarker): number {
  return (
    a.startTime.localeCompare(b.startTime) || a.groupName.localeCompare(b.groupName)
  );
}

/** Markers per kalenderdag, elke dag op tijd gesorteerd. */
export function markersByDay(
  markers: AgendaMarker[],
): Record<string, AgendaMarker[]> {
  const out: Record<string, AgendaMarker[]> = {};
  for (const m of markers) (out[m.date] ??= []).push(m);
  for (const day of Object.values(out)) day.sort(byTime);
  return out;
}

/**
 * Wat er op één dag staat, geteld in speeldagen in plaats van in momenten
 * (#1182).
 *
 * Een open poll levert één marker per kandidaat-moment, en twee van die
 * kandidaten kunnen op dezelfde dag vallen ("20:00 of 21:30, zeg het maar").
 * In het raster blijven dat twee stippen — daar zijn het antwoorden op een
 * vraag — maar in het dagpaneel is het één speeldag waar je één keer op tikt.
 * Twee kaarten die alleen in tijd verschillen lezen als twee afspraken.
 */
export type DagItem = {
  /** Het eerste moment; draagt groep, club, status en de gedeelde tekst. */
  eerste: AgendaMarker;
  /** Alle momenten van dezelfde poll op déze dag, op tijd. */
  momenten: AgendaMarker[];
};

/** Markers van één dag, gebundeld per poll. Volgorde blijft die van de dag
 *  zelf: de bundel staat waar zijn vroegste moment stond. */
export function dagItems(markers: AgendaMarker[]): DagItem[] {
  const perPoll = new Map<string, AgendaMarker[]>();
  for (const m of markers) {
    const lijst = perPoll.get(m.pollId);
    if (lijst) lijst.push(m);
    else perPoll.set(m.pollId, [m]);
  }
  return [...perPoll.values()].map((momenten) => ({
    eerste: momenten[0],
    momenten,
  }));
}

/** De tijden van een gebundelde speeldag: "20:00" of "20:00, 21:30 of 22:00".
 *  Het zijn keuzes, geen opeenvolgende blokken — vandaar "of". */
export function tijdenLabel(momenten: AgendaMarker[]): string {
  const tijden = momenten.map((m) => m.startTime);
  if (tijden.length === 1) return tijden[0];
  return `${tijden.slice(0, -1).join(", ")} of ${tijden[tijden.length - 1]}`;
}

/**
 * Wie er op deze dag kan: iedereen die op minstens één van de momenten "ik kan"
 * zei. Bij één moment is dat gewoon zijn eigen lijst.
 *
 * Per moment optellen zou dubbeltellen (dezelfde speler kan op allebei), en de
 * hoogste lijst nemen verzwijgt wie alleen op het andere tijdstip kan.
 */
export function kannersOpDag(momenten: AgendaMarker[]): string[] {
  const uit: string[] = [];
  const gezien = new Set<string>();
  for (const m of momenten) {
    for (const id of m.yesVoterIds) {
      if (gezien.has(id)) continue;
      gezien.add(id);
      uit.push(id);
    }
  }
  return uit;
}

/**
 * De eerstvolgende speeldagen ná een datum (#1112) — de "Hierna"-lijst onder een
 * lege dag.
 *
 * Strikt ná: een speeldag op de gekozen dag zelf staat al in het paneel erboven,
 * en die daar nog eens herhalen leest als twee verschillende afspraken. Een dag
 * die geweest is valt weg, ook als hij later in de lijst zou vallen — je kunt er
 * niet meer heen.
 */
export function volgendeSpeeldagen(
  markers: AgendaMarker[],
  na: string,
  max = 3,
): AgendaMarker[] {
  return markers
    .filter((m) => m.date > na && !m.past)
    .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b))
    .slice(0, max);
}

/**
 * Alles wat er nog aankomt, als speeldagen op volgorde (#1182) — de bron van de
 * lijstweergave.
 *
 * Het maandraster beantwoordt "wat staat er in augustus"; deze lijst
 * beantwoordt "wat komt eraan", en dat is een andere vraag: hij houdt niet op
 * bij de maandgrens. Vandaag telt mee — een speeldag van vanavond is nog
 * helemaal niet voorbij.
 */
export function komendeItems(
  markers: AgendaMarker[],
  vanaf: string,
  max = 40,
): DagItem[] {
  const perDag = markersByDay(markers.filter((m) => m.date >= vanaf && !m.past));
  return Object.keys(perDag)
    .sort()
    .flatMap((dag) => dagItems(perDag[dag]))
    .slice(0, max);
}

/** Speeldagen gegroepeerd per maand, in dezelfde volgorde als ze binnenkwamen —
 *  de kopjes van de lijstweergave. */
export function perMaand(items: DagItem[]): { maand: Maand; items: DagItem[] }[] {
  const uit: { maand: Maand; items: DagItem[] }[] = [];
  for (const item of items) {
    const maand = maandVan(item.eerste.date);
    const laatste = uit[uit.length - 1];
    if (laatste && zelfdeMaand(laatste.maand, maand)) laatste.items.push(item);
    else uit.push({ maand, items: [item] });
  }
  return uit;
}

/** Een speeldag die op jouw antwoord wacht. */
export type OpenVraag = {
  pollId: string;
  /** De vroegste dag van deze poll die nog komt — daar spring je heen. */
  date: string;
  groupName: string;
};

/**
 * Welke polls op jóuw stem wachten (#1182).
 *
 * De kaart zegt dit al per speeldag ("Jij moet nog stemmen"), maar alleen op de
 * dag die je toevallig aangetikt hebt. In een maand met drie open polls zie je
 * in het raster enkel stippen; hiermee staat er bovenaan wat er van je gevraagd
 * wordt.
 *
 * Per poll en niet per moment: `iVoted` is de poll-brede waarheid, en wie één
 * kandidaat beantwoordde heeft de vraag beantwoord.
 */
export function wachtOpJou(markers: AgendaMarker[], vanaf: string): OpenVraag[] {
  const perPoll = new Map<string, OpenVraag>();
  for (const m of markers) {
    if (m.status !== "open" || m.past || m.iVoted || m.date < vanaf) continue;
    const bestaand = perPoll.get(m.pollId);
    if (bestaand == null || m.date < bestaand.date) {
      perPoll.set(m.pollId, {
        pollId: m.pollId,
        date: m.date,
        groupName: m.groupName,
      });
    }
  }
  return [...perPoll.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* Het raster zelf.                                                    */
/* ------------------------------------------------------------------ */

/** Actief maandvenster; `maand` is 1-12, niet de 0-gebaseerde JS-maand. */
export type Maand = { jaar: number; maand: number };

export type RasterDag = { date: string; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");

/** Weekdag als index met maandag = 0. */
function weekdayIndex(date: string): number {
  // 's Middags, zodat een DST-omschakeling de dag niet kantelt (repo-conventie).
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

/** Aantal dagen in een maand (1-12). */
export function daysInMonth({ jaar, maand }: Maand): number {
  // Dag 0 van de vólgende maand = laatste dag van deze; in UTC zodat de
  // browserzone er niet tussen komt.
  return new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
}

/**
 * Het maandraster: hele weken van maandag t/m zondag, met de rand-dagen van de
 * vorige en volgende maand erbij. Vijf of zes rijen, afhankelijk van de maand.
 */
export function monthGrid(m: Maand): RasterDag[][] {
  const first = `${m.jaar}-${pad(m.maand)}-01`;
  const last = `${m.jaar}-${pad(m.maand)}-${pad(daysInMonth(m))}`;
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));

  const weeks: RasterDag[][] = [];
  let cursor = start;
  while (cursor <= end) {
    const week: RasterDag[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor >= first && cursor <= last });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * De buitenste datums van het raster — inclusief de rand-dagen, want die tonen
 * hun markers gewoon mee. Dit is wat je op het scherm ziet staan.
 */
export function windowFor(m: Maand): { from: string; to: string } {
  const weeks = monthGrid(m);
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date };
}

/** Hoeveel dagen we voorbij het raster ophalen. Zes weken: genoeg om in een
 *  lege maand nog drie speeldagen te vinden, en klein genoeg om één query te
 *  blijven. */
const STAART_DAGEN = 42;

/**
 * Het datumvenster dat `getPollWindow` opvraagt (#1112).
 *
 * Ruimer dan het raster, want "Hierna" kijkt vooruit voorbij de laatste rij —
 * in een lege maand staat de eerstvolgende speeldag per definitie buiten beeld.
 * Wat in die staart valt komt nooit in een cel terecht (het raster tekent
 * alleen zijn eigen weken) en telt ook niet mee in "activiteiten deze maand".
 *
 * Bewust een ánder venster dan `windowFor`: de toetsenbordnavigatie gebruikt de
 * rastergrenzen om te weten wanneer ze een maand moet doorbladeren, en die vraag
 * heeft niets te maken met hoeveel we ophalen.
 */
export function ophaalVenster(m: Maand): { from: string; to: string } {
  const raster = windowFor(m);
  return { from: raster.from, to: addDays(raster.to, STAART_DAGEN) };
}

/** De maand waarin een datum valt. */
export function maandVan(date: string): Maand {
  return { jaar: Number(date.slice(0, 4)), maand: Number(date.slice(5, 7)) };
}

/** Maand vooruit/achteruit, met jaarwissel. */
export function schuifMaand({ jaar, maand }: Maand, delta: number): Maand {
  const totaal = jaar * 12 + (maand - 1) + delta;
  return { jaar: Math.floor(totaal / 12), maand: (totaal % 12) + 1 };
}

export const zelfdeMaand = (a: Maand, b: Maand) =>
  a.jaar === b.jaar && a.maand === b.maand;

/**
 * Hoeveel speeldagen er in de zichtbare maand staan (#1112) — de subregel onder
 * de maandtitel.
 *
 * Telt op de máánd en niet op het venster: het raster toont ook de randdagen van
 * de buurmaanden, en die horen niet mee in "3 activiteiten deze maand".
 *
 * Telt polls en geen markers (#1182): een open poll met drie voorstellen is één
 * vraag om te spelen, niet drie activiteiten. Een poll die over een maandgrens
 * heen loopt telt in beide maanden mee — in allebei staat er iets.
 */
export function telInMaand(markers: AgendaMarker[], m: Maand): number {
  const prefix = `${m.jaar}-${pad(m.maand)}-`;
  const polls = new Set<string>();
  for (const x of markers) if (x.date.startsWith(prefix)) polls.add(x.pollId);
  return polls.size;
}

/** "augustus 2026" — de kop boven het raster. */
export function maandLabel({ jaar, maand }: Maand): string {
  return new Intl.DateTimeFormat("nl-BE", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${jaar}-${pad(maand)}-01T12:00:00`));
}

/** Zelfde dagnummer een maand verder of terug; een kortere maand kapt af
 *  (31 maart → PageDown → 30 april). */
export function zelfdeDagAndereMaand(date: string, delta: number): string {
  const m = schuifMaand(maandVan(date), delta);
  const dag = Math.min(Number(date.slice(8)), daysInMonth(m));
  return `${m.jaar}-${pad(m.maand)}-${pad(dag)}`;
}

/**
 * Toetsenbordnavigatie door het raster: links/rechts ±1 dag, boven/onder ±1
 * week, Home/End naar de rand van de week, PageUp/PageDown een maand. Geeft
 * null voor een toets die het raster niet kent, zodat de aanroeper hem gewoon
 * doorlaat.
 */
export function toetsStap(date: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(date, -1);
    case "ArrowRight":
      return addDays(date, 1);
    case "ArrowUp":
      return addDays(date, -7);
    case "ArrowDown":
      return addDays(date, 7);
    case "Home":
      return addDays(date, -weekdayIndex(date));
    case "End":
      return addDays(date, 6 - weekdayIndex(date));
    case "PageUp":
      return zelfdeDagAndereMaand(date, -1);
    case "PageDown":
      return zelfdeDagAndereMaand(date, 1);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Labels.                                                             */
/* ------------------------------------------------------------------ */

const STATUS_WOORD: Record<AgendaStatus, string> = {
  booked: "geboekt",
  locked: "vastgelegd, nog te boeken",
  open: "open poll",
};

/** "20:00 — 21:30": het tijdvak van een moment. Een slot dat over middernacht
 *  loopt telt gewoon door naar de kleine uurtjes. */
export function tijdvak(startTime: string, duration: number): string {
  return `${startTime} — ${fromMinutes((toMinutes(startTime) + duration) % 1440)}`;
}

/** Het statuswoord zoals het in badges en legenda staat. */
export function statusLabel(status: AgendaStatus, past = false): string {
  if (past) return "gespeeld";
  return status === "locked" ? "vastgelegd" : STATUS_WOORD[status];
}

/**
 * Alleen de eerste letter groot (#1112).
 *
 * Nadrukkelijk niet `text-transform: capitalize`: dat maakt van "open poll"
 * "Open Poll" en van "zondag 9 augustus" "Zondag 9 Augustus" — in het
 * Nederlands blijven maandnamen en het tweede woord gewoon klein.
 */
export function metHoofdletter(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** Het statuswoord zoals het in een chip of legenda staat: "Open poll". */
export function statusChip(status: AgendaStatus, past = false): string {
  return metHoofdletter(statusLabel(status, past));
}

/**
 * Waar wacht deze speeldag op? (#1121)
 *
 * De Plannen-tab had hiervoor een fasebalk met één next-action-zin, maar die
 * praatte over precies één "focus-poll". In een agenda over al je groepen heen
 * bestaat die niet: er kunnen er drie tegelijk lopen, elk in een andere fase.
 * Vandaar per speeldag, en afgeleid uit wat de marker al draagt.
 *
 * Een dag die geweest is wacht nergens meer op en krijgt niets.
 */
export function volgendeStap(m: AgendaMarker): string | null {
  if (m.past) return null;
  if (m.status === "open") {
    // Jouw eigen stem eerst: dat is het enige waar jij iets aan kunt doen.
    if (m.myVote == null) return "Jij moet nog stemmen.";
    const wacht = m.nietGestemdIds.length;
    if (wacht > 0)
      return `Wacht op ${wacht} ${wacht === 1 ? "lid" : "leden"} van de groep.`;
    return "Alle stemmen zijn binnen — het moment wordt gekozen.";
  }
  if (m.status === "locked") return "De baan moet nog geboekt worden.";
  const tekort = PLAYERS_PER_COURT - m.yesVoterIds.length;
  if (tekort > 0)
    return `Nog ${tekort} bevestigde ${tekort === 1 ? "speler" : "spelers"} nodig voor wedstrijden.`;
  return "Alles staat vast.";
}

/**
 * Hoe lang een speeldag duurt, als losse regel naast de begintijd (#1112).
 * Hele uren lezen als uren ("2 uur"), de rest blijft in minuten ("90 min") —
 * "1,5 uur" is precies de omrekening die je niet wil moeten maken.
 */
export function duurLabel(duration: number): string {
  if (duration % 60 !== 0) return `${duration} min`;
  const uren = duration / 60;
  return uren === 1 ? "1 uur" : `${uren} uur`;
}

/**
 * De toegankelijke naam van een dagknop. Het raster is een raster: elke dag
 * vertelt zelf wat erop staat, inclusief de status in woorden — de glyph-vorm
 * alleen is geen naam (WCAG 1.4.1 én 4.1.2).
 */
export function dagLabel(
  date: string,
  markers: AgendaMarker[],
  /** Een dag die geweest is nodigt niet uit om te plannen (#1091). */
  verleden = false,
): string {
  const dag = longDay(date);
  if (markers.length === 0) {
    return verleden
      ? `${dag}, niets gespeeld`
      : `${dag}, niets gepland, plan een speeldag`;
  }
  // Bij een open poll hoort de stemstand erbij: de brede cel zegt "stem" of
  // "jij ✓" (markerHint), en een naam die dat verzwijgt spreekt de cel tegen.
  const beschrijf = (m: AgendaMarker) =>
    `speeldag ${statusLabel(m.status, m.past)} om ${m.startTime}, ${m.groupName}, ${m.clubName}` +
    (m.status === "open" && !m.past
      ? m.myVote
        ? ", jij stemde al"
        : ", jij stemde nog niet"
      : "");
  if (markers.length === 1) return `${dag}, ${beschrijf(markers[0])}`;
  return `${dag}, ${markers.length} speeldagen: ${markers.map(beschrijf).join("; ")}`;
}

/** Wat een cel toont en wat er onder "+N" verdwijnt. De "+N" is een regel van
 *  9px onder de markers, geen marker-plek — vandaar het kale afkappen. */
export function splitMarkers(
  markers: AgendaMarker[],
  max: number,
): { shown: AgendaMarker[]; extra: number } {
  if (markers.length <= max) return { shown: markers, extra: 0 };
  return { shown: markers.slice(0, max), extra: markers.length - max };
}
