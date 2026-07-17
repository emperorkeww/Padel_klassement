// Inhoud van de vendetta-poster (#169): puur datawerk (geen canvas), zodat de
// opbouw los van het tekenen testbaar is — zelfde patroon als maandpiasPoster.
// Toon: triomf met een knipoog — plagen, geen kwetsen.

import { kiesUniek } from "@/features/coach/roastTone";

export interface VendettaPoster {
  /** Kop, vast: "VENDETTA BESLIST". */
  kop: string;
  /** De winnaar van het seizoen, groot. */
  winnaar: string;
  /** "verslaat <naam>"-regel. */
  versusRegel: string;
  /** Eindstand vanuit de winnaar, bv. "5–3". */
  stand: string;
  /** Speels onderschrift, deterministisch per seed. */
  onderschrift: string;
  /** Bijschrift onderaan: groepsnaam + seizoensdoel. */
  periodeLabel: string;
}

// {doel} wordt vervangen door het seizoensdoel.
const ONDERSCHRIFTEN: readonly string[] = [
  "De rekening is vereffend.",
  "Wraak is zoet — en heeft nu een eindstand.",
  "Seizoen gesloten, ego's geteld.",
  "Eerste tot {doel} — en iedereen weet door wie.",
  "Dit lijstje hang je toch gewoon boven je bed?",
];

/** Posterinhoud voor een besliste vendetta. `stand` vanuit de winnaar. */
export function vendettaPoster(input: {
  winnaar: string;
  verliezer: string;
  stand: string;
  groupName: string;
  doel: number;
  /** Bv. roastSeed(vendettaId) — iedereen ziet hetzelfde onderschrift. */
  seed: number;
}): VendettaPoster {
  return {
    kop: "VENDETTA BESLIST",
    winnaar: input.winnaar,
    versusRegel: `verslaat ${input.verliezer}`,
    stand: input.stand,
    onderschrift: kiesUniek(ONDERSCHRIFTEN, input.seed).replaceAll(
      "{doel}",
      String(input.doel),
    ),
    periodeLabel: `${input.groupName} · eerste tot ${input.doel}`,
  };
}
