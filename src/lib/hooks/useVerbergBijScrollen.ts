import { useEffect, useState } from "react";

/** Kleine bewegingen (rubber-band, een tik op de pagina, een herberekende
 *  layout) mogen de knop niet laten knipperen. */
const DREMPEL = 8;

/** Bovenaan de pagina staat de knop altijd: daar ligt niets onder hem dat je
 *  net wilde raken, en meteen verdwijnen bij de eerste veeg voelt kapot. */
const RUSTZONE = 120;

/**
 * Verbergt een zwevende actie zodra je vooruit door de pagina scrollt (#942).
 *
 * De "+ Match loggen"-knop en de "Jouw positie"-chip staan `position: fixed`
 * rechtsonder en weten niets van wat eronder ligt: tijdens het scrollen kwamen
 * ze over de score-steppers en de Opslaan-knop van een matchkaart, en over de
 * rating van de klassementsrij eronder. Je kon die dus niet raken zonder eerst
 * verder te scrollen.
 *
 * Scroll je vooruit (naar beneden), dan schuift de knop weg en is de hoek vrij.
 * Scroll je terug of sta je bovenaan, dan staat hij er weer — dat is het moment
 * waarop je hem zoekt.
 */
export function useVerbergBijScrollen(): boolean {
  const [verborgen, setVerborgen] = useState(false);

  useEffect(() => {
    let vorige = window.scrollY;
    let frame = 0;
    // Aparte vlag in plaats van `frame` zelf: het id komt pas terug ná de
    // callback als requestAnimationFrame direct uitvoert, en dan zou een
    // achtergebleven id elke volgende meting overslaan.
    let gepland = false;

    const meet = () => {
      gepland = false;
      const nu = window.scrollY;
      const delta = nu - vorige;
      if (Math.abs(delta) < DREMPEL) return;
      vorige = nu;
      setVerborgen(delta > 0 && nu > RUSTZONE);
    };

    const onScroll = () => {
      // Bovenaan zonder drempelwerk terug in beeld: na een sprong naar boven
      // (ankerlink, nieuwe route) hoort de knop er meteen te staan.
      if (window.scrollY <= RUSTZONE) {
        vorige = window.scrollY;
        setVerborgen(false);
        return;
      }
      if (gepland) return;
      gepland = true;
      frame = requestAnimationFrame(meet);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return verborgen;
}

export default useVerbergBijScrollen;
