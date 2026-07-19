import { useCallback, useEffect, useRef, useState } from "react";

// Volkslied van El Padelissimo (#535): zolang er een dictator op de troon zit
// (#528/#530) en het spelerklassement zichtbaar is, loopt zijn dictator-muziek.
// Wélke track speelt bepaalt de aanroeper via `src`: de waarnemend Kylian Mbappé
// (#530) krijgt zijn eigen anthem, een écht clublid op de troon de imperial
// march. Geef `null` door en het is stil. Wisselt `src`, dan schakelt de hook
// naadloos naar de nieuwe track. De muziek stopt zodra je het klassement verlaat
// — andere route/tab, tabblad verbergen (visibilitychange), of de app sluiten
// (unmount/pagehide). Eén gedeeld Audio-element, netjes opgeruimd zodat er geen
// "ghost audio" doorspeelt.
//
// Browsers blokkeren autoplay mét geluid tot een user-gesture: lukt play() niet,
// dan zetten we `blocked` en biedt de UI een tap-to-play aan. De demp-voorkeur
// overleeft in localStorage, zodat het niet elke keer opdringt.

const MUTE_KEY = "dictator-anthem-muted";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // private mode / geen storage
  }
}

function writeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // storage onbeschikbaar: dan hooguit deze sessie niet onthouden.
  }
}

export interface DictatorAnthem {
  /** Speelt het lied nu daadwerkelijk. */
  playing: boolean;
  /** Autoplay geblokkeerd tot een user-gesture — toon een tap-to-play. */
  blocked: boolean;
  /** Door de gebruiker gedempt (onthouden in localStorage). */
  muted: boolean;
  /** Dempen aan/uit; persistent. */
  toggleMute: () => void;
  /** Handmatig starten na een tap (deblokkeert autoplay). */
  start: () => void;
}

/** Speelt de dictator-muziek `src` zolang die niet null is én het tabblad
 *  zichtbaar is; pauzeert en ruimt op zodra dat niet meer geldt. Een wisseling
 *  van `src` (andere heerser) schakelt de track om. */
export function useDictatorAnthem(src: string | null): DictatorAnthem {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Welke bron nu daadwerkelijk in het Audio-element geladen is; zodat we bij
  // een heerser-wissel de src maar één keer omzetten.
  const currentSrcRef = useRef<string | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const active = src != null;
  // Alleen spelen als er muziek gewenst is (src) én niet gedempt.
  const shouldPlay = active && !muted;

  // Lui één Audio-element aanmaken (preload none: geen netwerk tot play). De bron
  // zetten we pas bij het spelen, zodat een wisselende `src` één element deelt.
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    if (audioRef.current) return audioRef.current;
    if (typeof Audio === "undefined") return null;
    const a = new Audio();
    a.loop = true;
    a.preload = "none";
    audioRef.current = a;
    return a;
  }, []);

  // De gewenste bron in het element laden zodra die wijzigt (heerser-wissel).
  const applySrc = useCallback(
    (audio: HTMLAudioElement) => {
      if (src != null && currentSrcRef.current !== src) {
        audio.src = src;
        currentSrcRef.current = src;
      }
    },
    [src],
  );

  const play = useCallback((audio: HTMLAudioElement) => {
    let p: Promise<void> | undefined;
    try {
      p = audio.play() as Promise<void> | undefined;
    } catch {
      setBlocked(true);
      setPlaying(false);
      return;
    }
    if (p && typeof p.then === "function") {
      p.then(
        () => {
          setPlaying(true);
          setBlocked(false);
        },
        () => {
          // Autoplay geweigerd (geen user-gesture) — bied tap-to-play aan.
          setBlocked(true);
          setPlaying(false);
        },
      );
    } else {
      // Omgevingen zonder play()-promise (o.a. jsdom).
      setPlaying(true);
      setBlocked(false);
    }
  }, []);

  useEffect(() => {
    const audio = ensureAudio();
    if (!audio) return;

    const stop = () => {
      audio.pause();
      setPlaying(false);
    };
    const tryPlay = () => {
      if (!shouldPlay || src == null) return;
      if (typeof document !== "undefined" && document.hidden) return;
      applySrc(audio);
      play(audio);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else tryPlay();
    };

    if (shouldPlay) tryPlay();
    else stop();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
      stop(); // route-wissel / heerser-wissel / unmount: nooit doorspelen
    };
  }, [shouldPlay, src, ensureAudio, applySrc, play]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      writeMuted(next);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    if (muted || src == null) return;
    const audio = ensureAudio();
    if (!audio) return;
    applySrc(audio);
    play(audio);
  }, [muted, src, ensureAudio, applySrc, play]);

  return { playing, blocked, muted, toggleMute, start };
}