import { useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";

/**
 * Veeg een rij opzij om hem weg te leggen (#1273).
 *
 * Zusje van useSleepSluiten (#1180), niet dezelfde hook: die is verticaal,
 * hangt aan de scrim en de sheet-transities, en laat horizontale gebaren juist
 * expliciet los — precies zodat dit hier kán. Wat wél letterlijk overgenomen is,
 * is de aanpak, want die is duur betaald: aanraking in plaats van pointer
 * (React's touchmove is passief, dus `preventDefault` vraagt hoe dan ook een
 * native listener), één keer beslissen wiens gebaar dit is en dat volhouden, en
 * de snelheid over een tijdvenster meten in plaats van van beeldje tot beeldje.
 *
 * De hook schrijft rechtstreeks op `element.style`: een rerender per
 * vingerbeweging is verf, geen toestand.
 */

/** Voorbij deze afstand laat je los omdat je hem weg wilt hebben. */
const WEG_AFSTAND = 96;
/** Een korte, besliste zwiep telt ook. */
const SNELHEID = 0.6;
const SNELHEID_AFSTAND = 40;
/** Hoeveel vinger er mag verschuiven vóór we beslissen wiens gebaar dit is. */
const SLOP = 8;
/** Over hoeveel tijd de snelheid minstens gemeten wordt. */
const VENSTER_MS = 50;

/** Wegleggen of terugveren, gegeven hoe ver en hoe snel je losliet. */
export function besluit(afstand: number, snelheid: number): "weg" | "terug" {
  if (afstand > WEG_AFSTAND) return "weg";
  if (snelheid > SNELHEID && afstand > SNELHEID_AFSTAND) return "weg";
  return "terug";
}

export function useRijVeeg(
  rij: RefObject<HTMLElement | null>,
  onWeg: () => void,
  actief = true,
): void {
  // Verse pijlfunctie per render is de regel, niet de uitzondering; in de deps
  // zou elke rerender van de lijst het gebaar afbreken.
  const wegRef = useRef(onWeg);
  wegRef.current = onWeg;

  useEffect(() => {
    const el = rij.current;
    if (!actief || !el) return;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let ankerX = 0;
    let ankerT = 0;
    let snelheid = 0;
    /** null zolang het gebaar nog niet beslist is. */
    let vanOns: boolean | null = null;
    let klaar = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const opruimen = () => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    };

    const terug = () => {
      if (prefersReducedMotion()) {
        opruimen();
        return;
      }
      el.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
      el.style.opacity = "";
    };

    const af = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      wegRef.current();
    };

    /** Eerst uit beeld schuiven, dán pas melden: anders knippert de rij weg
     *  terwijl je vinger nog beweegt. */
    const weg = () => {
      if (klaar) return;
      klaar = true;
      if (prefersReducedMotion()) {
        af();
        return;
      }
      const breedte = el.getBoundingClientRect().width || 320;
      el.style.transition = "transform 160ms ease-in, opacity 160ms ease-in";
      el.style.transform = `translateX(${-(breedte + 40)}px)`;
      el.style.opacity = "0";
      timer = setTimeout(af, 200);
    };

    const onStart = (e: TouchEvent) => {
      vanOns = null;
      if (klaar || e.touches.length !== 1) {
        vanOns = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      ankerX = t.clientX;
      ankerT = e.timeStamp;
      dx = 0;
      snelheid = 0;
    };

    const onBeweeg = (e: TouchEvent) => {
      if (vanOns === false || klaar || e.touches.length !== 1) return;
      const t = e.touches[0];
      const verschilX = t.clientX - startX;
      const verschilY = t.clientY - startY;

      if (vanOns === null) {
        if (Math.hypot(verschilX, verschilY) < SLOP) return;
        // Alleen naar links, en alleen als het duidelijk horizontaal is: de
        // lijst scrollt verticaal, en dat gebaar blijft van de pagina.
        vanOns =
          verschilX < 0 && Math.abs(verschilX) > Math.abs(verschilY) * 1.2;
        if (!vanOns) return;
      }

      if (e.cancelable) e.preventDefault();

      const dt = e.timeStamp - ankerT;
      if (dt >= VENSTER_MS) {
        snelheid = (ankerX - t.clientX) / dt;
        ankerX = t.clientX;
        ankerT = e.timeStamp;
      }

      dx = Math.min(0, verschilX);
      el.style.transition = "none";
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 260));
    };

    const onEind = () => {
      if (vanOns !== true || klaar) {
        vanOns = null;
        return;
      }
      vanOns = null;
      if (besluit(Math.abs(dx), snelheid) === "weg") weg();
      else terug();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onBeweeg, { passive: false });
    el.addEventListener("touchend", onEind);
    el.addEventListener("touchcancel", onEind);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onBeweeg);
      el.removeEventListener("touchend", onEind);
      el.removeEventListener("touchcancel", onEind);
      if (timer) clearTimeout(timer);
      opruimen();
    };
  }, [rij, actief]);
}
