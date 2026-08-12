import { shortDay } from "@/features/groups/planPollHelpers";
import type { OpenVraag } from "../agendaLogic";
import "../Agenda.css";

/* ------------------------------------------------------------------ */
/* "Dit wacht op jou" (#1182).                                         */
/*                                                                     */
/* De speeldagkaart zegt al "Jij moet nog stemmen", maar alleen op de   */
/* dag die je toevallig aangetikt hebt. Wie de agenda opent met drie    */
/* open polls over twee groepen ziet in het raster enkel stippen en     */
/* moet ze zelf gaan zoeken. Hier staat het bovenaan, met de weg        */
/* erheen — en zodra er niets openstaat, staat de strook er niet.       */
/* ------------------------------------------------------------------ */

export function ActieStrook({
  vragen,
  onGa,
}: {
  vragen: OpenVraag[];
  /** Naar de eerste openstaande speeldag: kies die dag en open hem. */
  onGa: (date: string) => void;
}) {
  if (vragen.length === 0) return null;

  const eerste = vragen[0];
  const tekst =
    vragen.length === 1
      ? `Jij moet nog stemmen op de speeldag van ${shortDay(eerste.date)} (${eerste.groupName}).`
      : `Jij moet nog stemmen op ${vragen.length} speeldagen.`;

  return (
    <div className="actiestrook">
      <p className="actiestrook__tekst">{tekst}</p>
      <button
        type="button"
        className="btn btn--sm btn--primary actiestrook__knop"
        onClick={() => onGa(eerste.date)}
      >
        {vragen.length === 1 ? "Stem nu" : "Naar de eerste"}
      </button>
    </div>
  );
}

export default ActieStrook;
