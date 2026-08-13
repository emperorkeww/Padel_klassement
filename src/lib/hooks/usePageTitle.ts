import { useLayoutEffect, useSyncExternalStore } from "react";

/** Achtervoegsel achter elke paginatitel; gelijk aan de titel in index.html. */
const MERK = "Vamos!";

/**
 * De titel van de pagina die nú gemount is, als losse store (#1299).
 *
 * De topbalk op mobiel wil dezelfde titel tonen die hier al voor `document.title`
 * wordt gezet. Een store i.p.v. een context: de shell hangt boven de routes, dus
 * de titel moet omhóóg — en alleen het `<span>` in de balk hoeft te luisteren,
 * niet de hele layout.
 */
let paginaTitel: string | null = null;
const luisteraars = new Set<() => void>();

function zetPaginaTitel(titel: string | null) {
  if (paginaTitel === titel) return;
  paginaTitel = titel;
  for (const luisteraar of luisteraars) luisteraar();
}

function abonneer(luisteraar: () => void) {
  luisteraars.add(luisteraar);
  return () => {
    luisteraars.delete(luisteraar);
  };
}

/**
 * De titel van de huidige pagina, of `null` zolang die onbekend is.
 *
 * Let op het verschil met `document.title`: daar betekent `null` "laat staan wat
 * er stond" (zie hieronder), hier betekent het "ik weet het nog niet". De balk
 * hoort dan het merk te tonen en niet de titel van de vórige pagina — die is
 * zichtbaar naast de nieuwe inhoud en dus fout, terwijl een tabtitel die één
 * fetch lang blijft hangen niemand stoort.
 */
export function usePaginaTitel(): string | null {
  return useSyncExternalStore(
    abonneer,
    () => paginaTitel,
    () => null,
  );
}

/**
 * Zet `document.title` voor de duur dat deze pagina gemount is (#910).
 *
 * Elke route deelde dezelfde tabtitel, waardoor de browserhistorie, gedeelde
 * tabs en de taakwisselaar van de PWA een rij identieke "Vamos!"-regels lieten
 * zien. Bij unmount gaat de titel terug naar het merk alleen.
 *
 * `null` betekent "de titel is er nog niet" (data laadt): dan blijft staan wat
 * er stond, in plaats van heen en weer te flitsen naar een tussentitel.
 *
 * Sinds #1299 voedt dezelfde aanroep de mobiele topbalk. Daarom een
 * layout-effect: bij een routewissel unmounten de oude pagina en mount de
 * nieuwe in dezelfde commit, en zo staat de nieuwe titel in de balk vóór de
 * eerstvolgende paint — anders zag je één frame de vorige titel boven de
 * nieuwe inhoud.
 */
export function usePageTitle(titel: string | null) {
  useLayoutEffect(() => {
    zetPaginaTitel(titel);
    if (titel === null) return;
    document.title = `${titel} · ${MERK}`;
  }, [titel]);

  // Los effect zonder deps: het opruimen hoort bij het verlaten van de pagina,
  // niet bij elke titelwissel binnen dezelfde pagina (bv. tabwissel).
  useLayoutEffect(() => {
    return () => {
      document.title = MERK;
      zetPaginaTitel(null);
    };
  }, []);
}

export default usePageTitle;
