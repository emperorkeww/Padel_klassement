import { useEffect } from "react";

/** Achtervoegsel achter elke paginatitel; gelijk aan de titel in index.html. */
const MERK = "Vamos!";

/**
 * Zet `document.title` voor de duur dat deze pagina gemount is (#910).
 *
 * Elke route deelde dezelfde tabtitel, waardoor de browserhistorie, gedeelde
 * tabs en de taakwisselaar van de PWA een rij identieke "Vamos!"-regels lieten
 * zien. Bij unmount gaat de titel terug naar het merk alleen.
 *
 * `null` betekent "de titel is er nog niet" (data laadt): dan blijft staan wat
 * er stond, in plaats van heen en weer te flitsen naar een tussentitel.
 */
export function usePageTitle(titel: string | null) {
  useEffect(() => {
    if (titel === null) return;
    document.title = `${titel} · ${MERK}`;
  }, [titel]);

  // Los effect zonder deps: het opruimen hoort bij het verlaten van de pagina,
  // niet bij elke titelwissel binnen dezelfde pagina (bv. tabwissel).
  useEffect(() => {
    return () => {
      document.title = MERK;
    };
  }, []);
}

export default usePageTitle;
