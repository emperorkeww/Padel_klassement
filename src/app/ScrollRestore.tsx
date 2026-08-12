import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll-restauratie voor de app-shell (#910).
 *
 * We draaien op `<BrowserRouter>`, niet op een data-router, dus React Router's
 * eigen `<ScrollRestoration>` is hier niet beschikbaar. Zonder dit landde je na
 * "terug" vanuit een matchdetail bovenaan het klassement in plaats van bij de
 * rij waar je vandaan kwam — op mobiel voelt dat als je plek kwijtraken.
 *
 * De pagina scrollt op `window` (`.content` heeft geen eigen overflow), dus we
 * bewaren simpelweg `window.scrollY` per history-entry (`location.key`).
 *
 * Wat er wanneer gebeurt (#1195):
 *
 * - POP (terug/vooruit) → de bewaarde positie van díe entry terugzetten.
 * - Een ánder pad → naar boven; je begint een nieuwe pagina.
 * - Hetzelfde pad → niets doen.
 *
 * Die laatste regel is er bijgekomen. Dit hing alleen aan `location.key`, en
 * een `replace` mint óók een nieuwe key (met navigatietype REPLACE, niet POP).
 * Elke pagina die zijn stand in de querystring bijhoudt — de agenda sinds
 * #1182, de Spelen-hub via speelParams, het klassement, de feed — schoot
 * daardoor bij élke filterklik naar de bovenkant. Gemeten op de agenda: een dag
 * aantikken bracht je van scrollpositie 450 naar 0, zonder dat er iets aan de
 * lay-out veranderde.
 */

const PREFIX = "scroll:";
/** Na zoveel frames stoppen we met wachten op inhoud en scrollen we alsnog. */
const MAX_FRAMES = 30;

// Node 22 en Safari-privémodus kunnen een kreupele of ontbrekende
// sessionStorage geven; een map-backed vangnet houdt de rest werkend.
const geheugen = new Map<string, string>();

function bewaar(sleutel: string, waarde: number) {
  try {
    sessionStorage.setItem(PREFIX + sleutel, String(waarde));
  } catch {
    geheugen.set(sleutel, String(waarde));
  }
}

function lees(sleutel: string): number {
  let ruw: string | null;
  try {
    ruw = sessionStorage.getItem(PREFIX + sleutel);
  } catch {
    ruw = geheugen.get(sleutel) ?? null;
  }
  const n = Number(ruw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ScrollRestore() {
  const { key, hash, pathname } = useLocation();
  const navigatie = useNavigationType();
  // Het pad van de vorige entry. Nodig omdat `key` ook verandert als je op
  // dezelfde pagina blijft en alleen de querystring verzet; zonder dit is een
  // filterklik niet te onderscheiden van een paginawissel.
  const vorigPad = useRef<string | null>(null);
  // Laatst waargenomen scrollpositie. Bij het verlaten van de pagina is
  // `window.scrollY` alweer door de browser bijgesteld op de nieuwe (kortere)
  // inhoud, dus die kunnen we op dat moment niet meer vertrouwen.
  const laatste = useRef(0);

  // De browser herstelt standaard zelf; dat botst met wat we hieronder doen.
  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const vorige = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = vorige;
    };
  }, []);

  // Positie van de huidige entry bijhouden.
  useEffect(() => {
    laatste.current = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      laatste.current = window.scrollY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        bewaar(key, laatste.current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      bewaar(key, laatste.current);
    };
  }, [key]);

  // Positie zetten na een routewissel.
  useEffect(() => {
    const zelfdePagina = vorigPad.current === pathname;
    vorigPad.current = pathname;

    // Een anker wint: daar wil de gebruiker expliciet heen.
    if (hash) return;

    // Blijf je op dezelfde pagina en ging je niet terug, dan verzette je alleen
    // de stand (een filter, een tab, een gekozen dag). Daar hoort de pagina
    // niet voor te verspringen.
    if (zelfdePagina && navigatie !== "POP") return;

    const doel = navigatie === "POP" ? lees(key) : 0;
    if (doel <= 0) {
      window.scrollTo(0, 0);
      laatste.current = 0;
      return;
    }

    // Routes zijn lazy geladen: bij het eerste frame is de nieuwe pagina nog
    // een skeleton en is de pagina te kort om naar `doel` te scrollen. Wachten
    // tot de inhoud er is, maar niet eindeloos.
    let frames = 0;
    let raf = 0;
    const probeer = () => {
      const hoogte = document.documentElement.scrollHeight - window.innerHeight;
      if (hoogte >= doel || ++frames > MAX_FRAMES) {
        window.scrollTo(0, doel);
        laatste.current = doel;
        return;
      }
      raf = requestAnimationFrame(probeer);
    };
    probeer();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key, hash, navigatie, pathname]);

  return null;
}

export default ScrollRestore;
