import { Link } from "react-router-dom";

/** Sectie 1: van leeg account tot je eerste match (#989). */
export function AanDeSlag() {
  return (
    <>
      <p>
        Je hebt een account, en verder nog niets. Drie dingen zetten je op weg —
        in deze volgorde, al mag je gerust vals spelen.
      </p>
      <ol className="uitleg__stappen">
        <li>
          <strong>Vul je profiel in.</strong> Een naam en een foto, bij je{" "}
          <Link to="/profiel">instellingen</Link>. Je foto komt op je
          spelerskaart, op het klassement en in de feed — een grijze cirkel met
          een letter erin doet dat allemaal een stuk minder goed.
        </li>
        <li>
          <strong>Zoek je speelmaten.</strong> Op{" "}
          <Link to="/vrienden">Vrienden</Link> vind je mensen op hun
          gebruikersnaam. Vrienden zie je terug in je feed en in het
          onderlinge head-to-head.
        </li>
        <li>
          <strong>Kom in een groep.</strong> Een groep is je eigen clubje met een
          eigen klassement, eigen speeldagen en een eigen pias. Richt er zelf een
          op via <Link to="/spelen">Spelen</Link>, of gebruik de uitnodigingslink
          die iemand je stuurde.
        </li>
      </ol>
      <p>
        <strong>Speelt er iemand mee zonder account?</strong> Voeg hem toe als{" "}
        <em>gastspeler</em>. Een gast telt gewoon mee in de uitslagen en in het
        klassement. Maakt hij later alsnog een account aan, dan kun je die gast
        aan zijn profiel koppelen — de hele historie verhuist mee, en de gast
        verdwijnt.
      </p>
    </>
  );
}

export default AanDeSlag;
