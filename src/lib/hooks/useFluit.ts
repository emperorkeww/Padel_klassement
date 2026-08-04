import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/utils/motion";
import fluitBron from "@/features/coach/components/var_fluit.mp3";

// Scheidsrechtersfluit bij Rudy's VAR-uitspraak (#1025). In het spoor van
// useDictatorAnthem (#535), maar dit is een eenmalige knal en geen doorlopende
// track: geen loop, geen visibility-machinerie, alleen opruimen bij unmount.
//
// Waarom een dempknop én prefers-reduced-motion: geluid dat ongevraagd uit je
// broekzak komt is vervelender dan een animatie. Wie om minder beweging vraagt
// krijgt standaard ook geen fluit; wie hem expliciet aanzet wél.
//
// Browsers blokkeren geluid tot een user-gesture. Voor wie de beslissende stem
// uitbrengt valt de fluit binnen zijn eigen tik, dus die hoort hem; wie de
// uitspraak later in de feed ziet hoort hem pas na een interactie met de
// pagina. Lukt play() niet, dan gebeurt er stil niets — nooit een foutmelding
// over een geluidje.

const MUTE_KEY = "var-fluit-muted";
const GEFLOTEN_KEY = "var-fluit-gefloten";

function leesGedempt(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // private mode / geen storage
  }
}

function schrijfGedempt(gedempt: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, gedempt ? "1" : "0");
  } catch {
    // storage onbeschikbaar: dan hooguit deze sessie niet onthouden.
  }
}

/** Heeft deze uitspraak in deze sessie al gefloten? Voorkomt een fluitconcert
 *  wanneer je langs dezelfde feedkaart scrolt of de matchpagina herlaadt. */
function alGefloten(sleutel: string): boolean {
  try {
    const rauw = window.sessionStorage.getItem(GEFLOTEN_KEY);
    return rauw ? (JSON.parse(rauw) as string[]).includes(sleutel) : false;
  } catch {
    return false;
  }
}

function onthoudGefloten(sleutel: string) {
  try {
    const rauw = window.sessionStorage.getItem(GEFLOTEN_KEY);
    const lijst = rauw ? (JSON.parse(rauw) as string[]) : [];
    if (!lijst.includes(sleutel)) {
      // Kort houden: dit is een dedup-lijstje, geen historie.
      window.sessionStorage.setItem(
        GEFLOTEN_KEY,
        JSON.stringify([...lijst, sleutel].slice(-50)),
      );
    }
  } catch {
    // Zonder sessionStorage kan hij hooguit een tweede keer fluiten.
  }
}

export interface Fluit {
  /** Fluit één keer voor deze uitspraak. Dezelfde sleutel fluit niet opnieuw. */
  fluit: (sleutel: string) => void;
  /** Door de gebruiker gedempt (onthouden in localStorage). */
  muted: boolean;
  /** Dempen aan/uit; persistent. */
  toggleMute: () => void;
}

/**
 * Geeft een fluit-functie terug die per sleutel hooguit één keer klinkt.
 * De tekst blijft altijd de drager van de uitspraak: dit is versiering.
 */
export function useFluit(): Fluit {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(leesGedempt);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const fluit = useCallback(
    (sleutel: string) => {
      if (muted || prefersReducedMotion()) return;
      if (typeof Audio === "undefined") return; // jsdom / oude browsers
      if (alGefloten(sleutel)) return;
      onthoudGefloten(sleutel);

      if (!audioRef.current) {
        const a = new Audio(fluitBron);
        a.preload = "none";
        audioRef.current = a;
      }
      const audio = audioRef.current;
      try {
        audio.currentTime = 0;
        const p = audio.play() as Promise<void> | undefined;
        // Autoplay geweigerd (geen user-gesture): stil laten passeren.
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        // Geen geluid mogelijk — dat mag nooit de uitspraak in de weg zitten.
      }
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const volgende = !m;
      schrijfGedempt(volgende);
      return volgende;
    });
  }, []);

  return { fluit, muted, toggleMute };
}
