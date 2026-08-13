import { Sheet } from "@/ui/Sheet";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import type { Club } from "@/features/availability/club";
import { longDay } from "@/features/groups/planPollHelpers";
import { ledenLabel } from "@/features/groups/groepHelpers";
import type { GroupSummary } from "@/features/groups/api";

/**
 * Een lege dag aantikken (#1091): de twee dingen die `createPoll` moet weten
 * voordat de bestaande wizard het overneemt — welke groep, en welke club.
 *
 * Bewust géén eigen "één-dag-poll"-flow: een poll is meerdere momenten (max 5)
 * en de wizard doet dat al. Dit sheet levert alleen de context aan.
 */
export function PlanDagSheet({
  datum,
  groepen,
  gekozenGroep,
  onGroep,
  club,
  onClub,
  /** Laatste dag waarvoor er vrije-banen-gegevens zijn (vandaag + 6). */
  vensterEinde,
  onClose,
  onDoor,
}: {
  datum: string | null;
  groepen: GroupSummary[];
  gekozenGroep: string | null;
  onGroep: (groupId: string) => void;
  club: Club;
  onClub: (club: Club) => void;
  vensterEinde: string;
  onClose: () => void;
  onDoor: () => void;
}) {
  const buitenVenster = datum != null && datum > vensterEinde;
  const eenGroep = groepen.length === 1;
  // De onthouden keuze eerst langs de groepen die je nú hebt (#1270). Zonder
  // die zeef bleef een groep die je verliet "gekozen": er stond geen rij
  // aangevinkt, "Kies momenten →" was tóch actief, en de klik sloot alles
  // zonder iets te openen — de wizard kreeg een id die niet meer bestaat.
  // Dezelfde schoonmaak die de agenda al doet voor het filter (leesGroepKeuze)
  // en voor `planGroepId`.
  const actief =
    groepen.find((g) => g.id === gekozenGroep)?.id ??
    (eenGroep ? groepen[0].id : null);

  return (
    <Sheet
      open={datum != null}
      onClose={onClose}
      title="Plan een speeldag"
      // De datum staat eronder als subtitel; in de naam hoort hij wel, want
      // een schermlezer heeft de kop alleen.
      ariaLabel={datum ? `Plan een speeldag op ${longDay(datum)}` : "Plannen"}
    >
      {datum && (
        <div className="dagsheet">
          <p className="dagsheet__datum">{longDay(datum)}</p>

          {/* Bij één groep valt de keuze weg: dan is er niets te kiezen. */}
          {!eenGroep && (
            <fieldset className="plandag__veld">
              <legend className="dagsheet__tegel-label">Voor welke groep?</legend>
              <div className="plandag__keuzes">
                {groepen.map((g) => (
                  <label
                    key={g.id}
                    className={`plandag__keuze${actief === g.id ? " is-actief" : ""}`}
                  >
                    <input
                      type="radio"
                      name="agenda-plangroep"
                      className="sr-only"
                      checked={actief === g.id}
                      onChange={() => onGroep(g.id)}
                    />
                    <span className="plandag__initialen" aria-hidden="true">
                      {initialen(g.name)}
                    </span>
                    <span className="plandag__tekst">
                      <span className="plandag__naam">{g.name}</span>
                      <span className="plandag__meta">
                        {ledenLabel(g.member_ids.length)}
                        {gekozenGroep === g.id ? " · laatst gebruikt" : ""}
                      </span>
                    </span>
                    <span className="plandag__vink" aria-hidden="true">
                      {actief === g.id ? "✓" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* De clubnaam stond hier twee keer: links als tekst, en rechts in de
              knop waarmee je hem verandert. Op 390px hield die linkerkant
              "LAG…" over naast een knop die dezelfde naam er voluit naast zette
              (#1270). De knop wint — dat is de plek waar je hem ook aanpast. */}
          <div className="plandag__veld">
            <span className="dagsheet__tegel-label">Club</span>
            <div className="plandag__club">
              <ClubPicker value={club} onPick={onClub} allowManual />
            </div>
          </div>

          {buitenVenster && (
            <p className="plandag__waarschuwing">
              {longDay(datum)} valt buiten het venster van 7 dagen met vrije
              banen. Je legt de tijd hier zelf vast; de wizard opent in het
              handmatige pad.
            </p>
          )}

          <div className="plandag__acties">
            <button type="button" className="btn" onClick={onClose}>
              Terug
            </button>
            <button
              type="button"
              className="btn btn--primary plandag__door"
              disabled={actief == null}
              onClick={onDoor}
            >
              Kies momenten →
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Twee letters uit de groepsnaam; "Vamos!" → "VA", "Zen Padel" → "ZP". */
function initialen(naam: string): string {
  const woorden = naam.trim().split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return "?";
  if (woorden.length === 1) return woorden[0].slice(0, 2).toUpperCase();
  return (woorden[0][0] + woorden[1][0]).toUpperCase();
}

export default PlanDagSheet;
