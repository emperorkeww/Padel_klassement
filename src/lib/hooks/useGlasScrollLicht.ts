import { useEffect, useRef } from "react";

/**
 * Scrollgestuurd hooglicht voor het glasmateriaal (#1083).
 *
 * `useGlasAanwijzer` laat het hooglicht de muis volgen, maar hangt aan
 * `(hover: hover) and (pointer: fine)`: op een telefoon geeft die hook lege
 * handlers terug en bestáát er dus geen licht. Dat is precies andersom aan waar
 * deze app gebruikt wordt. Wat overbleef was rand plus blur — het punt waar
 * gewone glassmorphism ook stopt.
 *
 * De vaste balken hebben wél een bewegingsbron die op elk apparaat bestaat: de
 * pagina schuift eronderdoor. Deze hook zet de horizontale positie van het
 * hooglicht op de voortgang door het document, zodat het licht één keer over de
 * balk trekt terwijl je van boven naar beneden leest. Deterministisch, en
 * daarmee ook een rustig signaal van waar je bent.
 *
 * Zelfde afspraken als de aanwijzer-hook: rechtstreeks op het element schrijven
 * (nul rerenders), hoogstens één keer per frame, en een passieve listener.
 * Wie minder beweging vraagt krijgt geen listener; het licht blijft dan op de
 * rustpositie uit glas.css staan. Dat is geen verlies — een stilstaande glans
 * is nog altijd meer materiaal dan geen glans.
 */

/** Waar in het document we staan, als 0..1. Past de pagina in beeld, dan is er
 *  niets te volgen en blijft het licht in het midden hangen. */
export function scrollVoortgang(
  scrollY: number,
  documentHoogte: number,
  vensterHoogte: number,
): number {
  const speling = documentHoogte - vensterHoogte;
  if (!(speling > 0)) return 0.5;
  return Math.min(1, Math.max(0, scrollY / speling));
}

export function useGlasScrollLicht<T extends HTMLElement>(actief = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !actief) return;
    // Defensief geschreven voor jsdom en oudere browsers, net als fijneAanwijzer.
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame: number | null = null;
    const schrijf = () => {
      frame = null;
      const voortgang = scrollVoortgang(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      el.style.setProperty("--glas-aanwijzer-x", `${Math.round(voortgang * 100)}%`);
    };
    const opScroll = () => {
      if (frame === null) frame = requestAnimationFrame(schrijf);
    };

    schrijf();
    window.addEventListener("scroll", opScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", opScroll);
      if (frame !== null) cancelAnimationFrame(frame);
      // Terug naar de rustpositie uit glas.css.
      el.style.removeProperty("--glas-aanwijzer-x");
    };
  }, [actief]);

  return ref;
}

export default useGlasScrollLicht;
