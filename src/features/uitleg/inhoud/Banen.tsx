import { Link } from "react-router-dom";

/** Sectie 3: baanbeschikbaarheid en de deelbare poster (#989). */
export function Banen() {
  return (
    <>
      <p>
        Op <Link to="/banen">Banen</Link> zie je per dag welke banen bij je club
        vrij zijn en wat ze kosten. Je kiest je club één keer; daarna onthoudt de
        app 'm. Naast de tijden staat het weer, zodat je een buitenbaan niet
        boekt op de enige regenachtige avond van de week.
      </p>
      <p>
        Twee weergaves: de <strong>dag</strong> als tijdschema per baan, en de{" "}
        <strong>week</strong> als raster om in één oogopslag een gaatje te vinden.
        Boeken zelf gebeurt bij de club — de app stuurt je door naar de juiste
        plek.
      </p>
      <p>
        De <strong>deelknop</strong> maakt een poster van de beschikbaarheid die
        je zo in de groepschat kunt plakken. Handig als je wilt polsen zonder
        meteen een hele speeldag op te tuigen.
      </p>
      <p className="uitleg__noot">
        De beschikbaarheid komt van de club en kan even achterlopen. Staat er een
        waarschuwing bij, ga dan af op de site van de club zelf.
      </p>
    </>
  );
}

export default Banen;
