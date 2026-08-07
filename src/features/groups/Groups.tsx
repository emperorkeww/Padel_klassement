import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { GroupListSkeleton } from "@/ui/Skeleton";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { errorMessage } from "@/lib/utils/errors";
import { dateInZone } from "@/lib/utils/time";
import { useClub } from "@/features/availability/club";
import { MatchesSectie } from "@/features/matches/MatchesSectie";
import { useSpeelParams } from "@/features/matches/speelParams";
import { getMyGroups, createGroup, type GroupSummary } from "./api";
import { getPollsForGroups, getPollOptionsForGroups } from "./pollsApi";
import { journeyFor, type Journey } from "./journey";
import { ledenLabel } from "./groepHelpers";
import { GroepStrook } from "./components/GroepStrook";
import "./Groups.css";

// "Spelen": de hub van de kernreis (#106), en sinds #1123 ook de plek waar de
// matches staan. Bovenaan kies je een groep; alles daaronder — te spelen,
// historie, loggen — kijkt naar die keuze. "Alle" is de standaard.

// De reisstatus van álle groepen tegelijk: de strook toont per chip een stip,
// dus dit is geen bijzaak meer die per kaart mag nadruppelen. Twee queries in
// totaal in plaats van twee per groep (#674 C1 liet dat TODO staan; met de
// chips is het moment daar). De votes blijven ongehaald — journeyFor leest ze
// niet.
async function loadJourneys(
  groups: GroupSummary[],
  today: string,
  nowMs: number,
): Promise<Record<string, Journey>> {
  const ids = groups.map((g) => g.id);
  const [polls, options] = await Promise.all([
    getPollsForGroups(ids),
    getPollOptionsForGroups(ids),
  ]);
  return Object.fromEntries(
    ids.map((id) => [
      id,
      journeyFor(polls[id] ?? [], options[id] ?? [], today, nowMs),
    ]),
  );
}

