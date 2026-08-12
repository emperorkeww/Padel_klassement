import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { addDays, dateInZone } from "@/lib/utils/time";
import { useClub, type Club } from "@/features/availability/club";
import { readFlag, writeFlag } from "@/lib/utils/localFlag";
import { NieuweSpeeldagSheet } from "@/features/groups/components/NieuweSpeeldagSheet";
import { getMyGroups } from "@/features/groups/api";
import { getProfilesMap } from "@/features/profiles/api";
import { getMatchDaysInWindow } from "@/features/matches/api";
import { getPollWindow, type PollWindow } from "@/features/groups/pollsApi";
import {
  buildMarkers,
  filterOpGroepen,
  komendeItems,
  leesGroepKeuze,
  maandLabel,
  maandVan,
  markersByDay,
  metHoofdletter,
  monthGrid,
  ophaalVenster,
  schuifMaand,
  statusChip,
  telInMaand,
  volgendeSpeeldagen,
  wachtOpJou,
  wedstrijdDagen,
  windowFor,
  zelfdeMaand,
  type AgendaMarker,
} from "./agendaLogic";
import { MaandRaster } from "./components/MaandRaster";
import { DagPaneel } from "./components/DagPaneel";
import { RasterSkeleton } from "./components/RasterSkeleton";
import { DagSheet } from "./components/DagSheet";
import { PlanDagSheet } from "./components/PlanDagSheet";
import { StatusGlyph } from "@/ui/StatusGlyph";
import { AgendaAbonnement } from "./components/AgendaAbonnement";
import { GroepFilter } from "./components/GroepFilter";
import { AgendaSuggesties } from "./components/AgendaSuggesties";
import { useAgendaUrl, type Weergave } from "./agendaParams";
import { AgendaLijst } from "./components/AgendaLijst";
import { ActieStrook } from "./components/ActieStrook";
import { PageTabs } from "@/ui/PageTabs";
import { Sheet } from "@/ui/Sheet";
import "./Agenda.css";

const LEEG_VENSTER: PollWindow = { polls: [], options: [], votes: [] };

/** Hoe ver de lijstweergave vooruit kijkt. Een kwartaal: verder dan iemand
 *  plant, en klein genoeg om één query te blijven (#1182). */
const LIJST_DAGEN = 90;

/** Onthoudt voor welke groep je het laatst plande — bij drie groepen scheelt
 *  dat elke keer dezelfde keuze opnieuw maken. */
const LAATSTE_GROEP = "agenda-laatste-groep";

/** De gekozen filterchips (#1121), komma-gescheiden; leeg = alle groepen. */
const GROEP_FILTER = "agenda-groepen";

/* ------------------------------------------------------------------ */
/* Agenda (#1091): alle speeldagen van al je groepen in de tijd.       */
/*                                                                     */
/* Tot nu toe stond een speeldag per groep achter Spelen → groep →      */
/* Plannen, en toonde het overzicht er precies één (pickPollBanner).    */
/* Hier staan ze naast elkaar, over de groepen heen.                    */
/* ------------------------------------------------------------------ */

