import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet } from "@/ui/Sheet";
import { Avatar } from "@/ui/Avatar";
import { EmptyState } from "@/ui/EmptyState";
import { useToast } from "@/ui/ToastProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { errorMessage } from "@/lib/utils/errors";
import { addDays, dateInZone } from "@/lib/utils/time";
import {
  getClubAvailability,
  type DayAvailability,
} from "@/features/availability/api";
import {
  prijsPerPersoon,
  vrijeBanenOpSlot,
} from "@/features/availability/availabilityShare";
import { displayName } from "@/features/profiles/api";
import { downloadSpeeldagIcs } from "@/features/groups/speeldagIcs";
import { courtsLabel, longDay, shortDay } from "@/features/groups/planPollHelpers";
import {
  clearPollVote,
  pollSharePath,
  setPollVote,
  type PollVoteStatus,
} from "@/features/groups/pollsApi";
import type { Profile } from "@/types";
import {
  markerHaalbaarheid,
  momentVoorbij,
  statusChip,
  tijdvak,
  volgendeStap,
  type AgendaMarker,
  type WedstrijdDag,
} from "../agendaLogic";
import { StatusGlyph } from "@/ui/StatusGlyph";
import { KopieerChip } from "@/ui/KopieerChip";
// Dezelfde cijferregel als op de speeldagpagina (#1308); het component brengt
// zijn eigen stijl mee, zoals StemRij hieronder.
import {
  MomentMeta,
  MomentMeter,
} from "@/features/groups/components/MomentMeta";
// De stemrij woont sinds #1196 bij de polls en brengt zijn eigen stijl mee
// (StemRij.css + Proposals.css voor de `seg`-knoppen). Die regels hier kopiëren
// zou ze uit het zicht van de contrast- en glascheck halen.
import { StemRij } from "@/features/groups/components/StemRij";
import { AfmeldRegel } from "@/features/groups/components/AfmeldRegel";

/** Hoeveel avatars de stemmersrij toont voordat de rest een telling wordt. */
const MAX_AVATARS = 6;

/** Hoe vaak het sheet opnieuw kijkt of een moment intussen voorbij is. Een
 *  minuut is fijn genoeg: het gaat om de laatste minuten vóór een slot. */
const TIK_MS = 60_000;

/**
 * Wat er op een aangetikte dag staat (#1091).
 *
 * Meerdere speeldagen op één dag is normaal — twee groepen die los van elkaar
 * plannen weten niet van elkaar. Het sheet toont ze daarom als lijst, elk met
 * eigen groep, status en boekingsgegevens, en niet als één samengevoegde dag.
 */
