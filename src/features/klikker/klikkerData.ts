// De vaste inhoud van Rudi's Tactische Klikker (#260): vier categorieën met elk
// vier tikbare quotes. Dit is soundboard-content — bewust gescheiden van de
// reactieve sneer/lof-pools in roastTone.ts, die door wedstrijd-oppervlakken
// worden aangestuurd. De teksten komen letterlijk uit issue #260.

import type { CoachMood } from "@/features/coach/roastTone";
import type { SfxNaam } from "@/lib/utils/sfx";

export interface KlikkerQuote {
  id: string;
  /** Korte kop op de knop; met `sfxTitel` is het een regie-aanwijzing. */
  titel: string;
  /** Titel is een geluidsbeschrijving (bv. "driftig krabbelende pen") en wordt
   *  cursief tussen rechte haken gerenderd. */
  sfxTitel?: boolean;
  tekst: string;
  sfx: SfxNaam;
}

export interface KlikkerCategorie {
  id: string;
  titel: string;
  emoji: string;
  /** Avatar-stemming bij de quote-kaart van deze categorie. */
  mood: CoachMood;
  quotes: readonly KlikkerQuote[];
}

export const KLIKKER_CATEGORIEEN: readonly KlikkerCategorie[] = [
  {
    id: "notitieboekje",
    titel: "Het Heilige Notitieboekje",
    emoji: "📓",
    mood: "portret",
    quotes: [
      {
        id: "notitieboekje-schrijf",
        titel: "driftig krabbelende pen",
        sfxTitel: true,
        tekst:
          "Schrijf, schrijf, schrijf... En nu wachten we tot de 89e minuut om te kijken wat ik eigenlijk heb genoteerd.",
        sfx: "pen",
      },
      {
        id: "notitieboekje-meisterwerk",
        titel: "Das taktische Meisterwerk!",
        tekst:
          "Als ik het hier opteken in drie kleuren fluo, móét het op het veld wel werken. Dat de spelers het niet snappen, ligt aan de vertaling.",
        sfx: "pen",
      },
      {
        id: "notitieboekje-pagina43",
        titel: "bladzijde ruw omgeslagen",
        sfxTitel: true,
        tekst:
          "Pagina 43: 'Hoe overleven we de groepsfase zonder te scoren?' Ah, die pagina is nog leeg.",
        sfx: "page",
      },
      {
        id: "notitieboekje-prioriteiten",
        titel: "Prioriteiten",
        tekst:
          "Geen paniek, ik ben gewoon mijn boodschappenlijstje voor na de match aan het opschrijven. Spaghettisaus... gehakt... oh ja, en een wissel.",
        sfx: "pen",
      },
    ],
  },
  {
    id: "89e-minuut",
    titel: "De 89e Minuut",
    emoji: "🔄",
    mood: "gemeen",
    quotes: [
      {
        id: "wissel-masterclass",
        titel: "De Defensieve Masterclass",
        tekst:
          "We staan 1-0 achter in de 88e minuut? Snel, breng een extra verdedigende middenvelder! We moeten de schade beperken!",
        sfx: "whistle",
      },
      {
        id: "wissel-blitz",
        titel: "De 'Blitz-Wissel'",
        tekst:
          "Ik breng je in bij de blessuretijd van de tweede helft. Dan kun je tenminste de sfeer van het gras nog even opsnuiven.",
        sfx: "whistle",
      },
      {
        id: "wissel-rodeo",
        titel: "De Positie-Rodeo",
        tekst:
          "Jij bent een spits? Vandaag speel je linksback. Dat heet moderne 'flexibiliteit'. Zelfs de tegenstander snapt er niks van. Ik trouwens ook niet.",
        sfx: "whistle",
      },
      {
        id: "wissel-algoritme",
        titel: "Het Wissel-Algoritme",
        tekst:
          "Mijn wissels zijn als Belgische treinen: ze komen veel te laat en niemand begrijpt waarom ze op dat spoor rijden.",
        sfx: "whistle",
      },
    ],
  },
  {
    id: "zijlijn",
    titel: "Langs de Zijlijn",
    emoji: "🌧️",
    mood: "mild",
    quotes: [
      {
        id: "zijlijn-sproeiers",
        titel: "sissende watersproeiers + kletsnatte kleding",
        sfxTitel: true,
        tekst:
          "Een echte coach negeert de beregeningsinstallatie. Dit strakke Italiaanse maatpak droogt wel weer op. Maar die tactiek... die blijft nat.",
        sfx: "sprinkler",
      },
      {
        id: "zijlijn-pet",
        titel: "De Modebewuste Bondscoach",
        tekst:
          "Een pet met een maatpak is geen modeblunder, het is een tactische afleiding. Terwijl de vijand naar mijn pet kijkt, tikken wij de bal breed achterin.",
        sfx: "pen",
      },
      {
        id: "zijlijn-gebaren",
        titel: "De Drukke Gebaren",
        tekst:
          "Als ik maar hard genoeg zwaai met mijn armen, lijkt het alsof we aanvalspatronen hebben.",
        sfx: "whistle",
      },
      {
        id: "zijlijn-schuldenvrij",
        titel: "De Schuldenvrijheid",
        tekst:
          "Als we verliezen, ligt het aan de grasmat. Of aan de wind. Of aan de scheidsrechter. Mijn tactische opstelling was immers perfect.",
        sfx: "pen",
      },
    ],
  },
  {
    id: "persconferentie",
    titel: "De Persconferentie",
    emoji: "🎙️",
    mood: "trots",
    quotes: [
      {
        id: "pers-volwassen",
        titel: "Zeer Volwassen",
        tekst:
          "We hebben een heel volwassen wedstrijd gespeeld. Dat we nul schoten op doel hadden, was een bewuste keuze om de tegenstander in slaap te sussen.",
        sfx: "page",
      },
      {
        id: "pers-succes",
        titel: "De Definitie van Succes",
        tekst:
          "We hebben niet verloren, we hebben enkel de overwinning tactisch uitgesteld tot het volgende toernooi.",
        sfx: "page",
      },
      {
        id: "pers-analisten",
        titel: "De Analisten",
        tekst:
          "De analisten op tv praten over 'aanvallend voetbal'. Hebben die ooit met een notitieboekje in de regen gestaan? Ik dacht het niet.",
        sfx: "page",
      },
      {
        id: "pers-evaluatie",
        titel: "De Evaluatie",
        tekst:
          "We gaan dit intern evalueren. Ik heb al drie nieuwe schriften gekocht voor de analyse.",
        sfx: "pen",
      },
    ],
  },
];
