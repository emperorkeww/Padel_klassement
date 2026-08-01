import { useCallback, useEffect, useState } from "react";

/**
 * De gemeten breedte van een element, bijgehouden met een ResizeObserver.
 *
 * Bedoeld voor keuzes die aan de *beschikbare* breedte hangen in plaats van aan
 * de viewport: met een brede zijnavigatie is een kaart smaller dan het venster.
 * Een container query kan zo'n keuze wel visueel maken, maar niet voorkomen dat
 * beide varianten in de DOM staan (#913) — daarvoor moet de meting naar JS.
 *
 * Geeft een **callback-ref** terug, geen ref-object: het gemeten element
 * verschijnt vaak pas ná een laadstaat, en een effect op een ref-object ziet
 * die wissel niet — dan meet je één keer `null` en nooit meer.
 *
 * `breedte` is `null` zolang er niets zinnigs gemeten is: eerste render, geen
 * ResizeObserver (jsdom), of een element dat nog geen layout heeft (breedte 0
 * zegt niets, dat is niet "past niets"). De aanroeper kiest dan zelf zijn
 * standaardweergave.
 */
export function useContainerBreedte() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [breedte, setBreedte] = useState<number | null>(null);

  const meet = useCallback((w: number) => {
    setBreedte(w > 0 ? w : null);
  }, []);

  useEffect(() => {
    if (!node) return;
    // Meteen één meting: zo staat de juiste weergave er al bij de eerste paint,
    // in plaats van een frame lang de standaardkeuze.
    meet(node.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") meet(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, meet]);

  return { ref: setNode, breedte };
}

export default useContainerBreedte;
