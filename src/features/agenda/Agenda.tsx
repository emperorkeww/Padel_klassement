import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { getPollWindow, type PollWindow } from "@/features/groups/pollsApi";
import {
  buildMarkers,
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
  windowFor,
  zelfdeMaand,
  type AgendaMarker,
  type Maand,
} from "./agendaLogic";
import { MaandRaster } from "./components/MaandRaster";
import { DagPaneel } from "./components/DagPaneel";
import { RasterSkeleton } from "./components/RasterSkeleton";
import { DagSheet } from "./components/DagSheet";
import { PlanDagSheet } from "./components/PlanDagSheet";
import { StatusGlyph } from "./components/StatusGlyph";
import { AgendaAbonnement } from "./components/AgendaAbonnement";
import "./Agenda.css";

const LEEG_VENSTER: PollWindow = { polls: [], options: [], votes: [] };

/** Onthoudt voor welke groep je het laatst plande — bij drie groepen scheelt
 *  dat elke keer dezelfde keuze opnieuw maken. */
const LAATSTE_GROEP = "agenda-laatste-groep";

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

  const [maand, setMaand] = useState<Maand>(() => maandVan(vandaag));
  // De dag waar het paneel onder het raster over gaat (#1112). Los van
  // `focusDag`: met de pijltjes loop je door het raster zonder telkens iets te
  // kiezen, precies zoals je met de muis kunt rondkijken zonder te klikken.
  const [gekozenDag, setGekozenDag] = useState(vandaag);
  const [focusDag, setFocusDag] = useState(vandaag);
  const [open, setOpen] = useState<string | null>(null);
  // De aangetikte lege dag; los van `open`, want het plan-sheet geeft het stokje
  // door aan de wizard en moet die dag ondertussen vasthouden.
  const [planDag, setPlanDag] = useState<string | null>(null);
  const [wizardDag, setWizardDag] = useState<string | null>(null);
  const [planGroep, setPlanGroep] = useState<string | null>(() =>
    readFlag(LAATSTE_GROEP),
  );
  const [nieuwClub, setNieuwClub] = useState<Club>(globaleClub);

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
  // Een poll die iemand anders vastlegt of boekt hoort vanzelf in het raster te
  // verschijnen; alle drie de tabellen voeden hetzelfde venster.
  useRealtime("play_polls", venster.reload);
  useRealtime("play_poll_options", venster.reload);
  useRealtime("play_poll_votes", venster.reload);

  const markers = useMemo(
    () => buildMarkers(venster.data ?? LEEG_VENSTER, lijst, myId, Date.now()),
    [venster.data, lijst, myId],
  );
  const perDag = useMemo(() => markersByDay(markers), [markers]);
  const inMaand = useMemo(() => telInMaand(markers, maand), [markers, maand]);
  const volgende = useMemo(
    () => volgendeSpeeldagen(markers, gekozenDag),
    [markers, gekozenDag],
  );
  // Dezelfde markers, maar per poll: een poll strekt zich over meerdere dagen
  // uit, en in het dag-sheet beantwoord je hem in één keer (#1104).
  const perPoll = useMemo(() => {
    const out: Record<string, AgendaMarker[]> = {};
    for (const m of markers) (out[m.pollId] ??= []).push(m);
    return out;
  }, [markers]);
  const weeks = useMemo(() => monthGrid(maand), [maand]);
  const ledenPerGroep = useMemo(
    () => Object.fromEntries(lijst.map((g) => [g.id, g.member_ids.length])),
    [lijst],
  );

  // De groep waarvoor we plannen: de onthouden keuze, of bij één groep die ene.
  // Een onthouden groep die je intussen verlaten hebt telt niet meer mee.
  const planGroepId =
    lijst.find((g) => g.id === planGroep)?.id ??
    (lijst.length === 1 ? lijst[0].id : null);

  // Alleen de eerste keer een skeleton. Bij het bladeren blijft het raster
  // staan en vullen de markers zich bij: een leeg raster laten flitsen is
  // erger dan de vorige maand nog even zien.
  const laadt = groepen.loading || (venster.loading && venster.data == null);
  const geenGroepen = !groepen.loading && lijst.length === 0;

  /**
   * De tab-stop verplaatsen. Loopt hij het raster uit — pijltje voorbij de
   * laatste rij, of PageUp/PageDown — dan bladert de maand mee. Zonder dit
   * verdwijnt de focus naar een knop die niet bestaat en valt hij terug op
   * `document.body`, waarna verder navigeren met het toetsenbord dood is.
   */
  function verplaatsFocus(date: string) {
    setFocusDag(date);
    if (date < raster.from || date > raster.to) setMaand(maandVan(date));
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
    if (!zelfdeMaand(maandVan(date), maand)) setMaand(maandVan(date));
    if (date === gekozenDag) openDag(date);
    else setGekozenDag(date);
  }

  /** Het sheet bij een dag met speeldagen, het plan-sheet bij een lege dag die
   *  nog komt. Een lege dag die geweest is heeft niets te openen — het paneel
   *  zegt daar al dat er niet gespeeld is. */
  function openDag(date: string) {
    if ((perDag[date] ?? []).length > 0) setOpen(date);
    else if (date >= vandaag) setPlanDag(date);
  }

  /** Naar een dag springen vanuit "Hierna": de maand schuift mee en de tab-stop
   *  blijft niet achter in de maand die je verlaat. */
  function springNaar(date: string) {
    if (!zelfdeMaand(maandVan(date), maand)) setMaand(maandVan(date));
    setGekozenDag(date);
    setFocusDag(date);
  }

  function naarMaand(delta: number) {
    const nieuw = schuifMaand(maand, delta);
    setMaand(nieuw);
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
    setGekozenDag(doel);
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
            {metHoofdletter(maandLabel(maand))}
          </h1>
          <p className="agenda-kop__telling">
            {laadt
              ? " "
              : inMaand === 0
                ? "Nog niets gepland"
                : `${inMaand} ${inMaand === 1 ? "activiteit" : "activiteiten"} deze maand`}
          </p>
        </div>
        <div className="agenda-kop__acties">
          <button
            type="button"
            className="agenda-kop__vandaag"
            onClick={() => {
              setMaand(maandVan(vandaag));
              setFocusDag(vandaag);
              setGekozenDag(vandaag);
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
          {laadt ? (
            <RasterSkeleton rijen={weeks.length} />
          ) : (
            <MaandRaster
              weeks={weeks}
              perDag={perDag}
              vandaag={vandaag}
              gekozenDag={gekozenDag}
              focusDag={focusDag}
              onFocusDag={verplaatsFocus}
              onPick={kiesDag}
            />
          )}

          <ul className="agenda-legenda">
            {(["booked", "locked", "open"] as const).map((status) => (
              <li key={status} className="agenda-legenda__item">
                <StatusGlyph status={status} size={8} />
                {statusChip(status)}
              </li>
            ))}
          </ul>

          {/* Wat er in het raster niet meer past (#1112). De instap-kaart die
              hier stond legde uit dat je een dag kon aantikken; dit paneel
              laat het gewoon zien. */}
          {!laadt && (
            <DagPaneel
              datum={gekozenDag}
              vandaag={vandaag}
              markers={perDag[gekozenDag] ?? []}
              volgende={volgende}
              ledenPerGroep={ledenPerGroep}
              profielen={profielen.data ?? {}}
              onOpen={() => setOpen(gekozenDag)}
              onPlan={
                gekozenDag >= vandaag ? () => setPlanDag(gekozenDag) : undefined
              }
              onKiesDag={springNaar}
            />
          )}

          {/* Onder het raster: eerst zien wat er gepland staat, dan pas de
              vraag of je het in je eigen agenda wil (#1099). */}
          <AgendaAbonnement />
        </>
      )}

      <DagSheet
        datum={open}
        markers={open ? (perDag[open] ?? []) : []}
        momentenPerPoll={perPoll}
        ledenPerGroep={ledenPerGroep}
        profielen={profielen.data ?? {}}
        myId={myId}
        onGestemd={venster.reload}
        // Alleen vooruit: een dag die geweest is valt niet meer te plannen. Het
        // detail geeft het stokje door aan dezelfde keten als een lege dag
        // (PlanDagSheet → wizard); er komt geen tweede aanmaakflow naast.
        onPlan={
          open != null && open >= vandaag
            ? () => {
                setOpen(null);
                setPlanDag(open);
              }
            : undefined
        }
        onClose={() => setOpen(null)}
      />

      <PlanDagSheet
        datum={planDag}
        groepen={lijst}
        gekozenGroep={planGroep}
        onGroep={(id) => {
          setPlanGroep(id);
          writeFlag(LAATSTE_GROEP, id);
        }}
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
            venster.reload();
          }}
        />
      )}
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

export default Agenda;
