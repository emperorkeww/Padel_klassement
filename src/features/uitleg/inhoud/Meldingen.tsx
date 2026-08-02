import { Link } from "react-router-dom";

/** Sectie 14: push aanzetten en de app installeren (#989).
 *
 *  De soorten meldingen spiegelen NOTIFICATIE_OPTIES in ProfileSettings. De
 *  iOS-uitzondering is geen detail: daar wérkt push pas ná het installeren, en
 *  wie dat niet weet denkt dat de app stuk is. */
export function Meldingen() {
  return (
    <>
      <p>
        Zet <strong>meldingen</strong> aan bij je{" "}
        <Link to="/profiel">instellingen</Link> en je mist geen speelpoll meer.
        Je kiest zelf waarvoor: een nieuwe ronde, een uitslag, een
        vriendschapsverzoek, een herinnering vlak voor je match, of je eigen
        promotie en degradatie. Alles uit mag ook.
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
          <strong>Zet op beginscherm</strong>. Belangrijk: op iOS werken
          meldingen <em>alleen</em> als je de app zo geïnstalleerd hebt. Lukt
          push niet, dan is dat bijna altijd de reden.
        </dd>
      </dl>
    </>
  );
}

export default Meldingen;
