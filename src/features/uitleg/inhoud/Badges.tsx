import { Link } from "react-router-dom";
import { sectieHref } from "../secties";

/** Sectie 9: badges en mijlpalen (#989).
 *
 *  De catalogus (badges.catalog.ts) is bewust láng en hangt aan een berekende
 *  context per speler — die hier uitschrijven zou een tweede, stilstaande
 *  kopie opleveren van iets dat al op je profiel staat. Deze sectie legt dus
 *  het systeem uit en wijst je naar de echte lijst, die per definitie klopt. */
export function Badges() {
  return (
    <>
      <p>
        <strong>Badges</strong> zijn kleine onderscheidingen die je verdient door
        te spelen: mijlpalen (je eerste overwinning, je honderdste match),
        reeksen, en een flinke stapel bijzondere prestaties — van iemand
        verslaan die veel sterker is tot vier keer op rij naast een tip zitten.
        Je hoeft er niets voor te doen behalve spelen; ze komen vanzelf.
      </p>
      <p>
        Je ziet ze op je eigen profiel, met de voortgang erbij voor de badges die
        je nog niet hebt. Een paar mag je uitlichten, en die verschijnen dan ook
        naast je naam elders in de app. Verdien je een zeldzame badge, dan komt
        die als pack dat je zelf openscheurt — net als een{" "}
        <Link to={sectieHref("tiers")}>promotie</Link>.
      </p>
      <p className="uitleg__noot">
        Niet elke badge is een compliment. Sommige krijg je juist voor een
        indrukwekkende reeks nederlagen, en die tellen net zo hard.
      </p>
    </>
  );
}

export default Badges;
