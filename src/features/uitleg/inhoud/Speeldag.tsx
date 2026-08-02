import { Link } from "react-router-dom";
import { sectieHref } from "../secties";

/** Sectie 2: de reis over de tabs van een groepspagina (#989). De tabnamen
 *  hieronder komen letterlijk overeen met GroupDetail; wijzigt daar een tab,
 *  dan hoort deze lijst mee te wijzigen. */
export function Speeldag() {
  return (
    <>
      <p>
        Een speeldag loopt van links naar rechts over de tabs van je groep. Je
        hoeft niet alles te gebruiken — een losse partij loggen mag ook — maar dit
        is de volle route.
      </p>
      <dl className="uitleg__lijst">
        <dt>Plannen</dt>
        <dd>
          Zet een <strong>speelpoll</strong> open: een paar dagen en tijden,
          iedereen stemt. Je kunt er een deadline op zetten, zodat de groep op
          tijd een seintje krijgt, en de baan of club alvast vastleggen. De poll
          is deelbaar met een link, zodat je 'm gewoon in de groepsapp kunt
          gooien.
        </dd>
        <dt>Vandaag</dt>
        <dd>
          De avond zelf, in <strong>rondes</strong>. Per ronde zie je wie op
          welke baan staat en wie er even uit is. Uitslagen vul je hier meteen in.
        </dd>
        <dt>Teams</dt>
        <dd>
          De teamgenerator. <strong>Eerlijke teams</strong> sorteert de
          aanwezigen op rating en verdeelt ze zo dat elke baan intern spannend
          blijft. <strong>Americano</strong> laat partners en tegenstanders juist
          zo veel mogelijk rouleren: hij kijkt naar wie al met en tegen wie
          speelde, en houdt de bank eerlijk. Wie liever zelf schuift, kiest een
          losse partij.
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
