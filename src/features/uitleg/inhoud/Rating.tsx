import { Link } from "react-router-dom";
import { BASE_RATING, K_FACTOR } from "@/features/rating/elo";
import { sectieHref } from "../secties";

/** Sectie 5: Elo in mensentaal (#989).
 *
 *  De getallen komen uit elo.ts in plaats van uit deze tekst, zodat de uitleg
 *  meebeweegt als de rating-trigger ooit anders wordt afgesteld. Let op de
 *  scoremarge-alinea: die is geen detail maar de vraag die het vaakst gesteld
 *  wordt — de rating kijkt alleen naar wie won, niet naar hoe hard. */
export function Rating() {
  return (
    <>
      <p>
        Je <strong>rating</strong> is één getal dat zegt hoe sterk je speelt.
        Iedereen begint op <strong>{BASE_RATING}</strong>. Win je, dan gaat hij
        omhoog; verlies je, dan omlaag. Per match verschuift er hooguit zo'n{" "}
        {K_FACTOR} punten.
      </p>
      <p>
        Hoeveel precies hangt af van wie er tegenover je stond. Win je van een
        team dat sterker is dan het jouwe, dan levert dat veel op — dat had
        niemand verwacht. Win je van een team dat een stuk zwakker is, dan
        levert het bijna niets op, en verliezen kost je juist veel. In een
        dubbel telt de <strong>gemiddelde rating van het team</strong>, dus een
        sterke partner maakt je zeges goedkoper.
      </p>
      <p>
        <strong>De score-marge telt niet mee.</strong> 6–0 of 7–6 maakt voor je
        rating niets uit: alleen wie er won telt. Dat voelt soms onrechtvaardig,
        maar het houdt de rating eerlijk — een afdroging tegen een zwak team zegt
        niets, en één gewonnen tiebreak tegen de beste van de club zegt alles.
        De marge wordt trouwens wel gezien: hij bepaalt mee wie de{" "}
        <Link to={sectieHref("troon")}>pias</Link> wordt.
      </p>
      <p>
        Er zijn twee klassementen. Het <Link to="/klassement">klassement</Link>{" "}
        is globaal: alles wat je ooit speelde, tegen iedereen. Daarnaast heeft
        elke groep zijn eigen stand, over alleen de matches binnen die groep.
        Bovenaan de ene staan en onderaan de andere kan dus prima.
      </p>
      <p>
        Op je eigen profiel staat de <strong>ratinggrafiek</strong>: het verloop
        van je rating over de tijd, zodat je ziet wanneer het misging.
      </p>
    </>
  );
}

export default Rating;
