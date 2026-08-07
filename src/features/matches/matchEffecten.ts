// Welke bijzondere effecten er op een match liggen (#1151).
//
// Lef, joker en drankje-inzet kregen tot nu toe elk hun eigen gekleurde
// tekstregel onder de score, en verder niets. Die regels blijven, maar de kaart
// gaat er ook een achtergrond op zetten: één zachte kleurlaag per actief effect.
// Daarvoor is een boolean nodig waar tot nu toe alleen een string stond.
//
// Het uitgangspunt van dat ontwerp staat of valt met deze module: effecten zijn
// **onafhankelijke lagen**, geen combinatiethema's. Er is geen "lef+joker" en er
// komt er ook geen — de kaart krijgt drie vlaggen en stelt daaruit zijn
// achtergrond samen. Bij een vierde effect is dit bestand het enige dat het weet.
//
// Let op waar `lef` en `joker` vandaan komen: uit de *al gefilterde* regels van
// lefKaartRegel() en jokerKaartRegel(), niet uit match_stakes/match_jokers zelf.
// Dat is geen toeval en geen luiheid — zie de waarschuwing bij matchEffecten().

import { traktatieVervallen } from "@/features/matches/drankkaart";
import type { Match } from "@/types";

/** De drie effecten die een matchkaart kan dragen. Bewust los van elkaar. */
export interface MatchEffecten {
  /** Lef-tip (#804): iemand zette dubbel of niets in. */
  lef: boolean;
  /** Joker (#1003): er lag een kaart — schild, dubbel of niets, wissel. */
  joker: boolean;
  /** Drankje-inzet (#1004), alleen zolang er nog iets te halen valt. */
  inzet: boolean;
}

/** Geen enkel effect actief. Gedeeld zodat de "gewone kaart" één ding is. */
export const GEEN_EFFECTEN: MatchEffecten = {
  lef: false,
  joker: false,
  inzet: false,
};

/**
 * Welke effecten deze kaart mag laten zien.
 *
 * ⚠️ `lef` en `joker` komen als **regel** binnen, niet als tabelrij, en dat is
 * de hele veiligheidsconstructie. `lefGestart()` en `zichtbareJokers()` houden
 * vóór de aftrap verborgen wie er dubbel of niets speelde — zonder die poort
 * lift de rest van de groep mee op andermans risico. Een swirl die rechtstreeks
 * aan match_stakes hangt lekt dat alsnog: de tekstregel blijft weg, maar de
 * kaart kleurt paars. Door hier op de al gefilterde regel te varen kán de poort
 * niet omzeild worden — geen regel is geen kleur, per constructie.
 *
 * `inzet` mag wél uit de matchrij komen: die staat er voor iedereen op. Wel
 * dooft hij zodra er niets meer te halen valt (afgelast of gelijkspel) — een
 * afgelaste match met een volle amberen swirl leest als een openstaande
 * rekening. Een ingeloste traktatie houdt zijn kleur: dat is opschepmateriaal,
 * precies waarom die regel ook blijft staan.
 */
export function matchEffecten(opts: {
  match: Match;
  /** Kant-en-klaar uit lefKaartRegel(); null/undefined = geen of nog verborgen. */
  lef?: string | null;
  /** Kant-en-klaar uit jokerKaartRegel(); zelfde afspraak. */
  joker?: string | null;
}): MatchEffecten {
  return {
    lef: !!opts.lef,
    joker: !!opts.joker,
    inzet: !!opts.match.wager_drink && !traktatieVervallen(opts.match),
  };
}

/** Draagt deze kaart überhaupt een effect? Scheelt de aanroeper drie ors. */
export function heeftEffect(fx: MatchEffecten): boolean {
  return fx.lef || fx.joker || fx.inzet;
}
