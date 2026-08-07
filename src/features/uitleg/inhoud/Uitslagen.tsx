import { Link } from "react-router-dom";

/** Sectie 4: een uitslag invoeren en corrigeren (#989). De correctie-regel
 *  hieronder spiegelt wat RLS serverzijdig afdwingt (zie MatchDetail): de
 *  invoerder en de groepseigenaar, verder niemand. */
export function Uitslagen() {
  return (
    <>
      <p>
        Een uitslag invoeren gaat in twee stappen: eerst tik je aan wie er
        speelden, dan vul je de score in. Dat kan met de knop onderaan{" "}
        <Link to="/spelen">Spelen</Link>, of meteen bij de ronde op de
        Vandaag-tab van je groep.
      </p>
      <p>
        De score vul je in <strong>games</strong> in, met grote ±-knoppen zodat je
        het met één duim langs de baan kunt doen. Speel je met gasten, dan zet je
        die er gewoon bij.
      </p>
      <p>
        <strong>Geen bereik in de kooi?</strong> Je invoer gaat in een wachtrij en
        wordt vanzelf verstuurd zodra je weer verbinding hebt. Je hoeft niets
        opnieuw te doen.
      </p>
      <p>
        <strong>Verkeerd ingevuld?</strong> De uitslag corrigeren kan degene die
        hem invoerde, en de eigenaar van de groep waarin de match gespeeld werd.
        Verder niemand — anders wordt het klassement een onderhandeling. Na een
        correctie wordt de rating opnieuw doorgerekend.
      </p>
    </>
  );
}

export default Uitslagen;
