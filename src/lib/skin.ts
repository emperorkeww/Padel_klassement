// Themabare microcopy voor pret-thema's (issue #134). Gecureerde teksten
// krijgen in het Smurfen-thema een speelse variant; elke tekst zonder variant
// valt terug op zichzelf. Foutmeldingen en bevestigingen blijven bewust
// standaard — leesbaarheid gaat vóór de grap (voice-guide in de issue).
import { useTheme, type ResolvedTheme } from "./theme";

const SMURF_COPY: Record<string, string> = {
  // Navigatie
  Overzicht: "Smurfdorp",
  Spelen: "Smurfen",
  Feed: "Smurfnieuws",
  Klassement: "Smurfklassement",
  Ik: "Mijn smurf",
  Matcharchief: "Smurfarchief",
  Banen: "Smurfbanen",
  Vrienden: "Mede-smurfen",
  Groepen: "Smurfengroepen",

  // Koppen & CTA's
  Matches: "Gesmurfde matches",
  "+ Match loggen": "+ Smurf een match",
  "Match plannen": "Match smurfen",
  "+ Log match": "+ Smurf match",
  "Plan match": "Match smurfen",
  "+ Plan een speeldag": "+ Smurf een speeldag",
  "Welkom terug": "Welkom terug, smurf",
  // Kampioensbanner: "Kampioen {seizoen}: naam" → "Grote Smurf van {seizoen}: naam".
  Kampioen: "Grote Smurf van",

  // Lege staten
  "Nog geen matches.": "Nog niets gesmurfd hier…",
  "Nog geen afgeronde matches.": "Nog geen gesmurfde matches.",
  "🎾": "🍄",

  // Profiel (fun-verwijzingen uit de issue)
  "😤 Nemesis": "😈 Jouw Gargamel",
  "😎 Favoriete tegenstander": "😎 Favoriete smurf",
  "Beste maatje": "Jouw Brilsmurf",
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
