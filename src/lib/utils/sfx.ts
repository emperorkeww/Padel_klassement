// Kleine geluidseffecten voor speelse UI (#260): procedureel gesynthetiseerd
// via de Web Audio API, dus zonder audiobestanden in de bundel. Alle geluid
// start vanuit een user-gesture (tap/click), zodat autoplay-beleid geen rol
// speelt. Omgevingen zonder AudioContext (jsdom in tests, oude browsers) doen
// stil niets — zelfde defensieve stijl als haptics.ts.

import { readFlag, writeFlag } from "@/lib/utils/localFlag";

export type SfxNaam = "pen" | "page" | "sprinkler" | "whistle";

// Vlagwaarde "1" = geluid uit; afwezig of iets anders = aan.
const MUTE_FLAG = "sfx:uit";

/** Of geluidseffecten aan staan (gebruikersvoorkeur, bewaard in localStorage). */
export function sfxAan(): boolean {
  return readFlag(MUTE_FLAG) !== "1";
}

export function setSfxAan(aan: boolean): void {
  writeFlag(MUTE_FLAG, aan ? "0" : "1");
}

// Eén gedeelde AudioContext, lui aangemaakt bij het eerste geluid. Safari
// suspendt agressief (o.a. na tab-wissel), dus bij elk gebruik hervatten.
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
    return null;
  }
  ctx ??= new window.AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Eén seconde witte ruis, eenmalig gevuld — de grondstof voor pen, pagina en
// sproeier. Loopbaar voor langere effecten.
let ruisBuffer: AudioBuffer | null = null;

function ruis(ac: AudioContext): AudioBuffer {
  if (!ruisBuffer) {
    ruisBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = ruisBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return ruisBuffer;
}

// Pen-gekrabbel: een paar korte ruis-bursts door een bandpass rond ~3 kHz, met
// wat jitter in timing/toonhoogte zodat het als schrijven klinkt, niet als tikken.
function speelPen(ac: AudioContext) {
  const t0 = ac.currentTime;
  for (let i = 0; i < 4; i++) {
    const start = t0 + i * 0.09 + Math.random() * 0.02;
    const duur = 0.05 + Math.random() * 0.03;
    const bron = ac.createBufferSource();
    bron.buffer = ruis(ac);
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2600 + Math.random() * 900;
    band.Q.value = 1.2;
    const vol = ac.createGain();
    vol.gain.setValueAtTime(0, start);
    vol.gain.linearRampToValueAtTime(0.22 + Math.random() * 0.12, start + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.001, start + duur);
    bron.connect(band).connect(vol).connect(ac.destination);
    bron.start(start);
    bron.stop(start + duur + 0.02);
  }
}

// Pagina-omslag: één ruis-woesj waarvan de highpass omhoog veegt — het geluid
// van papier dat langs je duim schiet.
function speelPage(ac: AudioContext) {
  const t0 = ac.currentTime;
  const bron = ac.createBufferSource();
  bron.buffer = ruis(ac);
  const hoog = ac.createBiquadFilter();
  hoog.type = "highpass";
  hoog.frequency.setValueAtTime(400, t0);
  hoog.frequency.exponentialRampToValueAtTime(4000, t0 + 0.22);
  const vol = ac.createGain();
  vol.gain.setValueAtTime(0, t0);
  vol.gain.linearRampToValueAtTime(0.3, t0 + 0.03);
  vol.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
  bron.connect(hoog).connect(vol).connect(ac.destination);
  bron.start(t0);
  bron.stop(t0 + 0.3);
}

// Watersproeier: laag-gefilterde ruis, in amplitude gehakt door een ~15 Hz LFO
// (het tik-tik-tik van een roterende sproeier), met fade-in/-uit.
function speelSprinkler(ac: AudioContext) {
  const t0 = ac.currentTime;
  const duur = 1.8;
  const bron = ac.createBufferSource();
  bron.buffer = ruis(ac);
  bron.loop = true;
  const laag = ac.createBiquadFilter();
  laag.type = "lowpass";
  laag.frequency.value = 1200;
  const hak = ac.createGain();
  hak.gain.value = 0.14;
  const lfo = ac.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 15;
  const lfoDiepte = ac.createGain();
  lfoDiepte.gain.value = 0.1;
  lfo.connect(lfoDiepte).connect(hak.gain);
  const vol = ac.createGain();
  vol.gain.setValueAtTime(0, t0);
  vol.gain.linearRampToValueAtTime(1, t0 + 0.15);
  vol.gain.setValueAtTime(1, t0 + duur - 0.4);
  vol.gain.linearRampToValueAtTime(0, t0 + duur);
  bron.connect(laag).connect(hak).connect(vol).connect(ac.destination);
  bron.start(t0);
  bron.stop(t0 + duur);
  lfo.start(t0);
  lfo.stop(t0 + duur);
}

// Scheidsrechtersfluitje: twee licht ontstemde sinussen rond 2,2 kHz met een
// snelle vibrato — de klassieke "roller" in het fluitje.
function speelWhistle(ac: AudioContext) {
  const t0 = ac.currentTime;
  const duur = 0.4;
  const vol = ac.createGain();
  vol.gain.setValueAtTime(0, t0);
  vol.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
  vol.gain.setValueAtTime(0.18, t0 + duur - 0.08);
  vol.gain.exponentialRampToValueAtTime(0.001, t0 + duur);
  vol.connect(ac.destination);
  const vibrato = ac.createOscillator();
  vibrato.frequency.value = 24;
  const vibratoDiepte = ac.createGain();
  vibratoDiepte.gain.value = 60;
  vibrato.connect(vibratoDiepte);
  for (const freq of [2150, 2215]) {
    const toon = ac.createOscillator();
    toon.type = "sine";
    toon.frequency.value = freq;
    vibratoDiepte.connect(toon.frequency);
    toon.connect(vol);
    toon.start(t0);
    toon.stop(t0 + duur);
  }
  vibrato.start(t0);
  vibrato.stop(t0 + duur);
}

const RECEPTEN: Record<SfxNaam, (ac: AudioContext) => void> = {
  pen: speelPen,
  page: speelPage,
  sprinkler: speelSprinkler,
  whistle: speelWhistle,
};

/** Speel een kort effect af. Stil bij mute of zonder audio-ondersteuning. */
export function playSfx(naam: SfxNaam): void {
  if (!sfxAan()) return;
  try {
    const ac = audioContext();
    if (ac) RECEPTEN[naam](ac);
  } catch {
    // audio mag nooit de UI breken
  }
}
