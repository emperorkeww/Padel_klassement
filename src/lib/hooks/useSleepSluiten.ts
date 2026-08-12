import { useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";

/**
 * Veeg een bottom sheet omlaag om hem te sluiten (#1180).
 *
 * Een sheet die het halve scherm vult had tot nu toe alleen de achtergrond en
 * Escape om weg te gaan: op een telefoon betekent dat mikken op een randje, en
 * in de agenda-popup was er zelfs helemaal geen knop. Omlaag vegen is wat je
 * daar verwacht, dus doet elke sheet het nu.
 *
 * Bewust aanraking en geen pointer-events. `preventDefault()` moet in de eerste
 * bewegende frame gebeuren — anders neemt de browser het gebaar over — en
 * React's synthetische touchmove is passief, dus het wordt hoe dan ook een
 * native listener. Met touch-events is `setPointerCapture` bovendien niet nodig
 * (jsdom kent die niet). Slepen met de muis blijft dus uit: vanaf 640px is dit
 * een gecentreerde dialoog met een sluitknop, en daar zegt "omlaag vegen"
 * niets.
 *
 * De hook schrijft rechtstreeks op `element.style`, net als useGlasAanwijzer:
 * een rerender per vingerbeweging is verf, geen toestand.
 */

/** Voorbij deze afstand laat je los omdat je weg wilt, niet omdat je wiebelt. */
const SLUIT_AFSTAND = 96;
/** Een korte, besliste zwiep telt ook — dan hoeft de sheet niet ver mee. */
const SNELHEID = 0.6;
const SNELHEID_AFSTAND = 32;
/** Hoeveel vinger er mag verschuiven vóór we beslissen wiens gebaar dit is. */
const SLOP = 8;
/** Over hoeveel tijd de snelheid minstens gemeten wordt. */
const VENSTER_MS = 50;
/** En hoeveel er minstens verstreken moet zijn om er bij het loslaten nog een
 *  laatste meting uit te halen. Eén beeldje. */
const SLOT_MS = 16;

/** Sluiten of terugveren, gegeven hoe ver en hoe snel je losliet. */
export function besluit(dy: number, snelheid: number): "sluit" | "terug" {
  if (dy > SLUIT_AFSTAND) return "sluit";
  if (snelheid > SNELHEID && dy > SNELHEID_AFSTAND) return "sluit";
  return "terug";
}

/** Hoe dekkend de scrim nog is bij deze sleepafstand. Niet naar nul: de pagina
 *  eronder is geen bestemming, je bent de sheet aan het wegleggen. */
export function scrimFactor(dy: number): number {
  return 1 - Math.min(Math.max(dy, 0) / 400, 0.7);
}

/**
 * Zit er tussen `doel` en het paneel een eigen scrollvlak dat al gescrolld is?
 * Dan is die aan zet en wij niet — de clubkiezer in het plan-sheet is zo'n
 * vlak. Het paneel zelf toetsen we apart op `scrollTop`.
 */
function inNestScroller(doel: Element | null, paneel: Element): boolean {
  for (let n = doel; n && n !== paneel; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return true;
    if (n instanceof HTMLElement && n.dataset.sleep === "uit") return true;
  }
  return false;
}

export function useSleepSluiten(
  paneel: RefObject<HTMLDivElement | null>,
  scrim: RefObject<HTMLDivElement | null>,
  onClose: () => void,
  open: boolean,
): void {
  // Vrijwel elke aanroeper geeft een verse pijlfunctie mee. Zou die in de
  // afhankelijkheden staan, dan brak elke rerender van de ouder het gebaar af
  // (opruimen zet de transform terug) — en juist een sheet waarin je stemt of
  // een klok tikt, rendert tijdens het slepen.
  const sluitRef = useRef(onClose);
  sluitRef.current = onClose;

  useEffect(() => {
    const el = paneel.current;
    if (!open || !el) return;

    // Closure-variabelen in plaats van refs: ze leven precies zolang als het
    // gebaar, en niets buiten deze listeners kijkt ernaar.
    let startY = 0;
    let startX = 0;
    let dy = 0;
    let ankerY = 0;
    let ankerT = 0;
    let laatsteY = 0;
    let laatsteT = 0;
    let snelheid = 0;
    /** null zolang het gebaar nog niet beslist is. */
    let vanOns: boolean | null = null;
    let klaar = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let slikTimer: ReturnType<typeof setTimeout> | null = null;

    const zetScrim = (factor: number) => {
      scrim.current?.style.setProperty("--sheet-scrim", String(factor));
    };

    const veertKlasse = (aan: boolean) => {
      scrim.current?.classList.toggle("sheet-backdrop--veert", aan);
    };

    const opruimen = () => {
      el.style.transition = "";
      el.style.transform = "";
      zetScrim(1);
      veertKlasse(false);
    };

    const terug = () => {
      if (prefersReducedMotion()) {
        opruimen();
        return;
      }
      veertKlasse(true);
      el.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
      zetScrim(1);
    };

    /** De sheet uit beeld schuiven en dán pas sluiten, zodat hij niet halverwege
     *  de beweging verdwijnt. Geen keyframe: hij begint op de plek waar je hem
     *  losliet. Geen opacity: dat zou het glas doven (#1062). */
    const sluit = () => {
      if (klaar) return;
      klaar = true;
      if (prefersReducedMotion()) {
        sluitRef.current();
        return;
      }
      const hoogte = el.getBoundingClientRect().height || 480;
      veertKlasse(true);
      el.style.transition = "transform 180ms ease-in";
      el.style.transform = `translateY(${hoogte + 40}px)`;
      zetScrim(0);
      timer = setTimeout(af, 220);
    };

    const af = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      sluitRef.current();
    };

    const onEinde = (e: TransitionEvent) => {
      if (!klaar || e.target !== el || e.propertyName !== "transform") return;
      af();
    };

    /** Eindigt de vinger boven de achtergrond, dan synthetiseert de browser daar
     *  een klik — en die sluit de sheet die je net liet terugveren. Eén keer
     *  opslokken, en na een korte tijd weer loslaten voor als hij nooit komt. */
    const slikVolgendeKlik = () => {
      const laag = scrim.current;
      if (!laag) return;
      const slik = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      laag.addEventListener("click", slik, { capture: true, once: true });
      slikTimer = setTimeout(() => {
        laag.removeEventListener("click", slik, { capture: true });
      }, 350);
    };

    const onStart = (e: TouchEvent) => {
      vanOns = null;
      if (klaar) return;
      if (e.touches.length !== 1) {
        vanOns = false;
        return;
      }
      // Halverwege de inhoud omlaag vegen is scrollen, geen wegleggen.
      if (el.scrollTop > 0 || inNestScroller(e.target as Element, el)) {
        vanOns = false;
        return;
      }
      const t = e.touches[0];
      startY = t.clientY;
      startX = t.clientX;
      ankerY = t.clientY;
      ankerT = e.timeStamp;
      laatsteY = t.clientY;
      laatsteT = e.timeStamp;
      dy = 0;
      snelheid = 0;
    };

    const onBeweeg = (e: TouchEvent) => {
      if (vanOns === false || klaar || e.touches.length !== 1) return;
      const t = e.touches[0];
      const verschilY = t.clientY - startY;
      const verschilX = t.clientX - startX;

      if (vanOns === null) {
        if (Math.hypot(verschilX, verschilY) < SLOP) return;
        // Eén keer beslissen en dat volhouden: anders kaapt de sheet halverwege
        // een horizontale veeg (de dagstrip in de wizard scrollt zo).
        vanOns =
          verschilY > 0 && Math.abs(verschilY) > Math.abs(verschilX) * 1.2;
        if (!vanOns) return;
      }

      if (e.cancelable) e.preventDefault();

      // Snelheid over een venster en niet van beeldje tot beeldje: twee
      // gebeurtenissen in dezelfde milliseconde (de browser bundelt ze, en een
      // test vuurt ze achter elkaar af) geven anders een absurde uitschieter
      // waarmee een klein duwtje als zwiep telt.
      laatsteY = t.clientY;
      laatsteT = e.timeStamp;
      const dt = e.timeStamp - ankerT;
      if (dt >= VENSTER_MS) {
        snelheid = (t.clientY - ankerY) / dt;
        ankerY = t.clientY;
        ankerT = e.timeStamp;
      }

      dy = Math.max(0, verschilY);
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      zetScrim(scrimFactor(dy));
    };

    const onEind = () => {
      if (vanOns !== true || klaar) {
        vanOns = null;
        return;
      }
      vanOns = null;
      slikVolgendeKlik();
      // Een korte zwiep is voorbij vóór het venster ooit vol is; reken hem bij
      // het loslaten alsnog uit, mits er echt tijd overheen ging.
      const dt = laatsteT - ankerT;
      if (dt >= SLOT_MS) snelheid = (laatsteY - ankerY) / dt;
      if (besluit(dy, snelheid) === "sluit") sluit();
      else terug();
    };

    const onAfgebroken = () => {
      // Systeemgebaar, tweede vinger, telefoontje: altijd terug.
      if (vanOns === true && !klaar) terug();
      vanOns = null;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onBeweeg, { passive: false });
    el.addEventListener("touchend", onEind);
    el.addEventListener("touchcancel", onAfgebroken);
    el.addEventListener("transitionend", onEinde);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onBeweeg);
      el.removeEventListener("touchend", onEind);
      el.removeEventListener("touchcancel", onAfgebroken);
      el.removeEventListener("transitionend", onEinde);
      if (timer) clearTimeout(timer);
      if (slikTimer) clearTimeout(slikTimer);
      opruimen();
    };
  }, [paneel, scrim, open]);
}

export default useSleepSluiten;
