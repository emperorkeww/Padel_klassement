import { predictionPoints } from "@/features/matches/predictions";
import { MIN_GAMES, STAKE_FACTOR } from "@/features/matches/stakes";

/** Sectie 10: het gokwerk — de toto voor kijkers, Lef voor spelers (#989).
 *
 *  De puntenstaffel komt uit `predictionPoints` (de spiegel van
 *  public.prediction_points) in plaats van uit deze tekst, en de lef-regels uit
 *  stakes.ts. Zo blijft de uitleg kloppen als de staffel ooit verschuift. */
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
    </>
  );
}

export default Toto;
