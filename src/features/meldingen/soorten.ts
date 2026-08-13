import type { ComponentType } from "react";
import { IconBel } from "./components/IconBel";
import {
  IconHerinnering,
  IconLef,
  IconPias,
  IconPoll,
  IconRang,
  IconRonde,
  IconUitslag,
  IconVar,
  IconVriend,
} from "./components/SoortIconen";

/**
 * Wat een melding ís, in de taal van het scherm (#1273).
 *
 * De negen soorten stonden tot nu toe alleen in de database en in de Edge
 * Functions; de UI typte `soort` als string en gebruikte hem nergens. Veertien
 * rijen op rij lazen daardoor als één blok tekst. Deze map is de enige
 * frontend-bron voor icoon, accentfamilie en label.
 *
 * Spiegel van `Soort` in supabase/functions/_shared/meldingen.ts en van de
 * check-constraint in supabase/schemas/tables/27_notifications.sql. De
 * app-bundel kan niet uit supabase/functions importeren (Deno en src/ delen
 * geen boom — zie _shared/klok.ts), dus het huispatroon geldt: dupliceren met
 * een spiegel-commentaar, en een test die beide bronnen leest. Die staat in
 * soorten.test.ts.
 */
export type MeldingSoort =
  | "nieuwe_ronde"
  | "uitslag"
  | "vriendschapsverzoek"
  | "rangwissel"
  | "pias"
  | "poll"
  | "var"
  | "speeldag_herinnering"
  | "lef";

export interface SoortPresentatie {
  icoon: ComponentType;
  /** Tokenfamilie én css-modifier: --<familie>-soft als vlak, de bijhorende
   *  inkt erop. Alleen families die contrast-check.mjs al toetst. */
  familie: string;
  /** Korte naam van de gebeurtenis — voor schermlezers en, vanaf spoor C, het
   *  filter op /meldingen. */
  label: string;
}

export const SOORTEN = {
  nieuwe_ronde: { icoon: IconRonde, familie: "accent", label: "Nieuwe ronde" },
  poll: { icoon: IconPoll, familie: "poll", label: "Speeldag" },
  var: { icoon: IconVar, familie: "warn", label: "VAR" },
  uitslag: { icoon: IconUitslag, familie: "success", label: "Uitslag" },
  rangwissel: { icoon: IconRang, familie: "gold", label: "Klassement" },
  vriendschapsverzoek: {
    icoon: IconVriend,
    familie: "joker",
    label: "Vrienden",
  },
  speeldag_herinnering: {
    icoon: IconHerinnering,
    familie: "coach",
    label: "Herinnering",
  },
  lef: { icoon: IconLef, familie: "lef", label: "Lef" },
  pias: { icoon: IconPias, familie: "danger", label: "Roast" },
} satisfies Record<MeldingSoort, SoortPresentatie>;

/** Terugval voor een soort die deze bundel nog niet kent. Dat is geen
 *  theoretisch geval: de Edge Functions worden apart uitgerold, dus de server
 *  kan een tiende soort schrijven vóór de app hem kent. Daarom blijft
 *  `Melding.soort` ook een string. */
const ONBEKEND: SoortPresentatie = {
  icoon: IconBel,
  familie: "neutraal",
  label: "Melding",
};

export function soortInfo(soort: string): SoortPresentatie {
  return (SOORTEN as Record<string, SoortPresentatie>)[soort] ?? ONBEKEND;
}

/**
 * Haalt de emoji uit een servertitel.
 *
 * De titelpools in _shared/roast.ts rouleren, en de emoji staan er de ene keer
 * vóór ("🎾 Nieuwe ronde staat klaar") en de andere keer achter ("Gewonnen 🎉")
 * — of helemaal niet. In de lijst geeft dat een rafelige linkerrand naast een
 * icoon dat het symbool al draagt. In de púsh blijven ze staan: daar is er geen
 * icoonkolom en dragen ze wél.
 */
export function zonderEmoji(titel: string): string {
  const rand = /^[\p{Extended_Pictographic}️\s]+|[\p{Extended_Pictographic}️\s]+$/gu;
  const kaal = titel.replace(rand, "");
  // Een titel die alléén uit emoji bestaat houden we heel: liever een raar
  // symbool dan een lege regel.
  return kaal || titel.trim();
}
