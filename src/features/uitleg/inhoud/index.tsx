// Register van de sectie-inhoud voor /uitleg (#989). Eén bestand per sectie in
// deze map, hier aan zijn SectieId gekoppeld. `Uitleg.tsx` leest alleen dit
// register: welke secties bestaan, in welke volgorde ze staan en wat erin komt.
//
// Een sectie toevoegen is dus twee dingen: het component ernaast zetten en hem
// hieronder registreren. Wat niet in dit register staat, verschijnt ook niet in
// de inhoudsopgave — liever een ontbrekende sectie dan een lege belofte.

import type { ReactNode } from "react";
import type { Profile } from "@/types";
import type { SectieId } from "../secties";
import { AanDeSlag } from "./AanDeSlag";
import { Banen } from "./Banen";
import { Kaarten } from "./Kaarten";
import { Rating } from "./Rating";
import { Rudy } from "./Rudy";
import { Speeldag } from "./Speeldag";
import { Tiers } from "./Tiers";
import { Troon } from "./Troon";
import { Uitslagen } from "./Uitslagen";

/** Wat elke sectie van de kijker mag weten. Bewust smal: de uitleg gaat over de
 *  app, niet over jouw cijfers — alleen de voorbeeldkaarten worden persoonlijk. */
export interface SectieProps {
  /** Weergavenaam van de kijker; staat op de voorbeeld-spelerskaarten. */
  naam: string;
  /** Eigen profiel, voor de avatar op diezelfde kaarten. */
  profile?: Profile;
}

export const SECTIE_INHOUD: Partial<
  Record<SectieId, (props: SectieProps) => ReactNode>
> = {
  "aan-de-slag": AanDeSlag,
  speeldag: Speeldag,
  banen: Banen,
  uitslagen: Uitslagen,
  rating: Rating,
  tiers: Tiers,
  troon: Troon,
  kaarten: Kaarten,
  rudy: Rudy,
};

/** De id's die vandaag inhoud hebben. */
export const GEVULDE_SECTIES = Object.keys(SECTIE_INHOUD) as SectieId[];
