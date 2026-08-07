import { Link } from "react-router-dom";

/** Sectie 14: de bel in de app, push aanzetten en de app installeren (#989).
 *
 *  Sinds #1090 opent deze sectie met de bel en niet met push. Dat is de
 *  volgorde waarin het nu wérkt: elke melding staat sowieso in de app, en push
 *  is het seintje erbovenop. De oude tekst ("zet meldingen aan en je mist geen
 *  speelpoll meer") beloofde het omgekeerde — dat je zonder push niets zou
 *  weten.
 *
 *  De soorten spiegelen NOTIFY_OPTIES in ProfileSettings. De iOS-uitzondering
 *  is geen detail: daar wérkt push pas ná het installeren, en wie dat niet weet
 *  denkt dat de app stuk is. */
export function Meldingen() {
  return (
    <>
      <p>
        Alles wat de app je te melden heeft, verzamelt zich achter de{" "}
        <strong>bel</strong>: bovenin op je telefoon, in de zijbalk op een groter
        scherm. Een nieuwe ronde, een uitslag, een speelpoll, een
        vriendschapsverzoek — het staat er, met een stip zolang je het niet
        gelezen hebt. Tik erop en je komt precies op het scherm waar het over
        gaat. De volledige lijst staat onder{" "}
        <Link to="/meldingen">Meldingen</Link>; na 90 dagen ruimt de app op.
      </p>
      <p>
        <strong>Pushmeldingen</strong> zijn het seintje erbovenop: dan trilt je
        toestel ook als de app dicht is. Zet ze aan bij je{" "}
        <Link to="/profiel?tab=privacy">instellingen</Link>, waar je ook kiest
        waarvoor je toestel mag piepen. Zet je er een uit, dan blijft die melding
        gewoon achter de bel staan — je krijgt er alleen geen duwtje meer bij.
      </p>
      <p>
        Deze app is een <strong>webapp</strong>: je kunt hem op je beginscherm
        zetten en dan opent hij als een gewone app, zonder adresbalk.
      </p>
      <dl className="uitleg__lijst">
        <dt>Android &amp; desktop</dt>
        <dd>
          Je browser biedt "Installeren" of "Toevoegen aan startscherm" zelf aan;
          anders staat het in het menu van de browser.
        </dd>
        <dt>iPhone &amp; iPad</dt>
        <dd>
          Open de app in Safari, tik op <strong>Deel</strong> en dan op{" "}
          <strong>Zet op beginscherm</strong>. Belangrijk: op iOS werkt push{" "}
          <em>alleen</em> als je de app zo geïnstalleerd hebt. Lukt het niet, dan
          is dat bijna altijd de reden. De bel in de app werkt hoe dan ook.
        </dd>
      </dl>
    </>
  );
}

export default Meldingen;
