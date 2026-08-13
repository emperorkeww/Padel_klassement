import {
  addDays,
  clubEpoch,
  dayInZone,
  fromMinutes,
  toMinutes,
} from "@/lib/utils/time";
import { longDay } from "@/features/groups/planPollHelpers";
import { hoortBijMoment } from "@/features/groups/speeldagMatches";
import { laatsteWijziging } from "@/features/groups/speeldagIcs";
import type {
  PlayPoll,
  PollOption,
  PollVoteStatus,
  PollWindow,
} from "@/features/groups/pollsApi";
import { PLAYERS_PER_COURT, momentEindeMs } from "@/features/groups/pollLogic";
import type { GroupSummary } from "@/features/groups/api";

/* ------------------------------------------------------------------ */
/* Agenda (#1091): van poll-rijen naar dagen in een maandraster.       */
/*                                                                     */
/* Alles hier is puur — geen React, geen supabase — zodat het raster,   */
/* de dag-sheet en de tests dezelfde afleiding delen.                   */
/*                                                                     */
/* De eenheid (#1270). Eén poll is één speeldag; één kandidaat-moment   */
/* is één antwoordoptie op die ene vraag. Dat onderscheid stond nergens */
/* opgeschreven, en dus telde elke plek iets anders: de maandkop polls, */
/* de lijstkop dag-bundels, het paneel losse momenten. Met dezelfde     */
/* drie polls op het scherm stond er "3 activiteiten", "5 speeldagen"   */
/* en drie wegwijzers naar dezelfde zaterdag.                           */
/*                                                                     */
/* Vandaar: het maandraster tekent mómenten (daar zijn het zichtbare    */
/* antwoorden waar je uit kiest), en alles wat in wóórden over          */
/* speeldagen praat — koppen, tellingen, kaarten, wegwijzers — telt     */
/* polls. `speeldagItems` is de ene bundelaar die dat afdwingt.         */
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
   *  per moment: wie één kandidaat beantwoordde, heeft gestemd. Jezelf staat
   *  er nooit bij (#1270): "Nog niets gezegd" zette je eigen naam vooraan in
   *  een rij die je vertelt wie je nog kunt porren, pal onder een zin die je
   *  al aansprak met "Jij moet nog stemmen". */
  nietGestemdIds: string[];
  /** Geboekte banen (#802) en toegangscode (#675); null zolang onbekend. */
  courts: string | null;
  accessCode: string | null;
  /** Vrije banen zoals ze bij het aanmaken van dit moment geteld werden — een
   *  momentopname, geen live getal (#1233). Het dag-sheet zet 'm meteen neer en
   *  laat de live-telling hem stil vervangen; zonder die startwaarde kwam er een
   *  chipregel bij nádat het sheet al openstond, en groeide het sheet naar boven
   *  weg onder je vinger. Dezelfde terugval als PollCard.liveFree(). */
  courtsFree: number | null;
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
 * `momentEindeMs` met `poll.club_timezone` hieronder — dezelfde helper die de
 * stemkaart op het overzicht gebruikt (#1196).
 */
function isPast(option: PollOption, timeZone: string, nowMs: number): boolean {
  return (
    momentEindeMs(option.date, option.start_time, option.duration, timeZone) <
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
  return momentEindeMs(m.date, m.startTime, m.duration, m.clubTimezone) < nowMs;
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
        (id) => id !== myId && !voters?.has(id),
      ),
      courts: poll.courts,
      accessCode: poll.access_code,
      courtsFree: option.courts_free,
      // De jongste van boeken, vastleggen en aanmaken: een verzet moment schuift
      // `locked_at` op nadat `booked_at` er al stond (#1271).
      changedAt: laatsteWijziging(poll),
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

/**
 * Waarover een telling gaat zolang er chips aanstaan (#1270) — de staart achter
 * "3 speeldagen deze maand".
 *
 * Het filter was in de koppen onzichtbaar: met één chip aan kon er "Geen
 * speeldagen deze maand" staan terwijl de maand vol stond, en niets in die zin
 * verwees naar de chiprij erboven.
 *
 * Eén groep krijgt zijn naam, meer krijgen een telling: drie namen achter elkaar
 * passen niet op 390px, en dan is "waar gaat dit getal over" nuttiger dan "welke
 * precies" — dat zeggen de chips zelf al. Alles aan is hetzelfde als niets aan,
 * en daar valt niets te vermelden.
 */
export function filterLabel(
  gekozenIds: string[],
  groepen: { id: string; name: string }[],
): string | null {
  if (gekozenIds.length === 0 || gekozenIds.length >= groepen.length) return null;
  if (gekozenIds.length === 1) {
    return groepen.find((g) => g.id === gekozenIds[0])?.name ?? null;
  }
  return `${gekozenIds.length} van je ${groepen.length} groepen`;
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
 * Markers gebundeld tot speeldagen, over de dagen heen (#1270).
 *
 * Eén item per poll, en dat item staat op de vróegste dag die de poll nog
 * voorstelt: daar spring je heen, en de andere voorgestelde dagen zijn geen
 * tweede speeldag maar een tweede antwoord op dezelfde vraag. `dagItems`
 * bundelt binnen één dag; dit is dezelfde regel, maar dan over een hele lijst.
 *
 * `momenten` houdt zich aan wat een `DagItem` belooft — de momenten van díe ene
 * dag — dus een poll die ook een andere dag voorstelt draagt die tijd hier niet.
 * Dat is met opzet: "za 15 · 20:00 of 11:00" zou twee tijden op één zaterdag
 * beloven terwijl die tweede op zondag ligt. Wie de hele vraag wil zien, tikt de
 * speeldag aan.
 */
export function speeldagItems(markers: AgendaMarker[]): DagItem[] {
  const perPoll = new Map<string, AgendaMarker[]>();
  for (const m of markers) {
    const lijst = perPoll.get(m.pollId);
    if (lijst) lijst.push(m);
    else perPoll.set(m.pollId, [m]);
  }

  const items: DagItem[] = [];
  for (const momenten of perPoll.values()) {
    const eersteDag = momenten.reduce(
      (dag, m) => (m.date < dag ? m.date : dag),
      momenten[0].date,
    );
    const opDieDag = momenten.filter((m) => m.date === eersteDag).sort(byTime);
    items.push({ eerste: opDieDag[0], momenten: opDieDag });
  }
  return items.sort(
    (a, b) =>
      a.eerste.date.localeCompare(b.eerste.date) || byTime(a.eerste, b.eerste),
  );
}

/**
 * De eerstvolgende speeldagen ná een datum (#1112) — de "Hierna"-lijst onder een
 * lege dag.
 *
 * Strikt ná: een speeldag op de gekozen dag zelf staat al in het paneel erboven,
 * en die daar nog eens herhalen leest als twee verschillende afspraken. Een dag
 * die geweest is valt weg, ook als hij later in de lijst zou vallen — je kunt er
 * niet meer heen.
 *
 * Speeldagen en geen momenten (#1270). Dit werkte op markers, en dus vulde één
 * open poll met twee voorstellen op zaterdag twee van de drie rijen: drie
 * wegwijzers, allemaal naar 15 augustus, waarvan twee dezelfde speeldag. Het
 * paneel eronder bundelde ze wél — twee tellingen over precies dezelfde data.
 */
export function volgendeSpeeldagen(
  markers: AgendaMarker[],
  na: string,
  max = 3,
): DagItem[] {
  return speeldagItems(markers.filter((m) => m.date > na && !m.past)).slice(
    0,
    max,
  );
}

/* ------------------------------------------------------------------ */
/* Gespeelde wedstrijden (#1182).                                      */
/*                                                                     */
/* De agenda kende alleen speeldagen: polls. Maar loggen kan zonder     */
/* poll, en dat is de kernflow van de app — een dag met drie           */
/* wedstrijden erop meldde doodleuk "er stond geen speeldag op".        */
/* ------------------------------------------------------------------ */

/** Eén gespeelde wedstrijd: meer heeft de agenda er niet van nodig. Het
 *  tijdstip is er sinds #1221 bij, om hem aan een speeldagmoment te kunnen
 *  hangen. */
export type GespeeldeWedstrijd = { id: string; atMs: number };

/** De wedstrijden van één groep op één kalenderdag. */
export type WedstrijdDag = {
  date: string;
  groupId: string;
  matches: GespeeldeWedstrijd[];
};

/**
 * Van matchrijen naar dagen.
 *
 * `played_at` is een tijdstip, geen kalenderdag — anders dan
 * `play_poll_options.date`, dat de dag al in clubtijd bewaart. De omrekening
 * gaat daarom door `dayInZone` met de tijdzone van je clubkeuze, precies zoals
 * de Vandaag-tab sinds #783: een match van 00:30 hoort bij de avond ervoor als
 * je zone dat zegt.
 */
export function wedstrijdDagen(
  rijen: { id: string; group_id: string | null; played_at: string | null }[],
  timeZone: string,
): Record<string, WedstrijdDag[]> {
  const perDagGroep = new Map<string, WedstrijdDag>();
  for (const rij of rijen) {
    if (rij.played_at == null || rij.group_id == null) continue;
    const date = dayInZone(rij.played_at, timeZone);
    const sleutel = `${date}|${rij.group_id}`;
    const match = { id: rij.id, atMs: new Date(rij.played_at).getTime() };
    const bestaand = perDagGroep.get(sleutel);
    if (bestaand) bestaand.matches.push(match);
    else
      perDagGroep.set(sleutel, {
        date,
        groupId: rij.group_id,
        matches: [match],
      });
  }

  const uit: Record<string, WedstrijdDag[]> = {};
  for (const dag of perDagGroep.values()) (uit[dag.date] ??= []).push(dag);
  return uit;
}

/** Hoeveel wedstrijden er op een dag staan, over de groepen heen. */
export function telWedstrijden(dagen: WedstrijdDag[]): number {
  return dagen.reduce((n, d) => n + d.matches.length, 0);
}

/* ------------------------------------------------------------------ */
/* Wat bij een speeldag hoort, en wat los is (#1221).                  */
/*                                                                     */
/* Tot nu toe stond een gespeelde avond twee keer in de agenda: als     */
/* speeldagkaart én als rij "6 wedstrijden". Eén avond, twee            */
/* registraties — en de telling in de dagkop was het met geen van       */
/* beide eens.                                                          */
/* ------------------------------------------------------------------ */

export type WedstrijdIndeling = {
  /** Aantal gespeelde wedstrijden per poll — de teller op de speeldagkaart. */
  perPoll: Record<string, number>;
  /** Wat bij geen enkele speeldag hoort: losse partijen, per dag. */
  losPerDag: Record<string, WedstrijdDag[]>;
};

/**
 * Verdeelt de gespeelde wedstrijden over de speeldagen die er die dag lagen.
 *
 * Welke wedstrijd bij welk moment hoort is niet aan deze functie: dat is
 * `hoortBijMoment` uit speeldagMatches, dezelfde regel die de speeldagpagina
 * sinds #1133/#1146 gebruikt. Een match heeft geen `poll_id` — die koppeling
 * bestaat niet in het datamodel — dus als de twee pagina's het verschillend
 * afleiden, spreken ze elkaar tegen.
 *
 * Alleen een vastgelegde of geboekte speeldag telt als speeldag. Een open poll
 * is een vraag, geen avond; wedstrijden op zo'n dag zijn los gelogd.
 *
 * `hoortBijMoment` is voor twee momenten tegelijk waar als een wedstrijd er
 * precies tussenin ligt. Op de speeldagpagina mag hij dan twee keer verschijnen;
 * in een telling niet, dus hier wint het vroegste moment.
 */
export function verdeelWedstrijden(
  perDag: Record<string, AgendaMarker[]>,
  wedstrijdenPerDag: Record<string, WedstrijdDag[]>,
): WedstrijdIndeling {
  const perPoll: Record<string, number> = {};
  const losPerDag: Record<string, WedstrijdDag[]> = {};

  for (const [datum, dagen] of Object.entries(wedstrijdenPerDag)) {
    const markers = perDag[datum] ?? [];
    for (const dag of dagen) {
      // Per poll één moment: een vastgelegde speeldag levert er precies één,
      // en twee sessies op één dag zijn twee polls.
      const momenten = markers
        .filter(
          (m) =>
            m.groupId === dag.groupId &&
            (m.status === "locked" || m.status === "booked"),
        )
        .map((m) => ({
          pollId: m.pollId,
          startMs: clubEpoch(m.date, m.startTime, m.clubTimezone),
        }))
        .sort((a, b) => a.startMs - b.startMs);

      const los: GespeeldeWedstrijd[] = [];
      for (const match of dag.matches) {
        const bij = momenten.find((moment) =>
          hoortBijMoment(
            match.atMs,
            moment.startMs,
            momenten.filter((a) => a !== moment).map((a) => a.startMs),
          ),
        );
        if (bij) perPoll[bij.pollId] = (perPoll[bij.pollId] ?? 0) + 1;
        else los.push(match);
      }
      if (los.length > 0) (losPerDag[datum] ??= []).push({ ...dag, matches: los });
    }
  }

  return { perPoll, losPerDag };
}

/**
 * Alles wat er nog aankomt, als speeldagen op volgorde (#1182) — de bron van de
 * lijstweergave.
 *
 * Het maandraster beantwoordt "wat staat er in augustus"; deze lijst
 * beantwoordt "wat komt eraan", en dat is een andere vraag: hij houdt niet op
 * bij de maandgrens. Vandaag telt mee — een speeldag van vanavond is nog
 * helemaal niet voorbij.
 *
 * Eén kaart per speeldag, niet per dag waarop hij voorgesteld staat (#1270).
 * Dit bundelde per dag, dus een poll die donderdag óf zaterdag voorstelde gaf
 * twee kaarten en telde voor twee in de kop — terwijl de maandkop diezelfde
 * poll als één activiteit telde. Nu delen ze de noemer van `speeldagItems`, en
 * kloppen kop en lijst met elkaar én met de strook erboven.
 */
export function komendeItems(
  markers: AgendaMarker[],
  vanaf: string,
  max = 40,
): DagItem[] {
  return speeldagItems(markers.filter((m) => m.date >= vanaf && !m.past)).slice(
    0,
    max,
  );
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

/** Rijen die het raster altijd toont. */
const RASTER_RIJEN = 6;

/**
 * Het maandraster: hele weken van maandag t/m zondag, met de rand-dagen van de
 * vorige en volgende maand erbij.
 *
 * Altijd zes rijen (#1195). Een maand heeft er van nature vier, vijf of zes
 * nodig, en dat liet het raster tussen 286 en 334px wisselen — waardoor bij het
 * bladeren alles eronder tot 84px op en neer sprong. Doorlopen tot zes rijen
 * kost een week doorloopdagen die er toch al grijs bij stonden, en levert een
 * kalender op die niet meer van hoogte verandert. Zo doen iOS en Google het ook.
 */
export function monthGrid(m: Maand): RasterDag[][] {
  const first = `${m.jaar}-${pad(m.maand)}-01`;
  const last = `${m.jaar}-${pad(m.maand)}-${pad(daysInMonth(m))}`;
  const start = addDays(first, -weekdayIndex(first));

  const weeks: RasterDag[][] = [];
  let cursor = start;
  for (let rij = 0; rij < RASTER_RIJEN; rij++) {
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
 * alleen zijn eigen weken) en telt ook niet mee in "speeldagen deze maand".
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
 * de buurmaanden, en die horen niet mee in "3 speeldagen deze maand".
 *
 * Telt polls en geen markers (#1182): een open poll met drie voorstellen is één
 * vraag om te spelen, niet drie speeldagen. Een poll die over een maandgrens
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
  /** Aantal gelogde wedstrijden op deze dag (#1182). De ruit in de cel is
   *  decoratief, dus wat hij betekent moet hier staan. */
  wedstrijden = 0,
): string {
  const dag = longDay(date);
  const gespeeld =
    wedstrijden > 0
      ? `${wedstrijden} ${wedstrijden === 1 ? "wedstrijd" : "wedstrijden"} gespeeld`
      : null;
  if (markers.length === 0) {
    if (gespeeld) return `${dag}, ${gespeeld}`;
    return verleden
      ? `${dag}, niets gespeeld`
      : `${dag}, niets gepland, plan een speeldag`;
  }
  const staart = gespeeld ? `, ${gespeeld}` : "";
  // Bij een open poll hoort de stemstand erbij: de brede cel zegt "stem" of
  // "jij ✓" (markerHint), en een naam die dat verzwijgt spreekt de cel tegen.
  const beschrijf = (m: AgendaMarker) =>
    `speeldag ${statusLabel(m.status, m.past)} om ${m.startTime}, ${m.groupName}, ${m.clubName}` +
    (m.status === "open" && !m.past
      ? m.myVote
        ? ", jij stemde al"
        : ", jij stemde nog niet"
      : "");
  if (markers.length === 1) return `${dag}, ${beschrijf(markers[0])}${staart}`;
  return `${dag}, ${markers.length} speeldagen: ${markers.map(beschrijf).join("; ")}${staart}`;
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