export function Groups() {
  usePageTitle("Spelen");
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);
  const toast = useToast();
  const navigate = useNavigate();
  const club = useClub();
  const today = dateInZone(club.timezone);
  // Eén schrijver op de querystring (#1123): de strook en het periodefilter
  // zitten op dezelfde pagina, en twee losse setSearchParams-calls in dezelfde
  // tick overschrijven elkaar. Zie speelParams.ts.
  const speel = useSpeelParams();

  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const journeys = useAsync(
    () => loadJourneys(groups.data ?? [], today, Date.now()),
     
    [groupKey],
  );

  const list = groups.data ?? [];
  // De gekozen groep is afgeleid, niet opgeslagen: een ?groep= die niet (meer)
  // bij jouw groepen hoort valt vanzelf terug op "Alle". Bewust niet
  // rechtzetten door de URL te herschrijven — dat zou een tweede schrijver zijn
  // én een extra history-entry opleveren.
  const gekozen = list.find((g) => g.id === speel.groep) ?? null;
  const gekozenJourney = gekozen ? (journeys.data?.[gekozen.id] ?? null) : null;

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Het aanmaakformulier zit achter een knop (#674 A5), behalve als je nog
  // geen groep hebt — dan is dít de actie van de pagina. Afgeleid tijdens de
  // render en niet in een effect, anders verschijnt het formulier één frame
  // ná de lege staat.
  const [newOpen, setNewOpen] = useState(false);
  const nieuwKnopRef = useRef<HTMLButtonElement>(null);
  const noGroups = !groups.loading && !groups.error && list.length === 0;
  // Zelf uitklappen zet de cursor meteen in het naamveld; bij een lege hub
  // niet, want dan zou de pagina bij het laden je focus kapen. Sluiten geeft
  // de focus terug aan de "+"-knop in de strook (#916).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (newOpen) nameRef.current?.focus();
    else if (wasOpen.current) nieuwKnopRef.current?.focus();
    wasOpen.current = newOpen;
  }, [newOpen]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const g = await createGroup(name, myId);
      toast.success("Groep aangemaakt — voeg nu leden toe.");
      // Meteen door naar de ledentab van de nieuwe groep: daar gebeurt de
      // logische vervolgstap (vrienden toevoegen).
      navigate(`/groepen/${g.id}?tab=leden`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    // De ruimte voor de zwevende knop hoort op de pagina-root, niet op de
    // matchsectie: anders landt de padding halverwege de pagina.
    <div className="heeft-zwevende-actie">
      <header className="page-head">
        <h1 className="page-title">Spelen</h1>
        <p className="page-subtitle">
          Je vaste padel-kringen, planningspolls en divisionaire heerschappij.
        </p>
      </header>

      {groups.loading && <GroupListSkeleton count={2} />}
      {groups.error && (
        <ErrorRetry
          melding={`Je groepen laden mislukte: ${groups.error}`}
          onRetry={groups.reload}
        />
      )}

      {noGroups && (
        // Eén kaart met één actie (#916). Zonder groep valt er niets te kiezen,
        // dus staat hier het formulier in plaats van de strook.
        <div className="card">
          <EmptyState icon="👥" title="Geen groep, geen glorie.">
            Start je eigen padelgroep, nodig je vrienden uit en hou jullie
            onderlinge klassementen en wedstrijden live bij!
          </EmptyState>
          <form
            className="row-between account-form groepsnaam-form"
            onSubmit={create}
          >
            {/* Een placeholder is geen label: hij verdwijnt zodra je typt
                (#924). */}
            <label className="label groepsnaam-form__veld">
              Groepsnaam
              <input
                ref={nameRef}
                className="input"
                placeholder="bijv. Vrijdagavond"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !name.trim()}>
              {busy ? "Aanmaken…" : "Maak deze groep"}
            </button>
          </form>
        </div>
      )}

      {!groups.loading && !groups.error && list.length > 0 && (
        <>
          <GroepStrook
            groepen={list}
            gekozen={gekozen?.id ?? ""}
            onKies={speel.zetGroep}
            onNieuw={() => setNewOpen(true)}
            nieuwRef={nieuwKnopRef}
            journeys={journeys.data ?? undefined}
          />

          {/* De regel onder de strook draagt wat niet in een chip past: hoe
              groot de groep is, waar hij in de kernreis zit, en de weg naar
              binnen. Bij "Alle" staat hier niets — dan gaat de pagina over al
              je matches, niet over één groep. */}
          {gekozen && (
            <p className="groep-regel">
              <span className="groep-regel__naam">{gekozen.name}</span>
              {gekozen.created_by === myId && (
                <span className="badge badge--accent">eigenaar</span>
              )}
              <span>· {ledenLabel(gekozen.member_ids.length)}</span>
              {/* Het reis-label is een aansporing ("stem mee", "boek de baan"),
                  dus het brengt je waar je dat kunt doen. Sinds #1121 is dat de
                  agenda; alleen een speeldag van vandaag hoort bij de groep
                  zelf, en daarvoor staat "Open groep" er al. */}
              {gekozenJourney &&
                (gekozenJourney.tab === "agenda" ? (
                  <Link to="/agenda">· {gekozenJourney.label}</Link>
                ) : (
                  <span>· {gekozenJourney.label}</span>
                ))}
              <Link
                className="btn btn--sm groep-regel__open"
                to={`/groepen/${gekozen.id}`}
              >
                Open groep →
              </Link>
            </p>
          )}
        </>
      )}

      {/* Een groep erbij is zeldzaam; het formulier stond altijd open en woog
          even zwaar als de groepen zelf (#674 A5). Achter de "+" in de strook
          dus. Met nul groepen zit het formulier ín de lege staat hierboven. */}
      {!noGroups && newOpen && (
        <section className="card">
          <div className="row-between">
            <h2 className="card__title">Nieuwe groep</h2>
            {/* #916: uitklappen had geen tegenhanger — het formulier bleef
                staan tot je wegnavigeerde. */}
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Formulier sluiten"
              onClick={() => {
                setNewOpen(false);
                setName("");
              }}
            >
              ✕
            </button>
          </div>
          <form
            className="row-between account-form groepsnaam-form"
            onSubmit={create}
          >
            <label className="label groepsnaam-form__veld">
              Groepsnaam
              <input
                ref={nameRef}
                className="input"
                placeholder="bijv. Vrijdagavond"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !name.trim()}>
              {busy ? "Aanmaken…" : "Aanmaken"}
            </button>
          </form>
        </section>
      )}

      {/* De matches zelf (#1123). Bewust onvoorwaardelijk gemonteerd, ook
          terwijl de groepen nog laden: de sectie heeft eigen skeletons, en hem
          achter de groepen aanhangen zou een watervalletje bouwen voor een
          filter die client-side gebeurt. */}
      <MatchesSectie
        groepId={gekozen?.id ?? ""}
        periode={speel.periode}
        onPeriode={speel.zetPeriode}
        onWisFilters={speel.wisFilters}
        logDirect={speel.logDirect}
        onLogVerbruikt={speel.verbruikLog}
        verbergActie={newOpen}
      />

      {/* Vrije banen blijft een rustige verwijzing: je komt hier niet om een
          baan te bekijken, maar het is handig dat het pad er staat. */}
      <p className="hub-banen">
        Benieuwd welke banen vrij zijn bij {club.name}?{" "}
        <Link className="btn btn--sm" to="/banen">
          Bekijk de banen →
        </Link>
      </p>
    </div>
  );
}

export default Groups;
