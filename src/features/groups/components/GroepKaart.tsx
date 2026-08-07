import { Link } from "react-router-dom";
import { Avatar, type AvatarSource } from "@/ui/Avatar";
import { StatusGlyph } from "@/ui/StatusGlyph";
import { ledenLabel } from "../groepHelpers";
import { MemberStack } from "./MemberStack";
import type { Journey } from "../journey";
import type { GroupSummary } from "../api";

/**
 * Eén groep op de Spelen-hub (#1134).
 *
 * De hele kaart is één link naar de groepspagina. Dat is het hele punt van dit
 * issue: een groep is een plek waar je binnenloopt — met leden, een stand, een
 * eregalerij en een poll die loopt — en niet een filter dat je aanvinkt. Tot
 * #1123 stond hier een kaart die dat ook deed; die werd een chip in een
 * filterstrook, en daarmee las een groep als "een van de knopjes waarmee je de
 * lijst eronder versmalt". Het filteren doet sinds de vorige stap het
 * `<select>` in MatchFilters.
 *
 * Eén verschil met de kaart van vóór #1123: die linkte naar `/agenda` zodra de
 * reisstatus daarover ging, en bracht je dus soms *niet* naar de groep. De kaart
 * gaat nu altijd naar de groep; de status is er tekst, geen bestemming.
 */
export function GroepKaart({
  groep,
  eigenaar,
  profiles,
  journey,
}: {
  groep: GroupSummary;
  /** Ben ík de eigenaar? De rol staat niet in `GroupSummary`; de pagina leidt
   *  hem af uit `created_by`. "lid" krijgt bewust géén badge — dat is de
   *  standaardtoestand, en een badge op elke kaart zegt niets. */
  eigenaar: boolean;
  profiles: Record<string, AvatarSource | undefined>;
  /** Reisstatus; `undefined` zolang die query nog loopt, `null` als er niets
   *  gepland staat. */
  journey?: Journey | null;
}) {
  return (
    <Link className="groep-kaart" to={`/groepen/${groep.id}`}>
      <span className="groep-kaart__kop">
        <Avatar name={groep.name} size={40} />
        <span className="groep-kaart__titel">
          <span className="groep-kaart__naam">{groep.name}</span>
          {eigenaar && <span className="badge badge--accent">eigenaar</span>}
        </span>
        <span className="groep-kaart__chevron" aria-hidden="true">
          ›
        </span>
      </span>

      <span className="groep-kaart__meta">
        <MemberStack ids={groep.member_ids} profiles={profiles} />
        <span>{ledenLabel(groep.member_ids.length)}</span>
      </span>

      {/* De status komt uit een tweede query en valt dus ná de kaarten binnen.
          Zonder deze gereserveerde regel groeit elke kaart een halve regel
          zodra dat gebeurt, en verspringt de hele pagina eronder (#916). */}
      <span className="groep-kaart__status">
        {journey && (
          <>
            {journey.status && <StatusGlyph status={journey.status} />}
            {/* Het reis-label is elders een aansporing met een pijl ("Plan een
                speeldag →"). Op de kaart is het een mededeling: de pijl zou een
                tweede bestemming suggereren naast de kaart zelf. */}
            {journey.label.replace(/\s*→$/, "")}
          </>
        )}
      </span>
    </Link>
  );
}

export default GroepKaart;