export function DagSheet({
  datum,
  markers,
  wedstrijden = [],
  wedstrijdenPerPoll = {},
  groepNamen = {},
  momentenPerPoll,
  ledenPerGroep,
  profielen,
  myId,
  onGestemd,
  onPlan,
  onClose,
}: {
  /** ISO-datum; null = dicht. */
  datum: string | null;
  markers: AgendaMarker[];
  /**
   * Los gelogde partijen van deze dag, per groep (#1270).
   *
   * Die stonden tot nu toe alleen in het dagpaneel, dat over de gekozen dag
   * ging. Nu een tik meteen dít sheet opent, is dat de enige plek waar ze nog
   * te zien zijn — en een avond met drie gelogde wedstrijden mag hier niet
   * "Niets gespeeld" heten. Alleen wat bij géén speeldag hoort: de rest is een
   * teller op de kaart (#1221).
   */
  wedstrijden?: WedstrijdDag[];
  /** Aantal gespeelde wedstrijden per poll (#1221) — de chip op de speeldag. */
  wedstrijdenPerPoll?: Record<string, number>;
  /** Groepsnamen voor de losse rijen; die dragen geen marker met een naam. */
  groepNamen?: Record<string, string>;
  /** Alle momenten van het maandvenster, per poll. Een poll strekt zich over
   *  meerdere dagen uit; wie hier stemt, moet hem in één keer kunnen
   *  beantwoorden (#1104). */
  momentenPerPoll: Record<string, AgendaMarker[]>;
  /** Aantal leden per groep — de noemer van "gestemd — 6 van 8". */
  ledenPerGroep: Record<string, number>;
  profielen: Record<string, Profile>;
  myId: string;
  /** Stem geland: het maandvenster mag opnieuw geladen worden. */
  onGestemd: () => void;
  /** Ook op deze dag een speeldag starten (#1104). Ontbreekt voor een dag die
   *  geweest is: daar valt niets meer te plannen. */
  onPlan?: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  // Optimistisch stemmen: de tik is meteen zichtbaar, de server volgt. Hier op
  // sheet-niveau, want één dag kan meerdere polls dragen.
  const [overlay, setOverlay] = useState<Map<string, PollVoteStatus | null>>(
    new Map(),
  );
  const [nu, setNu] = useState(() => Date.now());

  // Bij een andere dag begint het sheet schoon: de overlay is een echo van jóuw
  // laatste tik en mag geen serverwaarheid overschrijven die je nog niet zag.
  useEffect(() => setOverlay(new Map()), [datum]);

  // Zolang het sheet openstaat blijft de klok lopen. Een slot dat tijdens het
  // kijken afloopt, is daarna niet meer te bestemmen.
  useEffect(() => {
    if (datum == null) return;
    setNu(Date.now());
    const id = setInterval(() => setNu(Date.now()), TIK_MS);
    return () => clearInterval(id);
  }, [datum]);

  function stemVan(m: AgendaMarker): PollVoteStatus | null {
    return overlay.has(m.optionId) ? (overlay.get(m.optionId) ?? null) : m.myVote;
  }

  /**
   * Welke (club, dag) we de beschikbaarheid van willen weten (#1121).
   *
   * Alleen voor momenten waarop nog gestemd wordt: bij een vastgelegde dag is
   * "is er nog een baan?" geen vraag meer. En alleen binnen een week, want
   * verder vooruit zegt Playtomic nog niets. De momenten van dezelfde poll
   * horen erbij — juist dáártussen kies je.
   */
  const teLaden = useMemo(() => {
    if (datum == null) return [] as AgendaMarker[];
    const uniek = new Map<string, AgendaMarker>();
    for (const m of markers) {
      if (m.status !== "open" || m.past) continue;
      for (const kandidaat of [m, ...(momentenPerPoll[m.pollId] ?? [])]) {
        if (kandidaat.date > addDays(dateInZone(kandidaat.clubTimezone), 6))
          continue;
        uniek.set(`${kandidaat.clubId}|${kandidaat.date}`, kandidaat);
      }
    }
    return [...uniek.values()];
  }, [datum, markers, momentenPerPoll]);

  const baanSleutel = teLaden.map((m) => `${m.clubId}|${m.date}`).join(",");
  const banen = useAsync<Record<string, DayAvailability>>(
    async () => {
      const uit: Record<string, DayAvailability> = {};
      await Promise.all(
        teLaden.map(async (m) => {
          try {
            uit[`${m.clubId}|${m.date}`] = await getClubAvailability(m.date, {
              id: m.clubId,
              name: m.clubName,
              city: m.clubCity,
              timezone: m.clubTimezone,
            });
          } catch {
            // Playtomic plat of club onbereikbaar: dan staat er gewoon geen
            // baantelling bij. Het sheet gaat daar niet aan kapot.
          }
        }),
      );
      return uit;
    },
    // Alleen de sleutel: `teLaden` is elke render een nieuwe array, en de
    // inhoud die ertoe doet — welke (club, dag)-paren — staat erin samengevat.
    // (De disable-regel die hier stond dekte een waarschuwing die deze hook niet
    // meer geeft; `useAsync` neemt een dep-array, geen effect-body.)
    [baanSleutel],
    { enabled: teLaden.length > 0 },
  );

  /**
   * Hoort er bij dít moment een baantelling? Dezelfde regel als `teLaden`, maar
   * per moment in plaats van per (club, dag) — en dat verschil doet ertoe
   * (#1233).
   *
   * De opgehaalde data ligt op club en dag, dus een geboekte speeldag naast een
   * open poll in dezelfde club op dezelfde dag vond die telling ook, en zette
   * "1 baan vrij" neer bij een baan die allang geboekt was. Hier hangt de
   * gereserveerde regel aan, dus zonder deze grens zou zo'n blok bovendien lege
   * ruimte reserveren voor een vraag die het niet stelt.
   */
  function baanVerwacht(m: AgendaMarker): boolean {
    if (m.status !== "open" || m.past) return false;
    return m.date <= addDays(dateInZone(m.clubTimezone), 6);
  }

  /**
   * Vrije banen en prijs van één moment.
   *
   * `wacht` zegt of er voor dit moment überhaupt iets opgehaald wordt: daarop
   * reserveert de baanregel zijn hoogte, ook als het antwoord nooit komt.
   * Zolang de live-telling er niet is, draagt `vrij` de momentopname die bij het
   * aanmaken bewaard werd — hetzelfde als PollCard.liveFree() doet.
   */
  function baanInfo(m: AgendaMarker): {
    vrij: number | null;
    prijs: string | null;
    wacht: boolean;
  } {
    const wacht = baanVerwacht(m);
    const dag = wacht ? banen.data?.[`${m.clubId}|${m.date}`] : undefined;
    if (!dag) return { vrij: wacht ? m.courtsFree : null, prijs: null, wacht };
    const week = [{ date: m.date, data: dag, error: null }];
    return {
      vrij: vrijeBanenOpSlot(week, m.date, m.startTime, m.duration) ?? m.courtsFree,
      prijs: prijsPerPersoon(week, m.date, m.startTime, m.duration),
      wacht,
    };
  }

  /** Stem zetten of wissen; opnieuw tikken op je eigen keuze haalt hem weg. */
  function stem(m: AgendaMarker, status: PollVoteStatus) {
    const vorige = stemVan(m);
    const volgende = vorige === status ? null : status;
    setOverlay((cur) => new Map(cur).set(m.optionId, volgende));
    const call =
      volgende === null
        ? clearPollVote(m.optionId, myId)
        : setPollVote(m.optionId, m.groupId, myId, volgende);
    call.then(onGestemd).catch((err) => {
      setOverlay((cur) => new Map(cur).set(m.optionId, vorige));
      toast.error(errorMessage(err));
    });
  }

  return (
    // De datum is de kop van het sheet en niet nog een regel erin (#1180):
    // daarmee krijgt hij ook de standaard sluitknop, en die had dit sheet als
    // enige van de app helemaal niet.
    <Sheet
      open={datum != null}
      onClose={onClose}
      title={datum ? longDay(datum) : "Dag"}
      // Eigen klasse omdat de voetbalk hier plakt (#1308): dat vraagt de
      // onderpadding van het sheet zelf. Zelfde constructie als `.sheet--match`
      // (#1144) en `.sheet--wizard` bij de poll.
      className="sheet--dag"
    >
      {datum && (
        <div
          className={`dagsheet${markers.length > 1 ? " dagsheet--meerdere" : ""}`}
        >
          {/* Wat er los gespeeld is staat bovenaan: op een dag die geweest is
              is dát het nieuws (#1182). Sinds #1270 hier in plaats van in het
              dagpaneel — een tik op de dag komt nu meteen hier uit. */}
          {wedstrijden.length > 0 && (
            <ul className="dagsheet__wedstrijden">
              {wedstrijden.map((w) => (
                <li key={w.groupId}>
                  <WedstrijdRij
                    dag={w}
                    groepNaam={groepNamen[w.groupId] ?? "Groep"}
                  />
                </li>
              ))}
            </ul>
          )}

          {markers.length === 0 ? (
            wedstrijden.length > 0 ? null : (
            // Tot #1270 stond hier alleen het verleden-verhaal, met de aanname
            // dat een lege dag vanaf vandaag het plan-sheet opent. Dat klopt
            // voor een tik in het raster, maar niet voor een link:
            // `/agenda?dag=<volgende week>&open=1` kwam hier gewoon uit en zei
            // "Deze dag is geweest" over een dag die nog moet komen. Hetzelfde
            // pad ontstaat als het groepsfilter de speeldagen van die dag
            // wegzeeft — en de URL is sinds #1182 juist bedoeld om te delen.
            //
            // `onPlan` is precies het onderscheid: die krijgt dit sheet alleen
            // voor een dag die nog te plannen valt. Dezelfde tweedeling als in
            // DagPaneel, zodat de twee lege staten niet uit elkaar lopen.
            onPlan ? (
              <EmptyState
                icon="📅"
                title="Nog niets gepland"
                action={
                  <button type="button" className="btn btn--primary" onClick={onPlan}>
                    Speeldag plannen
                  </button>
                }
              >
                Op deze dag staat nog geen speeldag. Zet er een op en laat je
                groep stemmen.
              </EmptyState>
            ) : (
              <EmptyState icon="🎾" title="Niets gespeeld">
                Deze dag is geweest en er stond geen speeldag op.
              </EmptyState>
            )
            )
          ) : (
            markers.map((m) => (
              <Speeldag
                key={m.optionId}
                marker={m}
                andere={andereMomenten(m, momentenPerPoll, nu)}
                leden={ledenPerGroep[m.groupId] ?? 0}
                profielen={profielen}
                myId={myId}
                stemVan={stemVan}
                onStem={stem}
                baanInfo={baanInfo}
                wedstrijden={wedstrijdenPerPoll[m.pollId] ?? 0}
                nu={nu}
                eigenVlak={markers.length > 1}
              />
            ))
          )}

          {/* Een dag die al iets draagt kon tot nu toe niets nieuws krijgen:
              kiesDag stuurde 'm hierheen en hier stond geen uitweg. Twee
              groepen die los van elkaar plannen weten niet van elkaar, dus een
              bezette donderdag is juist een dag waar je naar kijkt (#1104). */}
          {/* Een stille tekstknop sinds #1308: dit is de uitzondering (twee
              groepen die los van elkaar dezelfde donderdag plannen), en hij
              stond even breed en even zwaar als de hoofdactie eronder. */}
          {onPlan && markers.length > 0 && (
            <button type="button" className="dagsheet__ookplannen" onClick={onPlan}>
              Plan hier ook een speeldag
            </button>
          )}

          {/* De voetbalk van het sheet (#1308), met dezelfde vorm als in het
              match-sheet: hij plakt onderaan, dus hij hoort ná alles wat
              eronderdoor scrolt. Alleen bij één speeldag — anders staan de
              acties in hun eigen blok, bij de speeldag waar ze over gaan. */}
          {markers.length === 1 && (
            <footer className="dagsheet__voet sheet__foot glas glas--sterk glas--balk">
              <Acties marker={markers[0]} />
            </footer>
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * De overige momenten van dezelfde poll, op volgorde. Alleen wat nog te spelen
 * valt: een verlopen kandidaat is geen vraag meer.
 *
 * Dit komt uit het maandvenster, dus een moment net buiten het raster staat er
 * niet bij — daarvoor blijft "Open speeldag" staan.
 */
function andereMomenten(
  marker: AgendaMarker,
  momentenPerPoll: Record<string, AgendaMarker[]>,
  nowMs: number,
): AgendaMarker[] {
  if (marker.status !== "open") return [];
  return (momentenPerPoll[marker.pollId] ?? [])
    .filter((m) => m.optionId !== marker.optionId && !momentVoorbij(m, nowMs))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/**
 * Wat er die dag los gespeeld is (#1182, hierheen verhuisd in #1270).
 *
 * Eén rij per groep, want dat is de eenheid waarin je erover praat ("drie
 * wedstrijden bij Vamos!"). Bij precies één wedstrijd gaat de link naar die
 * wedstrijd; bij meer naar het matchoverzicht van de groep, want een dagfilter
 * bestaat daar niet.
 *
 * Alleen voor wedstrijden zónder speeldag eromheen (#1221). Wat bij een
 * speeldag hoort staat als chip op die speeldag; anders stond dezelfde avond er
 * twee keer.
 *
 * Draagt dezelfde schil als een speeldagkaart (#1207); het staafje links zegt
 * al dat deze dag geweest is.
 */
function WedstrijdRij({
  dag,
  groepNaam,
}: {
  dag: WedstrijdDag;
  groepNaam: string;
}) {
  const n = dag.matches.length;
  const naar =
    n === 1 ? `/matches/${dag.matches[0].id}` : `/spelen?groep=${dag.groupId}`;
  return (
    <Link className="speeldag" to={naar}>
      <span className="speeldag__rail speeldag__rail--past" aria-hidden="true" />
      <span className="speeldag__body">
        <span className="speeldag__top">
          <span className="speeldag__tijd">
            {n} {n === 1 ? "wedstrijd" : "wedstrijden"}
          </span>
          <span className="speeldag__chip speeldag__chip--past">Gespeeld</span>
        </span>
        <span className="speeldag__titel">{groepNaam}</span>
      </span>
    </Link>
  );
}

/**
 * De vier bakken waarin een groepslid kan zitten (#1308).
 *
 * De marker draagt ze al uitgesplitst, met één ding dat de server nog niet
 * weet: de tik die je zojuist gaf. `mijn` is die optimistische stem — zonder
 * die correctie sta je nog bij "kan niet" terwijl je duim al op ✓ ligt.
 *
 * Jezelf laten we uit "nog niets gezegd" (#1270): die rij zegt wie je nog kunt
 * porren, en jij staat pal onder de stemknoppen.
 */
function deelnameVan(
  m: AgendaMarker,
  mijn: PollVoteStatus | null,
  myId: string,
): { ja: string[]; misschien: string[]; nee: string[]; stil: string[] } {
  const zonderMij = (ids: string[]) => ids.filter((id) => id !== myId);
  const metMij = (ids: string[], status: PollVoteStatus) =>
    mijn === status ? [...zonderMij(ids), myId] : zonderMij(ids);
  return {
    ja: metMij(m.yesVoterIds, "yes"),
    misschien: metMij(m.maybeVoterIds, "maybe"),
    nee: metMij(m.noVoterIds, "no"),
    stil: zonderMij(m.nietGereageerdIds),
  };
}

/** Hoeveel namen er staan voordat de rest achter een knop schuift. */
const MAX_NAMEN = 4;

/**
 * Een rij namen onder een labelkopje (#1180).
 *
 * "Nog niets gezegd" in een groep van twintig zette twintig namen als lopende
 * tekst neer, en dan is het sheet ineens twee schermen lang terwijl de knoppen
 * waar je voor kwam onderaan staan. De eerste paar namen dragen de vraag "wie
 * kan ik nog porren?" prima; de rest is er als je hem zoekt.
 */
function NamenRij({ label, namen }: { label: string; namen: string[] }) {
  const [alles, setAlles] = useState(false);
  const rest = namen.length - MAX_NAMEN;
  const zichtbaar = alles ? namen : namen.slice(0, MAX_NAMEN);
  return (
    <p className="dagsheet__namenrij">
      <span className="dagsheet__tegel-label">{label}</span>
      {/* Namen en knop in één regel-item: het labelkopje staat erboven, maar
          "+3 meer" hoort in de zin te lopen en niet op een eigen regel. */}
      <span>
        {zichtbaar.join(", ")}
        {rest > 0 && !alles && (
          <>
            {" "}
            <button
              type="button"
              className="dagsheet__meer"
              onClick={() => setAlles(true)}
            >
              +{rest} meer
            </button>
          </>
        )}
      </span>
    </p>
  );
}

function Speeldag({
  marker,
  andere,
  leden,
  profielen,
  myId,
  stemVan,
  onStem,
  baanInfo,
  wedstrijden,
  nu,
  eigenVlak,
}: {
  marker: AgendaMarker;
  /** De overige momenten van dezelfde poll die nog te spelen zijn. */
  andere: AgendaMarker[];
  leden: number;
  profielen: Record<string, Profile>;
  /** Jij, zodat je eigen (net gezette) stem in de juiste bak landt (#1308). */
  myId: string;
  stemVan: (m: AgendaMarker) => PollVoteStatus | null;
  onStem: (m: AgendaMarker, status: PollVoteStatus) => void;
  /** Vrije banen en prijs van een moment, plus of er nog iets onderweg is. */
  baanInfo: (m: AgendaMarker) => {
    vrij: number | null;
    prijs: string | null;
    wacht: boolean;
  };
  /** Hoeveel er op deze speeldag gespeeld is (#1221) — zelfde teller als op de
   *  kaart in het paneel. */
  wedstrijden: number;
  nu: number;
  /** Staat er nog een speeldag naast op deze dag? Dan draagt dit blok zijn eigen
   *  vlak, en op een glazen sheet is dat glas (#1207). Als enige blok blijft het
   *  randloos: er valt dan niets te scheiden. */
  eigenVlak: boolean;
}) {
  const geboekt = marker.status === "booked" && !marker.past;
  const toonBoeking = geboekt && (marker.courts || marker.accessCode);
  // Niet `marker.past`: dat bevroor toen het venster laadde, en dit sheet kan
  // over het einde van het slot heen openstaan.
  const stembaar = marker.status === "open" && !momentVoorbij(marker, nu);
  const stap = volgendeStap(marker);
  const naam = (id: string) => displayName(profielen[id]);
  const { vrij, prijs, wacht } = baanInfo(marker);
  const deelname = deelnameVan(marker, stemVan(marker), myId);
  // Haalbaarheid met de live baantelling erin — dezelfde afleiding als op de
  // speeldagpagina (#1308), zodat "0 mee" er niet meer bij zwijgt dat er nog
  // vier spelers nodig zijn.
  const haalbaar = markerHaalbaarheid(marker, vrij);
  // Banen zeggen alleen iets zolang er nog gestemd wordt: bij een geboekte dag
  // is "is er nog een baan?" geen vraag meer, en "beschikbaarheid onbekend"
  // zou daar ronduit verkeerd staan. `undefined` laat het deel weg, `null` is
  // "we weten het niet".
  const banenInMeta = marker.status === "open" && !marker.past;
  return (
    <article
      className={`dagsheet__speeldag${eigenVlak ? " glas glas--subtiel" : ""}`}
    >
      <header className="dagsheet__kop">
        <p className="dagsheet__tijd">{tijdvak(marker.startTime, marker.duration)}</p>
        {/* `statusChip` en niet `statusLabel` (#1308): ditzelfde woord stond
            als "Open poll" op de kaart en in de legenda erachter, en hier als
            "open poll" — één badge, twee schrijfwijzen, tegelijk in beeld. */}
        <span className={`dagsheet__badge dagsheet__badge--${marker.past ? "past" : marker.status}`}>
          <StatusGlyph status={marker.status} past={marker.past} size={9} />
          {statusChip(marker.status, marker.past)}
        </span>
      </header>

      {/* Jouw stem, meteen onder de kop (#1308).
          Dit is het enige wat je hier zelf kunt afmaken, en het stond onder
          twee namenlijsten: in een groep van twintig lag het onder de vouw,
          terwijl de twee knoppen die je níét nodig had de onderrand vulden. */}
      {stembaar && (
        <div className="dagsheet__stemmen">
          <StemRij
            titel="Jouw stem"
            omschrijving={`${longDay(marker.date)} ${marker.startTime}`}
            aantal={null}
            mine={stemVan(marker)}
            onVote={(s) => onStem(marker, s)}
          />
        </div>
      )}

      {/* Groep, club en wat er gespeeld is zijn ingangen, geen etiketten
          (#1308). Ze zagen eruit als aantikbare pillen en waren het niet,
          terwijl de groepsnaam elders in de app juist wél de weg naar die
          groep is. */}
      <p className="dagsheet__chips">
        <Link
          className="dagsheet__chip dagsheet__chip--groep dagsheet__chip--link"
          to={`/groepen/${marker.groupId}`}
        >
          {marker.groupName}
        </Link>
        <Link
          className="dagsheet__chip dagsheet__chip--link"
          to={`/banen?datum=${marker.date}`}
        >
          {marker.clubName}
        </Link>
        {/* Wat er op deze avond gelogd is (#1221). Stond op de kaart in het
            paneel; sinds #1270 komt een tik meteen hier uit, dus hoort het hier
            ook te staan — anders zegt een gespeelde avond niets over wat er
            gespeeld is. Zelfde bestemming als de losse wedstrijdrij hierboven. */}
        {wedstrijden > 0 && (
          <Link
            className="dagsheet__chip dagsheet__chip--link"
            to={`/spelen?groep=${marker.groupId}`}
          >
            {wedstrijden} {wedstrijden === 1 ? "wedstrijd" : "wedstrijden"}
          </Link>
        )}
      </p>

      {/* Wie er meedoen, wat er nog nodig is, wat er vrij is en wat het kost
          (#1121, #1308): precies waar je op zit te wachten als je nog moet
          beslissen of je "ik kan" aantikt. Dezelfde regel — en dus dezelfde
          woorden — als op de speeldagpagina.

          Op een eigen regel en niet tussen de chips hierboven (#1233): de
          baantelling komt van Playtomic en landt dus ná het openen, en tussen
          groep en club erbij komen liet de rij naar twee regels springen — met
          een sheet dat onderaan verankerd staat, groeit dat recht onder je
          vinger weg. Zolang er iets onderweg is houdt deze regel daarom ruimte
          voor twee regels vast: hij kan groeien van "beschikbaarheid onbekend"
          naar "3 banen vrij, 1 nodig · ± € 6 p.p.", en dat mag het sheet niet
          voelen. */}
      {!marker.past && (
        <p className={`dagsheet__meta${wacht ? " dagsheet__meta--wacht" : ""}`}>
          {/* De ring gaat over "halen we een baan met deze stemmen?" — een
              vraag die alleen leeft zolang er nog gestemd wordt. Op een
              geboekte dag zou hij grijs "onbekend" staan bij een baan die al
              vastligt. */}
          {banenInMeta && (
            <MomentMeter state={haalbaar.state} className="dagsheet__meter" />
          )}
          <MomentMeta
            ja={marker.yesVoterIds.length}
            misschien={marker.maybeVoterIds.length}
            // De drempel "ja + misschien ≥ 4" beslist of een speeldag dóórgaat
            // (pollBeslissing.ts) — een vraag die alleen bij een open poll nog
            // openstaat. Ná het vastleggen gaat het om bevestigde spelers voor
            // de wedstrijden, en dát zegt `volgendeStap` twee regels lager.
            // Allebei tonen zette twee tellingen naast elkaar die verschillend
            // rekenen ("nog 1 speler nodig" boven "Nog 2 bevestigde spelers
            // nodig") — precies de klacht waar dit sheet mee begon.
            tekort={banenInMeta ? haalbaar.tekort : 0}
            vrij={banenInMeta ? vrij : undefined}
            banenNodig={haalbaar.banenNodig}
            prijs={banenInMeta ? prijs : null}
          />
        </p>
      )}

      {/* Waar deze speeldag op wacht — dezelfde zin als op de kaart in het
          dagpaneel, zodat het sheet niets nieuws hoeft te beweren (#1121). */}
      {stap && <p className="dagsheet__stap">{stap}</p>}

      {toonBoeking ? (
        <div className="dagsheet__tegels">
          {marker.courts && (
            <div className="dagsheet__tegel">
              <span className="dagsheet__tegel-label">Banen</span>
              <span className="dagsheet__tegel-waarde">{courtsLabel(marker.courts)}</span>
            </div>
          )}
          {/* De code is hier een knop en geen tekst (#1308): je opent dit sheet
              met je telefoon in je hand vóór de deur van de club, en dezelfde
              code op de speeldagpagina kopieert al sinds #675. */}
          {marker.accessCode && (
            <div className="dagsheet__tegel">
              <span className="dagsheet__tegel-label">Toegangscode</span>
              <KopieerChip
                waarde={marker.accessCode}
                naam="Toegangscode"
                icoon="🔑"
                melding="Code gekopieerd."
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Je afmelden voor een vastgelegde speeldag (#1271, hier sinds #1308).
          Stemmen kan alleen zolang de poll open is, dus dit sheet meldde "Nog 2
          bevestigde spelers nodig" zonder enige manier om er een te worden: die
          knop stond alleen op de speeldagpagina. */}
      {!marker.past && marker.status !== "open" && (
        <AfmeldRegel
          optionId={marker.optionId}
          groupId={marker.groupId}
          myId={myId}
        />
      )}

      {/* Wie doet er mee (#1308) — één blok met alle vier de antwoorden.
          Hiervoor stonden er drie tellingen over dezelfde groep: "Ik kan — 2
          van 6", "+4 nog niet" (leden min ja-stemmers, dus mét de twijfelaars
          en de afmelders erin) en daaronder "Misschien" en "Nog niets gezegd"
          met precies díe mensen bij naam. In een groep van twintig las dat als
          "+18 nog niet" naast "Wacht op 16 leden".

          Nu telt elk lid één keer, in de bak waar hij zelf voor koos. Wie nog
          niets zei staat er alleen zolang er te stemmen valt: op een geboekte
          dag is dat geen open vraag meer. */}
      {/* Ingeklapt (#1308): de telling en de gezichten staan er altijd, de
          namen erachter. In een groep van twintig duwden drie namenrijen alles
          waar je voor kwam onder de vouw; wie wil weten wie hij nog kan porren,
          tikt hem open. Zonder namen valt er niets te vouwen. */}
      <details className="dagsheet__deelname">
        <summary className="dagsheet__deelname-kop">
          <span className="dagsheet__tegel-label">
            Wie doet er mee{leden > 0 ? ` — ${deelname.ja.length} van ${leden}` : ""}
          </span>
          {deelname.ja.length > 0 ? (
            <span className="dagsheet__avatars">
              {deelname.ja.slice(0, MAX_AVATARS).map((id) => (
                <Avatar key={id} profile={profielen[id]} size={28} short />
              ))}
              {/* Boven de zes viel de rest stilletjes weg: de telling erboven
                  zei "8 van 20" en er stonden er zes. */}
              {deelname.ja.length > MAX_AVATARS && (
                <span className="dagsheet__rest">
                  +{deelname.ja.length - MAX_AVATARS}
                </span>
              )}
            </span>
          ) : (
            <span className="dagsheet__leeg">Nog niemand zei "ik kan".</span>
          )}
        </summary>
        {/* Twijfelaars, afmelders en stille leden bij naam (#1121, #1308).
            Juist bij "nog één speler nodig" is dat de vraag: wie kan ik nog
            porren — en wie hoef ik niet meer te vragen? */}
        <div className="dagsheet__namen">
          {deelname.misschien.length > 0 && (
            <NamenRij label="Misschien" namen={deelname.misschien.map(naam)} />
          )}
          {deelname.nee.length > 0 && (
            <NamenRij label="Kan niet" namen={deelname.nee.map(naam)} />
          )}
          {marker.status === "open" &&
            !marker.past &&
            deelname.stil.length > 0 && (
              <NamenRij
                label="Nog niets gezegd"
                namen={deelname.stil.map(naam)}
              />
            )}
          {deelname.misschien.length === 0 &&
            deelname.nee.length === 0 &&
            deelname.stil.length === 0 && (
              <p className="dagsheet__leeg">
                Iedereen heeft geantwoord{deelname.ja.length > 0 ? " — dit is de hele ploeg." : "."}
              </p>
            )}
        </div>
      </details>

      {stembaar && andere.length > 0 && (
        <div className="dagsheet__stemmen">
          {/* Een poll is meer dan deze dag: zonder de rest lijkt één tik de
              hele vraag te beantwoorden. Wat hier staat komt uit het
              maandvenster — een moment daarbuiten zit in de poll zelf. */}
          <span className="dagsheet__tegel-label">
            Andere momenten in deze poll
          </span>
          {andere.map((m) => {
            const anderVrij = baanInfo(m).vrij;
            const anderHaalbaar = markerHaalbaarheid(m, anderVrij);
            return (
              <StemRij
                key={m.optionId}
                titel={`${shortDay(m.date)} · ${m.startTime}`}
                omschrijving={`${longDay(m.date)} ${m.startTime}`}
                aantal={m.yesVoterIds.length}
                banen={anderVrij}
                // Dezelfde ring als op de speeldagpagina (#1308): zonder die
                // zei "0 mee" niets over de vier spelers die er nog bij moeten,
                // en stond er bij een moment zonder banendata helemaal niets.
                meter={anderHaalbaar.state}
                tekort={anderHaalbaar.tekort}
                mine={stemVan(m)}
                onVote={(s) => onStem(m, s)}
              />
            );
          })}
        </div>
      )}

      {/* Bij meerdere speeldagen op één dag horen de acties ín het blok: één
          plakbalk kan niet over twee speeldagen gaan. Als enige speeldag staan
          ze onderaan het sheet, in de voetbalk (#1308) — zie `Acties`. */}
      {eigenVlak && (
        <div className="dagsheet__acties">
          <Acties marker={marker} />
        </div>
      )}
    </article>
  );
}

/**
 * Wat je met deze speeldag kunt doen (#1308).
 *
 * Volgorde en vorm van de rest van de app (#1144, `sheet__foot`): het
 * secundaire links, het primaire rechts. Hiervoor stond "Open speeldag" als
 * enige accentknop middenin het sheet, onder twee namenlijsten — en dat is de
 * knop die je juist wégstuurt.
 */
function Acties({ marker }: { marker: AgendaMarker }) {
  return (
    <>
      {/* Een geboekte speeldag is precies hetzelfde soort event als een match
          (MatchCalendarButton/WinnerCard) — dus dezelfde helper. Een open poll
          krijgt deze knop niet: er valt nog niets in je agenda te zetten. */}
      {!marker.past && marker.status !== "open" && (
        <button
          type="button"
          className="btn dagsheet__actie"
          onClick={() => downloadSpeeldagIcs(marker)}
        >
          Zet in je agenda
        </button>
      )}
      <Link
        className="btn btn--primary dagsheet__actie"
        to={pollSharePath(marker.pollId)}
      >
        Open speeldag
      </Link>
    </>
  );
}

export default DagSheet;
