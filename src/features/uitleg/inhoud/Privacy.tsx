import { Link } from "react-router-dom";
import { sectieHref } from "../secties";

/** Sectie 15: wat er gedeeld wordt en wat je kunt uitzetten (#989).
 *
 *  De schakelaars hieronder spiegelen de Privacy- en Weergave-kaarten in
 *  ProfileSettings. Deze sectie is bewust de laatste én de meest zakelijke:
 *  wie hier komt zoekt een antwoord, geen grap. */
export function Privacy() {
  return (
    <>
      <p>
        Deze app draait onder vrienden, dus er is veel zichtbaar: je naam, je
        foto, je rating, je uitslagen en je divisie zijn te zien voor de mensen
        in je groepen en voor je vrienden. Wat je liever niet hebt, zet je uit
        bij je <Link to="/profiel">instellingen</Link>.
      </p>
      <dl className="uitleg__lijst">
        <dt>Vindbaar in zoeken</dt>
        <dd>
          Uit betekent dat niemand je meer op gebruikersnaam kan vinden. Je
          bestaande vrienden en groepen houden je gewoon.
        </dd>
        <dt>Vriendschapsverzoeken toestaan</dt>
        <dd>Uit betekent dat niemand je nog kan toevoegen.</dd>
        <dt>Roast-schild 🛡️</dt>
        <dd>
          Aan betekent dat Coach Rudy niet meer over jóu spot: pias, feed en
          profiel tonen dan de neutrale variant. Zie{" "}
          <Link to={sectieHref("rudy")}>Coach Rudy</Link>.
        </dd>
        <dt>Roast-intensiteit 🎙️</dt>
        <dd>
          Hoe hard Rudy in jouw feed en op jouw dashboard tekeergaat. Binnen een
          groep bepaalt de eigenaar de toon.
        </dd>
        <dt>Dictator- en pias-portret</dt>
        <dd>
          De AI-portretten op de troon en de schandpaal. Uit betekent gewoon je
          eigen foto.
        </dd>
        <dt>Waarnemend dictator 🫡</dt>
        <dd>
          De meme-dictator die de troon bezet houdt zolang niemand kwalificeert.
          Zie <Link to={sectieHref("troon")}>De Troon</Link>.
        </dd>
      </dl>
      <p className="uitleg__noot">
        Verder staan bij je instellingen je thema (licht, donker of wat je
        systeem doet), je e-mailadres en je wachtwoord.
      </p>
    </>
  );
}

export default Privacy;