export function Agenda() {
  usePageTitle("Agenda");
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const globaleClub = useClub();
  // "Vandaag" hangt aan de tijdzone van je clubkeuze, niet aan die van je
  // toestel: om 00:30 in een andere zone is het hier nog gisteren (#783).
  const vandaag = dateInZone(globaleClub.timezone);

  // Wat je bekijkt staat in de URL (#1182): deelbaar, refresh-bestendig, en de
  // terugknop sluit het sheet in plaats van de pagina te verlaten. De gekozen
  // dag is los van `focusDag`: met de pijltjes loop je door het raster zonder
  // telkens iets te kiezen, precies zoals je met de muis kunt rondkijken zonder
  // te klikken — en dát is een tab-stop, geen stand om te delen.
  const navigate = useNavigate();
  const { stand, zet } = useAgendaUrl(vandaag);
  const { maand, dag: gekozenDag, open, weergave } = stand;
  const [focusDag, setFocusDag] = useState(vandaag);
  // Het openen van het sheet duwde een history-entry: dan sluit de terugknop
  // hem. Kwam je met een `?open=1`-link binnen, dan is er niets om op terug te
  // gaan en vervangen we de entry — anders verlaat "sluiten" de app.
  const geduwd = useRef(false);
  // De aangetikte lege dag; los van `open`, want het plan-sheet geeft het stokje
  // door aan de wizard en moet die dag ondertussen vasthouden.
  const [planDag, setPlanDag] = useState<string | null>(null);
  const [wizardDag, setWizardDag] = useState<string | null>(null);
  const [planGroep, setPlanGroep] = useState<string | null>(() =>
    readFlag(LAATSTE_GROEP),
  );
  const [bewaardFilter, setBewaardFilter] = useState<string | null>(() =>
    readFlag(GROEP_FILTER),
  );
  const [nieuwClub, setNieuwClub] = useState<Club>(globaleClub);
  // Het abonneer-sheet (#1197). Bewust géén URL-state zoals de gekozen dag: dit
  // is een instelling die je één keer doet, geen plek in de agenda om naar te
  // linken of op terug te komen.
  const [aboOpen, setAboOpen] = useState(false);

  const groepen = useAsync(getMyGroups, []);
  const profielen = useAsync(getProfilesMap, []);
  const lijst = useMemo(() => groepen.data ?? [], [groepen.data]);
  const groepSleutel = lijst.map((g) => g.id).join(",");

  // Twee vensters, met opzet. `raster` is wat je ziet staan en bepaalt wanneer
  // de toetsenbordnavigatie een maand doorbladert; `from`/`to` is wat we ophalen
  // en loopt zes weken verder, zodat "Hierna" ook in een lege maand iets te
  // wijzen heeft (#1112).
  const raster = windowFor(maand);
  const { from, to } = ophaalVenster(maand);
  const venster = useAsync<PollWindow>(
    () => getPollWindow(lijst.map((g) => g.id), from, to),
    [groepSleutel, from, to],
  );
  // Het derde venster (#1182). Het raster toont een maand en `ophaalVenster`
  // volgt dat; de lijst en de "wacht op jou"-strook gaan over wat er aankomt en
  // mogen niet veranderen omdat jij naar december zit te bladeren. Vandaar een
  // eigen, vaste blik van vandaag tot een kwartaal verder.
  const lijstEinde = addDays(vandaag, LIJST_DAGEN);
  const lijstVenster = useAsync<PollWindow>(
    () => getPollWindow(lijst.map((g) => g.id), vandaag, lijstEinde),
    [groepSleutel, vandaag, lijstEinde],
  );

  // Wat er in dit venster gespeeld is (#1182). Alleen tot en met vandaag: een
  // wedstrijd in de toekomst bestaat niet, en zo blijft de sleutel stabiel
  // zolang je in dezelfde maand rondkijkt. De grens loopt een dag ruim, want
  // `played_at` is een tijdstip en de dag wordt in clubtijd bepaald.
  const wedstrijdEinde = to < vandaag ? to : vandaag;
  const wedstrijden = useAsync(
    () =>
      getMatchDaysInWindow(
        lijst.map((g) => g.id),
        `${addDays(from, -1)}T00:00:00.000Z`,
        `${addDays(wedstrijdEinde, 1)}T23:59:59.999Z`,
      ),
    [groepSleutel, from, wedstrijdEinde],
    { enabled: from <= vandaag },
  );
  const wedstrijdenPerDag = useMemo(
    () => wedstrijdDagen(wedstrijden.data ?? [], globaleClub.timezone),
    [wedstrijden.data, globaleClub.timezone],
  );

  // Een poll die iemand anders vastlegt of boekt hoort vanzelf in het raster te
  // verschijnen; alle drie de tabellen voeden dezelfde twee vensters.
  // De twee reload-functies zijn stabiel (useAsync geeft ze via useCallback);
  // ze hier uit elkaar trekken houdt de dependency-regel tevreden zonder de
  // hele state als afhankelijkheid op te schrijven.
  const herlaadMaand = venster.reload;
  const herlaadLijst = lijstVenster.reload;
  const herlaad = useCallback(() => {
    herlaadMaand();
    herlaadLijst();
  }, [herlaadMaand, herlaadLijst]);
  useRealtime("play_polls", herlaad);
  useRealtime("play_poll_options", herlaad);
  useRealtime("play_poll_votes", herlaad);
  // Een uitslag die iemand logt zet een dag in het verleden aan (#1182).
  useRealtime("matches", wedstrijden.reload);

  const alleMarkers = useMemo(
    () => buildMarkers(venster.data ?? LEEG_VENSTER, lijst, myId, Date.now()),
    [venster.data, lijst, myId],
  );
  // De filterkeuze staat in localStorage, maar wordt elke render gezeefd langs
  // de groepen die je nú hebt: een groep die je verliet zou de agenda anders
  // leeg houden zonder dat er nog een chip staat om hem uit te zetten.
  const groepFilter = useMemo(
    () => leesGroepKeuze(bewaardFilter, lijst.map((g) => g.id)),
    [bewaardFilter, lijst],
  );
  const markers = useMemo(
    () => filterOpGroepen(alleMarkers, groepFilter),
    [alleMarkers, groepFilter],
  );
  const perDag = useMemo(() => markersByDay(markers), [markers]);
  // Dezelfde bewerking op het vooruitblik-venster: dat voedt de lijst, de
  // actiestrook, én het dag-sheet als je vanuit de lijst iets opent.
  const lijstMarkers = useMemo(
    () =>
      filterOpGroepen(
        buildMarkers(lijstVenster.data ?? LEEG_VENSTER, lijst, myId, Date.now()),
        groepFilter,
      ),
    [lijstVenster.data, lijst, myId, groepFilter],
  );
  const perDagLijst = useMemo(() => markersByDay(lijstMarkers), [lijstMarkers]);
  const komende = useMemo(
    () => komendeItems(lijstMarkers, vandaag),
    [lijstMarkers, vandaag],
  );
  const openVragen = useMemo(
    () => wachtOpJou(lijstMarkers, vandaag),
    [lijstMarkers, vandaag],
  );
  const inMaand = useMemo(() => telInMaand(markers, maand), [markers, maand]);
  const volgende = useMemo(
    () => volgendeSpeeldagen(markers, gekozenDag),
    [markers, gekozenDag],
  );
  // Dezelfde markers, maar per poll: een poll strekt zich over meerdere dagen
  // uit, en in het dag-sheet beantwoord je hem in één keer (#1104).
  const perPoll = useMemo(() => {
    const out: Record<string, AgendaMarker[]> = {};
    const gezien = new Set<string>();
    // Beide vensters, want het sheet kan uit het raster óf uit de lijst komen.
    // Ze overlappen (de huidige maand zit in allebei), vandaar de zeef.
    for (const m of [...markers, ...lijstMarkers]) {
      if (gezien.has(m.optionId)) continue;
      gezien.add(m.optionId);
      (out[m.pollId] ??= []).push(m);
    }
    return out;
  }, [markers, lijstMarkers]);
  const weeks = useMemo(() => monthGrid(maand), [maand]);
  const groepNamen = useMemo(
    () => Object.fromEntries(lijst.map((g) => [g.id, g.name])),
    [lijst],
  );
  const ledenPerGroep = useMemo(
    () => Object.fromEntries(lijst.map((g) => [g.id, g.member_ids.length])),
    [lijst],
  );

  // De groep waarvoor we plannen: de onthouden keuze, of bij één groep die ene.
  // Een onthouden groep die je intussen verlaten hebt telt niet meer mee.
  const planGroepId =
    lijst.find((g) => g.id === planGroep)?.id ??
    (lijst.length === 1 ? lijst[0].id : null);

  /** Groepskeuze onthouden; leeg wist de vlag, zodat "alles" de standaard is. */
  function kiesGroepen(ids: string[]) {
    const waarde = ids.length > 0 ? ids.join(",") : null;
    setBewaardFilter(waarde);
    writeFlag(GROEP_FILTER, waarde);
  }

  /** De groep waarvoor we plannen én suggesties tonen; onthouden voor later. */
  function kiesPlanGroep(id: string) {
    setPlanGroep(id);
    writeFlag(LAATSTE_GROEP, id);
  }

  // Alleen de eerste keer een skeleton. Bij het bladeren blijft het raster
  // staan en vullen de markers zich bij: een leeg raster laten flitsen is
  // erger dan de vorige maand nog even zien.
  const laadt = groepen.loading || (venster.loading && venster.data == null);
  const geenGroepen = !groepen.loading && lijst.length === 0;
  // Bladeren naar een andere maand houdt het vorige venster in beeld (useAsync
  // laat zijn data staan). Zonder teken zie je dus even de stippen én de
  // telling van de máánd die je net verliet, en gelooft dat de nieuwe leeg is
  // (#1182). Vandaar: raster op aria-busy, stippen gedimd, telling stil.
  const verversen = venster.loading && venster.data != null;

  // De legenda legt alleen uit wat er te zien is: in een maand met alleen
  // geboekte speeldagen zeggen de andere twee regels niets.
  const zichtbareStatussen = useMemo(() => {
    const aanwezig = new Set(
      markers
        .filter((m) => m.date >= raster.from && m.date <= raster.to)
        .map((m) => m.status),
    );
    return (["booked", "locked", "open"] as const).filter((s) => aanwezig.has(s));
  }, [markers, raster.from, raster.to]);

  const wedstrijdenInBeeld = useMemo(
    () =>
      Object.keys(wedstrijdenPerDag).some(
        (d) => d >= raster.from && d <= raster.to,
      ),
    [wedstrijdenPerDag, raster.from, raster.to],
  );

  /**
   * De tab-stop verplaatsen. Loopt hij het raster uit — pijltje voorbij de
   * laatste rij, of PageUp/PageDown — dan bladert de maand mee. Zonder dit
   * verdwijnt de focus naar een knop die niet bestaat en valt hij terug op
   * `document.body`, waarna verder navigeren met het toetsenbord dood is.
   */
  function verplaatsFocus(date: string) {
    setFocusDag(date);
    if (date < raster.from || date > raster.to) zet({ maand: maandVan(date) });
  }

  /**
   * Een aangetikte dag kiest die dag: het paneel eronder werkt bij (#1112).
   *
   * Tikken op de dag die al gekozen ís, opent meteen — het detail als er iets
   * op staat, anders het plan-sheet. Zonder die tweede betekenis zou plannen
   * van één tik naar twee gaan, en juist dat was de belofte van deze tab.
   *
   * Een randdag van een buurmaand laat het raster meebladeren; anders kies je
   * een dag die je meteen daarna niet meer ziet staan.
   */
  function kiesDag(date: string) {
    if (date === gekozenDag) openDag(date);
    // Dag en maand in één schrijfbeurt: twee losse calls in dezelfde tick
    // overschrijven elkaar (zie agendaParams.ts).
    else zet({ dag: date, maand: maandVan(date) });
  }

  /** Het sheet bij een dag met speeldagen, het plan-sheet bij een lege dag die
   *  nog komt. Een lege dag die geweest is heeft niets te openen — het paneel
   *  zegt daar al dat er niet gespeeld is. */
  function openDag(date: string) {
    if (dagMarkers(date).length > 0) openSheet(date);
    else if (date >= vandaag) setPlanDag(date);
  }

  /** Het dag-sheet openen. Dit is de enige stap die een history-entry duwt: op
   *  Android hoort de terugknop het sheet te sluiten en niet de agenda te
   *  verlaten. De dag schuift mee, zodat het paneel eronder over dezelfde dag
   *  gaat als het sheet erboven. */
  function openSheet(date: string) {
    geduwd.current = true;
    zet({ dag: date, maand: maandVan(date), open: date }, { push: true });
  }

  /** Sluiten via de knop of Escape. Duwden we de entry zelf, dan is teruggaan de
   *  eerlijke weg: anders blijft er een stap in je geschiedenis staan die het
   *  sheet weer opent. */
  function sluitSheet() {
    if (geduwd.current) {
      geduwd.current = false;
      navigate(-1);
    } else {
      zet({ open: null });
    }
  }

  /** De speeldagen van een dag, uit welk venster ze ook komen. Een dag uit de
   *  lijst kan buiten de maand vallen die het raster ophaalde (#1182). */
  function dagMarkers(date: string): AgendaMarker[] {
    const uitRaster = perDag[date] ?? [];
    return uitRaster.length > 0 ? uitRaster : (perDagLijst[date] ?? []);
  }

  /** Vanuit de actiestrook: naar de dag toe én hem meteen openen. De strook
   *  belooft dat je kunt stemmen, dus daar moet je in één tik staan. */
  function gaNaarDag(date: string) {
    setFocusDag(date);
    geduwd.current = true;
    zet(
      { weergave: "maand", dag: date, maand: maandVan(date), open: date },
      { push: true },
    );
  }

  /** Naar een dag springen vanuit "Hierna": de maand schuift mee en de tab-stop
   *  blijft niet achter in de maand die je verlaat. */
  function springNaar(date: string) {
    setFocusDag(date);
    zet({ dag: date, maand: maandVan(date) });
  }

  function naarMaand(delta: number) {
    const nieuw = schuifMaand(maand, delta);
    // De tab-stop mag niet achterblijven in een maand die je niet meer ziet.
    const doel = zelfdeMaand(nieuw, maandVan(vandaag))
      ? vandaag
      : `${nieuw.jaar}-${String(nieuw.maand).padStart(2, "0")}-01`;
    setFocusDag(doel);
    // En de gekozen dag schuift mee. Het ontwerp liet die staan bij het
    // bladeren, maar dat kan hier niet: we halen per maand op, dus zodra de
    // gekozen dag buiten het nieuwe venster valt kent het paneel zijn
    // speeldagen niet meer en meldt het "Nog niets gepland" voor een dag die
    // wél iets draagt. Een paneel dat over een dag praat die je niet ziet
    // staan is bovendien sowieso raar — het staat er pal onder.
    zet({ maand: nieuw, dag: doel });
  }

  return (
    <div className="agenda">
      {/* De maand ís de paginatitel (#1112). Een aparte "Agenda"-kop erboven
          herhaalde alleen wat de tabbalk al zegt en kostte de hoogte die het
          raster nodig heeft. */}
      <header className="agenda-kop">
        <div className="agenda-kop__titel">
          {/* aria-live: met het toetsenbord bladeren zegt anders niets. */}
          {/* maandLabel houdt de gewone Nederlandse schrijfwijze ("augustus
              2026") voor de plekken waar hij midden in een zin staat; als
              paginatitel krijgt hij een hoofdletter. */}
          <h1 className="agenda-kop__maand" aria-live="polite">
            {weergave === "lijst"
              ? "Wat komt eraan"
              : metHoofdletter(maandLabel(maand))}
          </h1>
          <p className="agenda-kop__telling">
            {weergave === "lijst"
              ? lijstVenster.loading && lijstVenster.data == null
                ? " "
                : `${komende.length} ${komende.length === 1 ? "speeldag" : "speeldagen"} gepland`
              : laadt || verversen
              ? " "
              : inMaand === 0
                ? // Niet "Nog niets gepland": dat staat een halve pagina lager
                  // ook al, in het dagpaneel, en gaat daar over de gekozen dag
                  // (#1195). Deze regel telt de máánd, dus zegt hij dat ook.
                  "Geen activiteiten deze maand"
                : `${inMaand} ${inMaand === 1 ? "activiteit" : "activiteiten"} deze maand`}
          </p>
        </div>
        {/* De maandnavigatie hoort bij het raster. In de lijst is er geen maand
            om heen te bladeren — die loopt gewoon door. */}
        <div className="agenda-kop__acties" hidden={weergave === "lijst"}>
          <button
            type="button"
            className="agenda-kop__vandaag"
            // Sta je er al, dan blijft de knop staan — hem weghalen laat de kop
            // springen en haalt het ankerpunt weg waar je na het rondlopen met
            // de pijltjes op terugvalt. Hij zegt alleen dat je er al bent.
            aria-current={
              zelfdeMaand(maand, maandVan(vandaag)) && gekozenDag === vandaag
                ? "date"
                : undefined
            }
            onClick={() => {
              setFocusDag(vandaag);
              zet({ maand: maandVan(vandaag), dag: vandaag });
            }}
          >
            Vandaag
          </button>
          <button
            type="button"
            className="agenda-kop__stap"
            onClick={() => naarMaand(-1)}
            aria-label="Vorige maand"
          >
            <IconChevron kant="links" />
          </button>
          <button
            type="button"
            className="agenda-kop__stap"
            onClick={() => naarMaand(1)}
            aria-label="Volgende maand"
          >
            <IconChevron kant="rechts" />
          </button>
        </div>
      </header>

      {groepen.error && <ErrorRetry melding={groepen.error} onRetry={groepen.reload} />}
      {venster.error && <ErrorRetry melding={venster.error} onRetry={venster.reload} />}

      {geenGroepen ? (
        <EmptyState
          icon="📅"
          title="Nog geen groepen"
          action={
            <Link className="btn btn--primary" to="/spelen">
              Naar Spelen
            </Link>
          }
        >
          Een speeldag begint bij een groep. Maak er een aan of laat je
          uitnodigen, dan vult deze agenda zich vanzelf.
        </EmptyState>
      ) : (
        <>
          {/* Boven het raster (#1121): met meerdere groepen draagt een dag al
              snel drie stippen over evenveel clubs. Bij één groep valt de rij
              vanzelf weg. */}
          <GroepFilter
            groepen={lijst}
            gekozen={groepFilter}
            onWissel={kiesGroepen}
          />

          {/* Wat er van jou gevraagd wordt, boven alles wat je zelf moet gaan
              zoeken (#1182). Staat er niets open, dan staat de strook er niet. */}
          <ActieStrook vragen={openVragen} onGa={gaNaarDag} />

          {/* Twee manieren om te kijken, één manier om te handelen: beide
              weergaven tonen dezelfde kaart en openen hetzelfde dag-sheet. */}
          <div className="agenda-weergave">
            <PageTabs
              variant="segment"
              ariaLabel="Weergave"
              value={weergave}
              onChange={(w) => zet({ weergave: w })}
              tabs={[
                { id: "maand" as Weergave, label: "Maand" },
                { id: "lijst" as Weergave, label: "Lijst" },
              ]}
            />
            {/* Abonneren stond tot #1197 als laatste blok onderaan de pagina,
                onder raster, paneel én suggesties. Hier staat het boven de
                vouw en in beide weergaven — en niet in de maandkop, want die
                knoppenrij verdwijnt in de lijst en is op telefoonbreedte al
                vol. */}
            <button
              type="button"
              className="agenda-abo-knop"
              aria-label="Abonneren op je agenda"
              aria-haspopup="dialog"
              onClick={() => setAboOpen(true)}
            >
              <IconAbo />
            </button>
          </div>

          {weergave === "lijst" ? (
            <AgendaLijst
              items={komende}
              laadt={lijstVenster.loading && lijstVenster.data == null}
              ledenPerGroep={ledenPerGroep}
              profielen={profielen.data ?? {}}
              onOpenDag={openSheet}
            />
          ) : (
            <>
              {laadt ? (
                <RasterSkeleton rijen={weeks.length} />
              ) : (
                <MaandRaster
                  weeks={weeks}
                  perDag={perDag}
                  wedstrijdenPerDag={wedstrijdenPerDag}
                  bezig={verversen}
                  vandaag={vandaag}
                  gekozenDag={gekozenDag}
                  focusDag={focusDag}
                  onFocusDag={verplaatsFocus}
                  onPick={kiesDag}
                />
              )}

              {/* De legenda legt alleen uit wat er te zien is, dus in een lege
                  maand blijft hij leeg. Hij verdwijnt dan niet: zijn regel is
                  in de CSS gereserveerd, anders schuift het dagpaneel 17px
                  omhoog zodra je naar zo'n maand bladert (#1195). */}
              <ul className="agenda-legenda">
                {zichtbareStatussen.map((status) => (
                  <li key={status} className="agenda-legenda__item">
                    <StatusGlyph status={status} size={8} />
                    {statusChip(status)}
                  </li>
                ))}
                {wedstrijdenInBeeld && (
                  <li className="agenda-legenda__item">
                    <StatusGlyph status="played" size={8} />
                    Gespeeld
                  </li>
                )}
              </ul>

              {/* Wat er in het raster niet meer past (#1112). De instap-kaart die
                  hier stond legde uit dat je een dag kon aantikken; dit paneel
                  laat het gewoon zien. */}
              {!laadt && (
                <DagPaneel
                  datum={gekozenDag}
                  vandaag={vandaag}
                  markers={perDag[gekozenDag] ?? []}
                  wedstrijden={wedstrijdenPerDag[gekozenDag] ?? []}
                  groepNamen={groepNamen}
                  volgende={volgende}
                  ledenPerGroep={ledenPerGroep}
                  profielen={profielen.data ?? {}}
                  onOpen={() => openSheet(gekozenDag)}
                  onPlan={
                    gekozenDag >= vandaag ? () => setPlanDag(gekozenDag) : undefined
                  }
                  onKiesDag={springNaar}
                />
              )}
            </>
          )}

          {/* De instap die op de Plannen-tab onderaan stond (#1121): eerst wat
              er staat, dan pas het voorstel voor wat er nog bij kan. */}
          <AgendaSuggesties
            groepen={lijst}
            groepId={planGroepId}
            onGroep={kiesPlanGroep}
            myId={myId}
            onGestart={herlaad}
          />

          {/* Wat hier stond was het hele abonneerblok (#1099): permanent
              uitgeklapt, met link, drie knoppen en twee alinea's uitleg, voor
              iets wat je één keer instelt. Nu één regel die hetzelfde sheet
              opent als de knop bovenaan — wie doorscrolt komt het nog steeds
              tegen, maar het eet geen half scherm meer (#1197). */}
          <button
            type="button"
            className="agenda-abo-teaser"
            aria-haspopup="dialog"
            onClick={() => setAboOpen(true)}
          >
            <span>Zet je speeldagen in je eigen agenda</span>
            <IconChevron kant="rechts" />
          </button>
        </>
      )}

      <DagSheet
        datum={open}
        markers={open ? dagMarkers(open) : []}
        momentenPerPoll={perPoll}
        ledenPerGroep={ledenPerGroep}
        profielen={profielen.data ?? {}}
        myId={myId}
        onGestemd={herlaad}
        // Alleen vooruit: een dag die geweest is valt niet meer te plannen. Het
        // detail geeft het stokje door aan dezelfde keten als een lege dag
        // (PlanDagSheet → wizard); er komt geen tweede aanmaakflow naast.
        onPlan={
          open != null && open >= vandaag
            ? () => {
                sluitSheet();
                setPlanDag(open);
              }
            : undefined
        }
        onClose={sluitSheet}
      />

      <PlanDagSheet
        datum={planDag}
        groepen={lijst}
        gekozenGroep={planGroep}
        onGroep={kiesPlanGroep}
        club={nieuwClub}
        onClub={setNieuwClub}
        vensterEinde={addDays(vandaag, 6)}
        onClose={() => setPlanDag(null)}
        onDoor={() => {
          // Het plan-sheet sluit en geeft de dag door aan de wizard; de
          // groepskeuze blijft staan, ook als je 'm nooit aanpaste.
          if (planGroep == null && lijst.length === 1) {
            setPlanGroep(lijst[0].id);
            writeFlag(LAATSTE_GROEP, lijst[0].id);
          }
          setWizardDag(planDag);
          setPlanDag(null);
        }}
      />

      {/* Dezelfde aanmaakflow als op de Plannen-tab, met die ene dag al
          gekozen. Geen aparte "één-dag-poll" ernaast: een poll is meerdere
          momenten en de wizard kan dat al. */}
      {wizardDag != null && planGroepId != null && (
        <NieuweSpeeldagSheet
          open
          groupId={planGroepId}
          myId={myId}
          club={nieuwClub}
          onClub={setNieuwClub}
          initialDay={wizardDag}
          onClose={() => setWizardDag(null)}
          onCreated={() => {
            setWizardDag(null);
            herlaad();
          }}
        />
      )}

      {/* Buiten de geenGroepen-tak: de knop die dit opent staat er alleen mét
          groepen, maar het sheet hoort bij de pagina en niet bij het raster.
          Sheet regelt focus, Escape, scroll-lock en het naar beneden vegen. */}
      <Sheet
        open={aboOpen}
        onClose={() => setAboOpen(false)}
        title="Zet je speeldagen in je eigen agenda"
      >
        <AgendaAbonnement zonderKop />
      </Sheet>
    </div>
  );
}

function IconChevron({ kant }: { kant: "links" | "rechts" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={kant === "links" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** Kalenderblad met een plusje: "zet dit in je eigen agenda" (#1197). Hetzelfde
 *  stroke-gewicht als de chevrons ernaast, anders leest hij als een ander soort
 *  bediening. */
function IconAbo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
      <path d="M12 12.5v5M9.5 15h5" />
    </svg>
  );
}

export default Agenda;
