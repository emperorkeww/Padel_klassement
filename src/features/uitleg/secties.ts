// Inhoudsopgave van de "Hoe werkt het?"-pagina (#989) — de enige plek waar de
// secties en hun ankers staan. Zowel de pagina zelf (volgorde + koppen), de
// contextuele ?-knop in de app-shell als Rudy's regelpools in coachUitleg.ts
// lezen hieruit, zodat een sectie toevoegen één wijziging is.
//
// Bewust puur en zonder React: dit bestand is de gedeelde waarheid tussen de
// shell (die alleen een pathname kent) en de pagina (die componenten rendert).

/** Route van de pagina; hier gecentraliseerd zodat de deep-links niet los van
 *  de routedefinitie in App.tsx kunnen gaan zwerven. */
export const UITLEG_PAD = "/uitleg";

export type SectieId =
  | "aan-de-slag"
  | "speeldag"
  | "banen"
  | "uitslagen"
  | "rating"
  | "tiers"
  | "troon"
  | "kaarten"
  | "badges"
  | "toto"
  | "rudy"
  | "feed"
  | "seizoen"
  | "meldingen"
  | "privacy";

export interface UitlegSectie {
  /** Ankernaam én DOM-id: /uitleg#toto. */
  id: SectieId;
  /** Kop van de sectie en het label in de inhoudsopgave. */
  titel: string;
  /** Herkenbaar icoon vóór de kop; decoratief (aria-hidden). */
  emoji: string;
  /** Eén regel die in de inhoudsopgave verklapt wat er in de sectie staat. */
  samenvatting: string;
}

/** De secties in leesvolgorde: eerst wat je moet doen, dan wat de app ermee
 *  doet, dan de randzaken. Volgt de indeling uit #989. */
export const SECTIES: readonly UitlegSectie[] = [
  {
    id: "aan-de-slag",
    titel: "Aan de slag",
    emoji: "🚀",
    samenvatting: "Account, profielfoto, vrienden, groepen en gastspelers.",
  },
  {
    id: "speeldag",
    titel: "Een speeldag organiseren",
    emoji: "📅",
    samenvatting: "Van speelpoll tot rondes, teams en de eindstand.",
  },
  {
    id: "banen",
    titel: "Banen boeken",
    emoji: "🎾",
    samenvatting: "Beschikbaarheid, tarieven en de poster voor de groepschat.",
  },
  {
    id: "uitslagen",
    titel: "Uitslagen invoeren",
    emoji: "✍️",
    samenvatting: "De wizard, het scoreverloop en wie mag corrigeren.",
  },
  {
    id: "rating",
    titel: "Rating & klassement",
    emoji: "📈",
    samenvatting: "Hoe Elo werkt, en waarom de scoremarge niet meetelt.",
  },
  {
    id: "tiers",
    titel: "Tiers & divisies",
    emoji: "🏅",
    samenvatting: "De ladder van Sletje van de baan tot El Padelissimo.",
  },
  {
    id: "troon",
    titel: "De Troon & De Schandpaal",
    emoji: "👑",
    samenvatting: "Het dictatorschap, de pias en de Zwarte Piet.",
  },
  {
    id: "kaarten",
    titel: "Spelerskaarten",
    emoji: "🃏",
    samenvatting: "Welke edities er zijn en hoe je ze verdient.",
  },
  {
    id: "badges",
    titel: "Badges & mijlpalen",
    emoji: "🎖️",
    samenvatting: "Wat je kunt verdienen en waar het verschijnt.",
  },
  {
    id: "toto",
    titel: "Toto, Lef, drankjes & jokers",
    emoji: "🎲",
    samenvatting:
      "Voorspellen, dubbel-of-niets, waar de verliezers op trakteren en je kaart van de maand.",
  },
  {
    id: "rudy",
    titel: "Coach Rudy",
    emoji: "🎙️",
    samenvatting: "Wie hij is, en hoe je hem zachter of harder zet.",
  },
  {
    id: "feed",
    titel: "Feed & vrienden",
    emoji: "📣",
    samenvatting: "Wat je te zien krijgt, en van wie.",
  },
  {
    id: "seizoen",
    titel: "Seizoen & Wrapped",
    emoji: "🏆",
    samenvatting: "Kwartaaloverzichten, awards en de eregalerij.",
  },
  {
    id: "meldingen",
    titel: "Meldingen & installeren",
    emoji: "🔔",
    samenvatting: "Push aanzetten en de app op je beginscherm zetten.",
  },
  {
    id: "privacy",
    titel: "Privacy & instellingen",
    emoji: "🔒",
    samenvatting: "Wat er gedeeld wordt en wat je kunt uitzetten.",
  },
];

/** Snelle lookup voor de pagina; de volgorde blijft die van SECTIES. */
export const SECTIE_IDS: readonly SectieId[] = SECTIES.map((s) => s.id);

// Pad → sectie, van specifiek naar algemeen. Een prefix-match ("/groepen"
// dekt ook /groepen/:id/…), dus de langere paden staan boven de kortere.
const ANKERS: ReadonlyArray<[pad: string, id: SectieId]> = [
  ["/klassement", "rating"],
  ["/banen", "banen"],
  ["/matches", "uitslagen"],
  ["/spelen", "speeldag"],
  ["/groepen", "speeldag"],
  ["/feed", "feed"],
  ["/vrienden", "feed"],
  ["/profiel", "privacy"],
  ["/spelers", "kaarten"],
];

/**
 * De sectie die het dichtst bij het huidige scherm ligt, voor de contextuele
 * ?-knop in de app-shell. Null als er geen zinnige match is — dan opent de
 * pagina gewoon bovenaan.
 *
 * Het overzicht ("/") mapt bewust op "aan-de-slag": daar landt een nieuwkomer,
 * en dat is precies de sectie die hij nodig heeft. Alle andere paden matchen op
 * prefix, zodat /groepen/:id en /matches/:id meegaan met hun sectie.
 *
 * Let op: de tabs op /klassement (Divisies, Kaarten) zijn lokale state en staan
 * niet in de URL, dus die kunnen we hier niet onderscheiden — /klassement mapt
 * op "rating". De sprong naar #tiers en #kaarten loopt via de links ín
 * TierLegend en KaartLegenda zelf.
 */
export function uitlegAnker(pathname: string): SectieId | null {
  if (pathname === "/") return "aan-de-slag";
  if (pathname === UITLEG_PAD || pathname.startsWith(`${UITLEG_PAD}#`)) return null;
  const treffer = ANKERS.find(
    ([pad]) => pathname === pad || pathname.startsWith(`${pad}/`),
  );
  return treffer ? treffer[1] : null;
}

/** De doel-URL voor de ?-knop: /uitleg met het anker van het huidige scherm. */
export function uitlegHref(pathname: string): string {
  const anker = uitlegAnker(pathname);
  return anker ? `${UITLEG_PAD}#${anker}` : UITLEG_PAD;
}

/** Deep-link naar één sectie, voor de vraagteken-ingangen elders in de app. */
export function sectieHref(id: SectieId): string {
  return `${UITLEG_PAD}#${id}`;
}
