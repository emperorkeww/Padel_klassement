import { predictionPoints } from "@/features/matches/predictions";
import { MIN_GAMES, STAKE_FACTOR } from "@/features/matches/stakes";
import { JOKERS } from "@/features/matches/jokers";
import {
  BIEREN,
  DRANK_MAX_AANTAL,
  FRISDRANKEN,
} from "@/features/matches/drankkaart";

/** Sectie 10: het gokwerk — de toto voor kijkers, Lef voor spelers (#989).
 *
 *  De puntenstaffel komt uit `predictionPoints` (de spiegel van
 *  public.prediction_points) in plaats van uit deze tekst, en de lef-regels uit
 *  stakes.ts. Zo blijft de uitleg kloppen als de staffel ooit verschuift.
 *
 *  De drankje-inzet (#1004) hangt er als derde blok onder: ook een inzet, maar
 *  eentje die aan de bar wordt afgerekend in plaats van in je rating. De
 *  aantallen komen uit drankkaart.ts, zodat een extra biertje op de kaart hier
 *  vanzelf meetelt.
 *
 *  De jokers (#1003) sluiten de rij: geen inzet maar een voorraad — één kaart
 *  per maand die je op één match uitspeelt. De drie kaarten komen uit
 *  jokers.ts (dezelfde preset die de tegel en de wizard tonen), zodat een
 *  gewijzigde tekst hier niet apart bijgewerkt hoeft te worden. */
export function Toto() {
  // Dezelfde functie die de punten ook echt toekent — geen tweede staffel.
  const staffel = [
    { kans: 0.8, wie: "grote favoriet" },
    { kans: 0.5, wie: "kop of munt" },
    { kans: 0.25, wie: "underdog" },
  ];
  return (
    <>
      <h3 className="uitleg__kop">🎲 Toto — voor de kijker</h3>
      <p>
        Bij een geplande match in je groep mag je tippen wie er wint. Iedereen in
        de groep mag meedoen, ook wie zelf niet meespeelt. Juist getipt levert
        punten op, en hoe onwaarschijnlijker je tip, hoe meer:
      </p>
      <ul className="uitleg__lijst-kaal">
        {staffel.map((s) => (
          <li key={s.wie}>
            <strong>
              {predictionPoints(s.kans)}{" "}
              {predictionPoints(s.kans) === 1 ? "punt" : "punten"}
            </strong>{" "}
            — je tipte de {s.wie} ({Math.round(s.kans * 100)}% kans).
          </li>
        ))}
      </ul>
      <p>
        Fout getipt kost je niets behalve je eer. De punten lopen op in het{" "}
        <strong>toto-klassement</strong> van de groep, waar het aantal juiste tips
        de gelijke standen breekt.
      </p>

      <h3 className="uitleg__kop">😤 Lef — voor de speler</h3>
      <p>
        Speel je zelf mee, dan kun je vóór de aftrap <strong>lef</strong> tonen:
        dubbel of niets op je eigen rating. Je ratingmutatie van die match telt
        dan {STAKE_FACTOR}× — in beide richtingen. Winnen wordt dus dubbel zo
        lekker, verliezen dubbel zo duur.
      </p>
      <ul className="uitleg__lijst-kaal">
        <li>
          Je mag pas inzetten als je minstens <strong>{MIN_GAMES} matches</strong>{" "}
          gespeeld hebt.
        </li>
        <li>
          <strong>Eén inzet per speeldag.</strong> Gebruik hem dus op de match
          waar het om gaat.
        </li>
        <li>
          Inzetten kan alleen vóór de aftrap. Daarna ligt het vast.
        </li>
      </ul>
      <p className="uitleg__noot">
        Wie er lef had blijft geheim tot de match begint — anders kon iedereen
        gewoon meeliften op de durfal. Daarna is het opschepmateriaal.
      </p>

      <h3 className="uitleg__kop">🍻 Drankje-inzet — voor aan de bar</h3>
      <p>
        Bij het plannen van een match kies je waar er om gespeeld wordt: een
        drankje van de Belgische kaart ({BIEREN.length} bieren en{" "}
        {FRISDRANKEN.length} frisdranken en waters). De{" "}
        <strong>verliezers trakteren de winnaars</strong> — standaard één
        consumptie per winnaar, tot {DRANK_MAX_AANTAL} als je durft.
      </p>
      <ul className="uitleg__lijst-kaal">
        <li>
          De inzet staat op de matchkaart en in de feed, zodat niemand hem "even
          vergeet".
        </li>
        <li>
          Tot de aftrap kun je hem nog wijzigen; daarna ligt hij vast. Dat kan
          ook op een match die de app zelf inplande.
        </li>
        <li>
          Bij <strong>gelijkspel vervalt de inzet</strong>: iedereen betaalt zijn
          eigen glas.
        </li>
        <li>
          Aan de bar tik je op <strong>"Traktatie ingelost 🍻"</strong>. Op je
          profiel zie je daarna je meest gewonnen drankje en hoeveel consumpties
          je al hebt weggegeven.
        </li>
      </ul>
      <p className="uitleg__noot">
        Dit is puur een weddenschap tussen jullie: aan je rating verandert er
        niets. De app houdt alleen de rekening bij — betalen doe je zelf.
      </p>

      <h3 className="uitleg__kop">🃏 Jokers — één kaart per maand</h3>
      <p>
        Bovenop je dagelijkse lef krijg je <strong>één joker per
        kalendermaand</strong>. Je speelt hem vóór de aftrap uit op een geplande
        groepsmatch waarin je zelf meedoet:
      </p>
      <ul className="uitleg__lijst-kaal">
        {JOKERS.map((kaart) => (
          <li key={kaart.id}>
            <strong>
              {kaart.icoon} {kaart.label}
            </strong>{" "}
            — {kaart.effect} {kaart.prijs}
          </li>
        ))}
      </ul>
      <p>
        Dat het schild ook je winst afneemt is geen fout: een bescherming die
        alleen uitkeert en nooit iets kost, zou je elke maand blind opspelen en
        het hele klassement laten oplopen. Zo blijft het een keuze.
      </p>
      <ul className="uitleg__lijst-kaal">
        <li>
          Schild en dubbel-of-niets kunnen pas vanaf{" "}
          <strong>{MIN_GAMES} matches</strong>; van kant wisselen mag altijd,
          want dat raakt je rating niet.
        </li>
        <li>
          <strong>Niet stapelen:</strong> op een match waar je lef al staat kan
          er geen rating-joker meer bij.
        </li>
        <li>
          Tot de aftrap kun je hem wisselen of intrekken. Daarna is de kaart
          verspeeld — en op de eerste van de volgende maand ligt er een nieuwe.
        </li>
      </ul>
      <p className="uitleg__noot">
        Je schild of dubbel-of-niets blijft geheim tot de aftrap, net als je lef.
        Van kant wisselen ziet iedereen meteen: daar moeten je tegenstanders hun
        opstelling op aanpassen. Bovenaan het scherm zie je aan het 🃏 of je
        kaart van deze maand nog klaarligt.
      </p>
    </>
  );
}

export default Toto;
