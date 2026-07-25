// AI-portretten: de stijlen en de beslissingen (#682, uit generate-dictator-avatar
// #554 getrokken).
//
// De dictator en de pias krijgen hetzelfde recept — gpt-image-1 image-*edit* op de
// profielfoto, in de vaste stijl van een referentiebeeld in de publieke
// avatars-bucket — en verschillen alleen in prompt, referentiepad, bestandsnaam en
// doelkolommen. Die verschillen staan hier als data (STIJLEN); het recept zelf
// staat één keer in aiPortretHandler.ts.
//
// Dit bestand raakt bewust géén Deno-globals en importeert geen `npm:`-modules,
// zodat de beslissingen los te unit-testen zijn met vitest (zie aiPortret.test.ts
// en de include-lijst in vite.config.ts) — hetzelfde patroon als cronAuth.ts.

/** Sentinel-bron voor een gebruiker zonder profielfoto: zo geldt een portret als
 *  vervallen zodra hij later wél een avatar uploadt (bron != avatar_url). Moet
 *  gelijk blijven aan GEEN_AVATAR_BRON in src/features/standings/dictatorPortret.ts. */
export const GEEN_AVATAR = "__geen_avatar__";

/** De publieke bucket waarin zowel de avatars, de stijlreferenties als de
 *  gegenereerde portretten leven. */
export const BUCKET = "avatars";

export type PortretSoort = "dictator" | "pias";

/** Alles wat één portretstijl onderscheidt van de andere. */
export interface PortretStijl {
  soort: PortretSoort;
  /** Bestandsnaam onder `{userId}/` in de bucket. */
  bestand: string;
  /** Pad van de vaste stijlreferentie binnen de bucket (eenmalig geseed met
   *  scripts/upload-*-referentie.mjs). */
  referentiePad: string;
  /** Kolom met de opt-out; 'false' = nooit naar OpenAI. */
  optOutKolom: string;
  /** Kolommen waarin het resultaat en z'n bron-avatar landen. */
  urlKolom: string;
  bronKolom: string;
  /** Vaste Engelse prompts (Engels voor modelkwaliteit; altijd letterlijk
   *  hetzelfde, zodat elk portret dezelfde look krijgt). */
  promptMetAvatar: string;
  promptZonderAvatar: string;
}

export const STIJLEN: Record<PortretSoort, PortretStijl> = {
  // #554: over-the-top militair dictator-portret in de stijl van de
  // waarnemend-dictator-referentie (groen uniform, medailles, imperiale pose).
  dictator: {
    soort: "dictator",
    bestand: "dictator.png",
    referentiePad: "_ref/dictator-stijl.png",
    optOutKolom: "dictator_portret",
    urlKolom: "dictator_avatar_url",
    bronKolom: "dictator_avatar_bron",
    promptMetAvatar:
      "Transform the person in the FIRST image into an over-the-top military padel " +
      "dictator. Preserve their facial likeness, identity and skin tone from the " +
      "FIRST image. Apply ONLY the visual style, uniform and composition of the " +
      "SECOND (reference) image: deep-green generalissimo uniform with gold " +
      "epaulettes, rows of medals and a sash, imperial upright pose, dramatic studio " +
      "lighting, matching color palette and framing. Head-and-shoulders square " +
      "portrait, centered, plain dramatic backdrop. Do NOT copy the reference " +
      "person's face — only their outfit and styling.",
    promptZonderAvatar:
      "Create an over-the-top military padel dictator portrait in the exact visual " +
      "style of the reference image (deep-green generalissimo uniform, gold " +
      "epaulettes, medals, sash, imperial pose, dramatic lighting, matching palette " +
      "and framing), but with a COMPLETELY DIFFERENT, invented, anonymous face — " +
      "clearly NOT the person in the reference image and not a real public figure. " +
      "Generic, non-identifiable ruler; do not reproduce the reference person's " +
      "likeness. Head-and-shoulders square portrait.",
  },
  // #682: de tegenhanger voor De Schandpaal — dezelfde persoon, maar als clown.
  // Spiegelt de dictator-prompt regel voor regel (gelijkenis uit de EERSTE foto,
  // styling uit de TWEEDE), zodat het verschil in het resultaat van de
  // referentie komt en niet van een anders geformuleerde prompt. Plagend, niet
  // vernederend: circusclown, geen karikatuur van de persoon zelf.
  pias: {
    soort: "pias",
    bestand: "pias.png",
    referentiePad: "_ref/pias-stijl.png",
    optOutKolom: "pias_portret",
    urlKolom: "pias_avatar_url",
    bronKolom: "pias_avatar_bron",
    promptMetAvatar:
      "Transform the person in the FIRST image into a good-natured circus clown. " +
      "Preserve their facial likeness, identity and skin tone from the FIRST image. " +
      "Apply ONLY the visual style, costume and composition of the SECOND " +
      "(reference) image: clown make-up, red nose, colourful ruffled collar and " +
      "costume, bright circus lighting, matching color palette and framing. " +
      "Head-and-shoulders square portrait, centered, plain colourful backdrop. " +
      "Keep it playful and warm, never grotesque or humiliating, and do not " +
      "exaggerate or distort their facial features. Do NOT copy the reference " +
      "person's face — only their outfit and styling.",
    promptZonderAvatar:
      "Create a good-natured circus clown portrait in the exact visual style of the " +
      "reference image (clown make-up, red nose, colourful ruffled collar and " +
      "costume, bright circus lighting, matching palette and framing), but with a " +
      "COMPLETELY DIFFERENT, invented, anonymous face — clearly NOT the person in " +
      "the reference image and not a real public figure. Generic, non-identifiable " +
      "clown; do not reproduce the reference person's likeness. Playful and warm, " +
      "never grotesque. Head-and-shoulders square portrait.",
  },
};

