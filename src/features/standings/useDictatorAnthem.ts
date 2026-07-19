import { useCallback, useEffect, useRef, useState } from "react";
import anthem from "@/features/dictator/components/km_dictator_anthem.mp3";

// Volkslied van El Padelissimo (#535): zolang Kylian Mbappé op de troon zit
// (#528/#530) en het spelerklassement zichtbaar is, loopt z'n dictator-anthem.
// Hij stopt zodra je het klassement verlaat — andere route/tab, tabblad
// verbergen (visibilitychange), of de app sluiten (unmount/pagehide). Eén
// gedeeld Audio-element, netjes opgeruimd zodat er geen "ghost audio" doorspeelt.
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

/** Speelt het dictator-volkslied zolang `active` waar is én het tabblad zichtbaar
 *  is; pauzeert en ruimt op zodra dat niet meer geldt. */
export function useDictatorAnthem(active: boolean): DictatorAnthem {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(readMuted);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Alleen spelen als het lied gewenst is én niet gedempt.
  const shouldPlay = active && !muted;

  // Lui één Audio-element aanmaken (preload none: geen netwerk tot play).
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    if (audioRef.current) return audioRef.current;
    if (typeof Audio === "undefined") return null;
    const a = new Audio(anthem);
    a.loop = true;
    a.preload = "none";
    audioRef.current = a;
    return a;
  }, []);

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
      if (!shouldPlay) return;
      if (typeof document !== "undefined" && document.hidden) return;
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
      stop(); // route-wissel / unmount: nooit doorspelen
    };
  }, [shouldPlay, ensureAudio, play]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      writeMuted(next);
      return next;
    });
  }, []);

  const start = useCallback(() => {
    if (muted) return;
    const audio = ensureAudio();
    if (audio) play(audio);
  }, [muted, ensureAudio, play]);

  return { playing, blocked, muted, toggleMute, start };
}
