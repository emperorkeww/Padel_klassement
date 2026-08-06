import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Aanwijzer-hooglicht voor het glasmateriaal (#1062).
 *
 * Het hooglicht op een interactief glasvlak volgt de muis. Dat via React-state
 * doen zou een rerender per muisbeweging kosten voor iets wat de pagina niet
 * eens opnieuw hoeft op te bouwen — het is puur verf. Deze hook schrijft de
 * positie daarom rechtstreeks als CSS-variabele op het element, hoogstens één
 * keer per frame.
 *
 * Op aanraakschermen levert het hooglicht niets op (er is geen aanwijzer die
 * ergens hangt) en kost het wél werk, dus daar geeft de hook lege handlers
 * terug: `undefined` op een React-prop betekent simpelweg geen listener.
 */

/** Is er een echte muis? Anders heeft een hooglicht dat de aanwijzer volgt
 *  geen betekenis. Defensief geschreven voor jsdom en oudere browsers. */
export function fijneAanwijzer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/** De aanwijzerpositie ten opzichte van het element, als CSS-lengtes. */
export function aanwijzerPositie(
  rect: { left: number; top: number },
  clientX: number,
  clientY: number,
): { x: string; y: string } {
  return {
    x: `${Math.round(clientX - rect.left)}px`,
    y: `${Math.round(clientY - rect.top)}px`,
  };
}

export type GlasAanwijzerHandlers = {
  onPointerMove?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: ReactPointerEvent<HTMLElement>) => void;
};

export function useGlasAanwijzer(actief = true): GlasAanwijzerHandlers {
  // Eén keer meten: matchMedia bij elke muisbeweging aanroepen is precies het
  // soort werk dat deze hook wil vermijden.
  const fijn = useRef<boolean | null>(null);
  if (fijn.current === null) fijn.current = fijneAanwijzer();

  const frame = useRef<number | null>(null);
  const wachtend = useRef<{
    el: HTMLElement;
    clientX: number;
    clientY: number;
  } | null>(null);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    // currentTarget is na de handler leeg; nu vastpakken, niet in het frame.
    wachtend.current = {
      el: e.currentTarget,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const w = wachtend.current;
      if (!w) return;
      const { x, y } = aanwijzerPositie(
        w.el.getBoundingClientRect(),
        w.clientX,
        w.clientY,
      );
      w.el.style.setProperty("--glas-aanwijzer-x", x);
      w.el.style.setProperty("--glas-aanwijzer-y", y);
    });
  }, []);

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    wachtend.current = null;
    // Terug naar de rustpositie uit glas.css, zodat het hooglicht niet blijft
    // hangen op de plek waar je het vlak verliet.
    e.currentTarget.style.removeProperty("--glas-aanwijzer-x");
    e.currentTarget.style.removeProperty("--glas-aanwijzer-y");
  }, []);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  if (!actief || !fijn.current) return {};
  return { onPointerMove, onPointerLeave };
}

export default useGlasAanwijzer;
