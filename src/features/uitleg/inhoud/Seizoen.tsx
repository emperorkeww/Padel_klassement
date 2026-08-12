import { MIN_MATCHES } from "@/features/seizoen/awards";

/** Sectie 13: de periodieke overzichten (#989).
 *
 *  De deelnamedrempel voor de awards komt uit awards.ts; de rest beschrijft de
 *  eregalerij (#711) en Wrapped (#115/#712) zonder hun inhoud te herhalen. */
export function Seizoen() {
  return (
    <>
      <p>
        Een <strong>seizoen</strong> is een kwartaal. Zodra er één afgesloten is,
        wordt de balans opgemaakt: wie de meeste punten pakte is de{" "}
        <strong>kampioen</strong> van dat kwartaal, en die draagt dat het hele
        volgende kwartaal op zijn spelerskaart.
      </p>
      <p>
        Kies op de <strong>Stand</strong> van je groep een afgesloten kwartaal
        en de geschiedenis staat eronder: de kampioen, het podium en de pias van
        dat seizoen — de <strong>Eregalerij</strong>. Daar komen ook de{" "}
        <strong>awards</strong> bij — ludieke prijzen voor wie eruit sprong. Je
        doet mee vanaf {MIN_MATCHES} gespeelde matches; met minder valt er weinig
        te concluderen.
      </p>
      <p>
        <strong>Wrapped</strong> is je eigen jaar- of kwartaaloverzicht: je
        cijfers, je rivalen en je hoogte- en dieptepunten, als een reeks kaarten
        om doorheen te bladeren. Hij verschijnt vanzelf als er een periode
        afloopt, en je kunt hem delen.
      </p>
    </>
  );
}

export default Seizoen;
