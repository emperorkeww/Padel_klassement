// Themabare microcopy voor pret-thema's (issue #134). Gecureerde teksten
// krijgen in het Smurfen-thema een speelse variant; elke tekst zonder variant
// valt terug op zichzelf. Foutmeldingen en bevestigingen blijven bewust
// standaard — leesbaarheid gaat vóór de grap (voice-guide in de issue).
import { useTheme, type ResolvedTheme } from "./theme";

const SMURF_COPY: Record<string, string> = {
  // Navigatie
  Overzicht: "Het Smurfendorp",
  Spelen: "Smurfen maar!",
  Feed: "Dorpsnieuws",
  Klassement: "Smurfenklassement",
  Ik: "Deze smurf",
  Matcharchief: "Smurfenarchief",
  Banen: "Smurfenbanen",
  Vrienden: "Mede-smurfen",
  Groepen: "Smurfengroepen",

  // Koppen & CTA's
  Matches: "Gesmurfde matches",
  Baanbeschikbaarheid: "Vrije smurfenbanen",
  "+ Match loggen": "+ Smurf een match",
  "Match plannen": "Plan een smurfmatch",
  "+ Log match": "+ Smurf match",
  "Plan match": "Plan een smurfmatch",
  "+ Plan een speeldag": "+ Smurf een speeldag",
  "Welkom terug": "Gesmurfde dag!",
  // Kampioensbanner: "Kampioen {seizoen}: naam" → "Grote Smurf van {seizoen}: naam".
  Kampioen: "Grote Smurf van",

  // Page-subtitles
  "Gesorteerd op rating — hoe vaak je speelt telt niet mee.":
    "Wie is de Grote Smurf? Gesorteerd op rating.",
  "Plan een match, log een uitslag of bekijk recente wedstrijden.":
    "Smurf een match, smurf een uitslag of blader door het archief.",
  "Van moment prikken tot uitslag — je groepen zijn het vertrekpunt.":
    "Van moment smurfen tot uitslag — het dorp speelt samen.",
  "Wat er speelt bij jou en je vrienden — nieuwste bovenaan.":
    "Wat er smurft in het dorp — nieuwste bovenaan.",
  "Zoek spelers, stuur verzoeken en beheer je vrienden.":
    "Zoek mede-smurfen en breid het dorp uit.",
  "Vrije padelbanen — rechtstreeks van Playtomic.":
    "Vrije smurfenbanen — rechtstreeks van Playtomic.",

  // Wizard (NewMatchSheet)
  "Wie speelden er?": "Welke smurfen speelden er?",
  "Wie spelen er?": "Welke smurfen spelen er?",
  "Wat was de eindscore?": "Hoe hard werd er gesmurfd?",

  // Succes-toasts (alleen deze vaste teksten; fouten blijven standaard)
  "Match toegevoegd.": "Gesmurfd! Match toegevoegd.",
  "Match gepland — je vindt hem bij Te spelen.":
    "Gesmurfd! Match gepland — je vindt hem bij Te spelen.",

  // Lege staten
  "Nog geen matches.": "Nog niets gesmurfd hier…",
  "Nog geen afgeronde matches.": "Nog geen gesmurfde matches.",
  "🎾": "🍄",
  "👋": "🍄",

  // Profiel (fun-verwijzingen uit de issue)
  "😤 Nemesis": "😈 Jouw Gargamel",
  "😎 Favoriete tegenstander": "😎 Jouw Azraël",
  "Beste maatje": "Jouw smurfenmaatje",
};

/** Vertaal een standaardtekst naar de skin-variant van het gegeven thema. */
export function skinText(std: string, theme: ResolvedTheme): string {
  return theme === "smurf" ? (SMURF_COPY[std] ?? std) : std;
}

/** React-hook: t() die live meewisselt met het actieve thema. */
export function useSkinText(): (std: string) => string {
  const theme = useTheme();
  return (std) => skinText(std, theme);
}
