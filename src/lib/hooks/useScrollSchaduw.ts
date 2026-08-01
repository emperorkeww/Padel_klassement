import { useCallback, useEffect, useState, type RefObject } from "react";

/** Waar staat nog inhoud buiten beeld? */
export type Schaduw = "geen" | "links" | "rechts" | "beide";

/** Onder deze afstand tot de rand rekenen we het als "helemaal aan het einde";
 *  sub-pixel-afrondingen zouden anders een fade laten hangen die niets dekt. */
const SPELING = 2;

export function schaduwVoor(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): Schaduw {
  const links = scrollLeft > SPELING;
  const rechts = scrollLeft + clientWidth < scrollWidth - SPELING;
  if (links && rechts) return "beide";
  if (links) return "links";
  if (rechts) return "rechts";
  return "geen";
}

/**
 * Vertelt of een horizontaal scrollende rij nog inhoud buiten beeld heeft
 * (#912).
 *
 * De filterchips van de feed lopen op telefoonbreedte gewoon van het scherm af,
 * zonder scrollbar en zonder enige aanwijzing dat er rechts meer staat. De
 * teruggegeven waarde voedt een `data-schaduw`-attribuut waar de CSS een fade
 * op tekent.
 *
 * Puur-CSS kan dit niet betrouwbaar zonder `animation-timeline`, en een fade
 * die er altijd staat liegt zodra je aan het einde bent aangekomen.
 */
export function useScrollSchaduw(ref: RefObject<HTMLElement | null>): Schaduw {
  const [schaduw, setSchaduw] = useState<Schaduw>("geen");

  const meet = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setSchaduw(schaduwVoor(el.scrollLeft, el.scrollWidth, el.clientWidth));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    meet();
    el.addEventListener("scroll", meet, { passive: true });
    // Breedtewissel (draaien, venster slepen) verandert wat er past. jsdom kent
    // ResizeObserver niet; dan volstaat de meting bij mount.
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(meet) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", meet);
      ro?.disconnect();
    };
  }, [ref, meet]);

  return schaduw;
}

export default useScrollSchaduw;