/** Het profiel zoals de handler het leest — enkel de velden die meebeslissen.
 *  De portret-kolommen staan er dynamisch in (per stijl verschillend). */
export type PortretProfiel = {
  avatar_url?: string | null;
  is_guest?: boolean | null;
} & Record<string, unknown>;

/** Welke bron hoort bij deze profielfoto? Zonder foto de sentinel, zodat het
 *  portret vervalt zodra er later wél een foto is. */
export function bronVoor(avatarUrl: string | null | undefined): string {
  return avatarUrl ?? GEEN_AVATAR;
}

/** Uitkomst van de auth-stap: voor wie mag deze request genereren? */
export type Aanroeppad =
  | { pad: "cron"; userId: string }
  /** User-JWT: de userId moet nog uit de token komen (Deno-kant). */
  | { pad: "user" }
  | { pad: "weiger"; status: number; error: string };

/**
 * Twee aanroeppaden, fail-closed (#460-patroon):
 *   1. Trusted server-trigger — juist `x-cron-secret` + body.userId: mag voor een
 *      willekeurige gebruiker.
 *   2. Client met user-JWT (geen cron-header): mag alleen voor zichzelf.
 * Een verkeerd of ongeconfigureerd geheim bij een meegestuurde header weigert
 * expliciet; er is géén stille terugval naar pad 2, want dan zou een aanvaller
 * met een gokje in de header op het user-pad belanden i.p.v. een 401 te krijgen.
 */
export function bepaalAanroeppad(
  cronHeader: string | null,
  cronSecret: string | undefined,
  bodyUserId: string | null | undefined,
): Aanroeppad {
  if (cronHeader) {
    if (!cronSecret || cronHeader !== cronSecret) {
      return { pad: "weiger", status: 401, error: "Geen toegang" };
    }
    if (!bodyUserId) {
      return { pad: "weiger", status: 400, error: "userId vereist" };
    }
    return { pad: "cron", userId: bodyUserId };
  }
  return { pad: "user" };
}

/** Reden om niets te genereren, of null als het door mag. */
export type OverslaanReden =
  | { reden: "guest" }
  | { reden: "opt-out" }
  | { reden: "cached"; url: string };

/**
 * Mag er voor dit profiel een portret gemaakt worden?
 *   - gast → nooit (geen account, geen eigen keuze);
 *   - opt-out uit → nooit (de foto gaat dan niet naar OpenAI);
 *   - het bewaarde portret hoort al bij déze bron → niets te doen (idempotent,
 *     zodat elke trigger-herhaling gratis is).
 */
export function overslaanReden(
  profiel: PortretProfiel,
  stijl: PortretStijl,
  bron: string,
): OverslaanReden | null {
  if (profiel.is_guest) return { reden: "guest" };
  if (profiel[stijl.optOutKolom] === false) return { reden: "opt-out" };
  const url = profiel[stijl.urlKolom];
  if (profiel[stijl.bronKolom] === bron && typeof url === "string" && url) {
    return { reden: "cached", url };
  }
  return null;
}

/** De prompt voor deze stijl: mét profielfoto blijft de gelijkenis behouden,
 *  zonder foto verzint het model een niet-identificeerbaar gezicht. */
export function promptVoor(stijl: PortretStijl, heeftAvatar: boolean): string {
  return heeftAvatar ? stijl.promptMetAvatar : stijl.promptZonderAvatar;
}
