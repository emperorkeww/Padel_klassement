import { Link } from "react-router-dom";
import { sectieHref } from "../secties";

/** Sectie 2: de reis van een speeldag (#989). Begint sinds #1121 op de Agenda;
 *  de namen daarna komen letterlijk overeen met wat er in de app staat, dus
 *  verandert daar iets, dan hoort deze lijst mee te veranderen. Dat was ook
 *  precies wat er misging (#1271): hier stond nog een "Teams"-tab beschreven
 *  die sinds #1121 niet meer bestaat, en Mexicano kwam er niet in voor. */
export function Speeldag() {
  return (
    <>
      <p>
        Een speeldag begint op de <strong>Agenda</strong> en loopt daarna van
        links naar rechts over de tabs van je groep. Je hoeft niet alles te
        gebruiken — een losse partij loggen mag ook — maar dit is de volle route.
      </p>
      <dl className="uitleg__lijst">
        <dt>Agenda</dt>
        <dd>
          Alle speeldagen van al je groepen in één kalender. Tik een dag aan en
          zet een <strong>speelpoll</strong> open: een paar dagen en tijden,
          iedereen stemt. Je kunt er een deadline op zetten, zodat de groep op
          tijd een seintje krijgt. Elke speeldag heeft een eigen pagina — daar
          leg je het moment vast, boek je de baan en zet je de wedstrijden
          klaar — en die is deelbaar met een link, zodat je 'm gewoon in de
          groepsapp kunt gooien.
        </dd>
        <dt>De speeldagpagina</dt>
        <dd>
          De hele avond op één plek, in volgorde:{" "}
          <strong>stemmen → moment → baan → indeling → uitslagen</strong>. Een
          balk bovenaan laat zien waar je staat. Je kiest wie er meespeelt, kiest
          een speelvorm, en zet zoveel rondes klaar als er in de geboekte tijd
          passen. Ging er iets mis, dan wis je een ronde in één keer en genereer
          je opnieuw.
        </dd>
        <dt>De speelvormen</dt>
        <dd>
          <strong>Eerlijk</strong> sorteert de aanwezigen op rating en verdeelt ze
          zo dat elke baan intern spannend blijft; "Andere verdeling" wisselt de
          teams én de banen om. <strong>Americano</strong> laat partners en
          tegenstanders juist zo veel mogelijk rouleren: hij kijkt naar wie al met
          en tegen wie speelde, en houdt de bank eerlijk.{" "}
          <strong>Mexicano</strong> deelt elke ronde opnieuw in op de laatste
          stand — sterk tegen sterk — en heeft daarom de uitslagen van de vorige
          ronde nodig. Wie liever zelf schuift, kiest een losse partij.
        </dd>
        <dt>Historie</dt>
        <dd>Alles wat de groep gespeeld heeft, nieuwste eerst.</dd>
        <dt>Stand</dt>
        <dd>
          Het klassement bínnen deze groep — los van je globale rating. Zie{" "}
          <Link to={sectieHref("rating")}>Rating &amp; klassement</Link>.
        </dd>
        <dt>Leden</dt>
        <dd>
          Wie er in de groep zit, de uitnodigingslink, en het beheer van gasten.
        </dd>
      </dl>
    </>
  );
}

export default Speeldag;
