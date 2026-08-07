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
  monthGrid,
  schuifMaand,
  windowFor,
  zelfdeMaand,
  type Maand,
} from "./agendaLogic";
import { MaandRaster } from "./components/MaandRaster";
import { WeekStrook } from "./components/WeekStrook";
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

  const { from, to } = windowFor(maand);
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

  const dezeMaand = zelfdeMaand(maand, maandVan(vandaag));
  // Alleen de eerste keer een skeleton. Bij het bladeren blijft het raster
  // staan en vullen de markers zich bij: een leeg raster laten flitsen is
  // erger dan de vorige maand nog even zien.
  const laadt = groepen.loading || (venster.loading && venster.data == null);
  const bezig = groepen.loading || venster.loading;
  const geenGroepen = !groepen.loading && lijst.length === 0;

  /**
   * De tab-stop verplaatsen. Loopt hij het raster uit — pijltje voorbij de
   * laatste rij, of PageUp/PageDown — dan bladert de maand mee. Zonder dit
   * verdwijnt de focus naar een knop die niet bestaat en valt hij terug op
   * `document.body`, waarna verder navigeren met het toetsenbord dood is.
   */
  function verplaatsFocus(date: string) {
    setFocusDag(date);
    if (date < from || date > to) setMaand(maandVan(date));
  }

  /**
   * Een aangetikte dag. Staat er iets op, dan opent het detail; een lege dag
   * vanaf vandaag is de uitnodiging om er een speeldag voor te starten. Een
   * lege dag in het verleden valt terug op het detail, dat dan gewoon meldt
   * dat er niets gespeeld is — plannen kan daar niet meer.
   */
  function kiesDag(date: string) {
    if ((perDag[date] ?? []).length === 0 && date >= vandaag) setPlanDag(date);
    else setOpen(date);
  }

  function naarMaand(delta: number) {
    const nieuw = schuifMaand(maand, delta);
    setMaand(nieuw);
    // De tab-stop mag niet achterblijven in een maand die je niet meer ziet.
    setFocusDag(
      zelfdeMaand(nieuw, maandVan(vandaag))
        ? vandaag
        : `${nieuw.jaar}-${String(nieuw.maand).padStart(2, "0")}-01`,
    );
  }

  return (
    <div className="agenda">
      <header className="page-head">
        <h1 className="page-title">Agenda</h1>
        <p className="page-subtitle">
          Alle speeldagen van je groepen. Tik een lege dag om er een te plannen.
        </p>
      </header>

      <div className="agenda-nav">
        <div className="agenda-nav__stap">
          <button
            type="button"
            className="agenda-nav__knop"
            onClick={() => naarMaand(-1)}
            aria-label="Vorige maand"
          >
            <IconChevron kant="links" />
          </button>
          <button
            type="button"
            className="agenda-nav__knop"
            onClick={() => naarMaand(1)}
            aria-label="Volgende maand"
          >
            <IconChevron kant="rechts" />
          </button>
        </div>
        {/* aria-live: met het toetsenbord bladeren zegt anders niets. */}
        <h2 className="agenda-nav__maand" aria-live="polite">
          {maandLabel(maand)}
        </h2>
        {!dezeMaand && (
          <button
            type="button"
            className="agenda-nav__vandaag"
            onClick={() => {
              setMaand(maandVan(vandaag));
              setFocusDag(vandaag);
            }}
          >
            Vandaag
          </button>
        )}
      </div>

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
          {dezeMaand && !laadt && <WeekStrook vandaag={vandaag} perDag={perDag} />}

          {!bezig && markers.length === 0 && (
            <section className="agenda-instap">
              <h2 className="agenda-instap__titel">Nog niets gepland</h2>
              <p className="agenda-instap__tekst">
                Deze maand staat er nog geen speeldag. Tik een dag met een
                streepjesrand aan om er een te plannen.
              </p>
              <p className="agenda-instap__wijs">
                <span className="agenda-instap__cel" aria-hidden="true">
                  +
                </span>
                zoals hieronder
              </p>
            </section>
          )}

          {laadt ? (
            <RasterSkeleton rijen={weeks.length} />
          ) : (
            <MaandRaster
              weeks={weeks}
              perDag={perDag}
              vandaag={vandaag}
              focusDag={focusDag}
              onFocusDag={verplaatsFocus}
              onPick={kiesDag}
            />
          )}

          <ul className="agenda-legenda">
            {(["booked", "locked", "open"] as const).map((status) => (
              <li key={status} className="agenda-legenda__item">
                <StatusGlyph status={status} size={9} />
                {LEGENDA[status]}
              </li>
            ))}
          </ul>

          {/* Onder het raster: eerst zien wat er gepland staat, dan pas de
              vraag of je het in je eigen agenda wil (#1099). */}
          <AgendaAbonnement />
        </>
      )}

      <DagSheet
        datum={open}
        markers={open ? (perDag[open] ?? []) : []}
        ledenPerGroep={ledenPerGroep}
        profielen={profielen.data ?? {}}
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

const LEGENDA = {
  booked: "Geboekt",
  locked: "Vastgelegd",
  open: "Open poll",
} as const;

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
