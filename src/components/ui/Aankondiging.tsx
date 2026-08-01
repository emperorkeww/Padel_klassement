import { useEffect, useRef, useState } from "react";

/**
 * Beleefde aankondiging van de uitkomst van een gebruikersactie (#924).
 *
 * Filteren en zoeken veranderen de lijst zonder dat er iets verschuift dat een
 * screenreader oppikt: de chip krijgt `aria-pressed`, maar hoevéél er overblijft
 * hoor je nergens. Deze regel staat visueel verborgen in de pagina en meldt dat.
 *
 * Twee regels houden hem stil wanneer het hoort:
 *
 * - **Pas ná een gebruikersactie.** Zolang `sleutel` (de filter- of zoekstaat)
 *   niet is gewijzigd, zegt de regio niets. Anders zou elke pagina bij het laden
 *   zijn eigen inhoud opdreunen zodra de data binnenkomt.
 * - **Eén melding per rustmoment.** De tekst wordt pas gezet als er `vertraging`
 *   ms niets meer verandert, zodat typen in een zoekveld niet elke toetsaanslag
 *   aankondigt. Verandert de uitkomst daarna nog (een trage zoekopdracht die
 *   terugkomt), dan volgt alsnog de bijgewerkte telling.
 *
 * De staat leeft in refs die op waarde vergelijken in plaats van een
 * "eerste render"-vlag: effecten draaien in StrictMode twee keer, en een vlag
 * zou zichzelf dan bij het monteren al ontgrendelen.
 */
export function Aankondiging({
  bericht,
  sleutel,
  vertraging = 400,
}: {
  /** Wat er te melden valt, bv. "12 spelers gevonden". Leeg = niets melden. */
  bericht: string;
  /** De gebruikerskeuze waar dit bericht bij hoort (filter, zoekterm, tab). */
  sleutel: string;
  vertraging?: number;
}) {
  const [tekst, setTekst] = useState("");
  const vorigeSleutel = useRef(sleutel);
  const gewapend = useRef(false);

  useEffect(() => {
    if (Object.is(vorigeSleutel.current, sleutel)) return;
    vorigeSleutel.current = sleutel;
    gewapend.current = true;
  }, [sleutel]);

  useEffect(() => {
    if (!gewapend.current) return;
    const t = setTimeout(() => setTekst(bericht), vertraging);
    return () => clearTimeout(t);
  }, [sleutel, bericht, vertraging]);

  return (
    <p className="sr-only" role="status">
      {tekst}
    </p>
  );
}

export default Aankondiging;
