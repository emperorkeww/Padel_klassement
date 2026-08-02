import { Link } from "react-router-dom";
import { sectieHref } from "../secties";

/** Sectie 12: wat je in de feed ziet, en van wie (#989). */
export function Feed() {
  return (
    <>
      <p>
        De <Link to="/feed">feed</Link> is het clubblad: uitslagen, promoties,
        reeksen, badges en de wekelijkse afgangen van je vrienden en je groepen.
        Coach Rudy voorziet het geheel van commentaar dat je liever niet over
        jezelf leest.
      </p>
      <p>
        Je ziet alleen wat je aangaat: matches van je vrienden en van de groepen
        waar je in zit. Wie je niet kent, zie je ook niet.
      </p>
      <p>
        <strong>Vrienden</strong> voeg je toe op{" "}
        <Link to="/vrienden">Vrienden</Link>, op gebruikersnaam. Naast de feed
        levert dat het onderlinge <strong>head-to-head</strong> op: hoe vaak je
        van elkaar wint, en wie er op dit moment de baas is. Wie liever niet
        gevonden wordt, zet zichzelf onvindbaar bij zijn{" "}
        <Link to={sectieHref("privacy")}>instellingen</Link>.
      </p>
      <p>
        Loopt een rivaliteit uit de hand, dan kun je er een{" "}
        <strong>vendetta</strong> van maken: een verklaarde aartsrivaliteit
        binnen je groep, waarbij jullie onderlinge duels een eigen seizoen
        vormen. Wie als eerste 3, 5 of 7 zeges pakt sinds de start, wint. Alleen
        duels waarin jullie écht tegenover elkaar staan tellen mee — samen in
        één team telt niet.
      </p>
    </>
  );
}

export default Feed;
