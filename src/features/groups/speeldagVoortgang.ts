import type { PollStatus } from "@/features/groups/pollsApi";

/**
 * Waar staat deze speeldag in zijn doorloop? (#1271)
 *
 * De pagina droeg drie flows onder elkaar — het moment vastleggen, de rondes
 * klaarzetten, de uitslagen invullen — zonder dat er ooit ergens stond wat de
 * volgorde was of waar je nu zat. Elke kaart wist het van zichzelf; niemand
 * wist het van het geheel.
 *
 * Verwant maar niet hetzelfde als `volgendeStap` in de agenda (#1121). Dat is
 * één zin per speeldag in een lijst over al je groepen heen, en die stopt bij
 * "er kan gespeeld worden". Hier is de speeldag zelf de pagina, dus de keten
 * loopt door tot de laatste uitslag.
 */

export type StapId = "stemmen" | "moment" | "baan" | "indeling" | "uitslagen";

export type SpeeldagStap = {
  id: StapId;
  /** Kort label voor de balk; de zin eronder zegt wat er te doen is. */
  label: string;
  klaar: boolean;
};

export type VoortgangInput = {
  status: PollStatus;
  /** Ligt er een moment vast? */
  heeftMoment: boolean;
  /** Wedstrijden van deze speeldag: klaargezet en afgerond. */
  totaal: number;
  gespeeld: number;
};

/**
 * De vijf stappen, elk met de vraag of hij af is.
 *
 * "Stemmen" is af zodra er niet meer gestemd wordt — ook bij een poll die
 * meteen werd vastgelegd. De baan geldt als geregeld bij status `booked`; dat
 * is precies wat `markPollBooked` zet, en de baannummers en toegangscode kunnen
 * later nog binnenkomen zonder dat de stap opnieuw openvalt.
 */
export function speeldagStappen(v: VoortgangInput): SpeeldagStap[] {
  const vastgelegd = v.heeftMoment && v.status !== "open";
  return [
    { id: "stemmen", label: "Stemmen", klaar: v.status !== "open" },
    { id: "moment", label: "Moment", klaar: vastgelegd },
    { id: "baan", label: "Baan", klaar: v.status === "booked" },
    { id: "indeling", label: "Indeling", klaar: v.totaal > 0 },
    {
      id: "uitslagen",
      label: "Uitslagen",
      klaar: v.totaal > 0 && v.gespeeld === v.totaal,
    },
  ];
}

/** De eerste stap die nog moet gebeuren, of null als alles af is. */
export function huidigeStap(stappen: SpeeldagStap[]): SpeeldagStap | null {
  return stappen.find((s) => !s.klaar) ?? null;
}

/**
 * Wat er nu te doen valt, in één zin.
 *
 * Bewust in de gebiedende wijs waar het kan: dit staat boven de kaart die de
 * handeling draagt, en een zin die alleen een toestand beschrijft ("de baan is
 * nog niet geboekt") laat je zelf zoeken waar dat dan moet.
 */
export function voortgangZin(v: VoortgangInput): string {
  const stap = huidigeStap(speeldagStappen(v));
  if (stap == null) return "Alles is rond — mooi gespeeld.";
  switch (stap.id) {
    case "stemmen":
      return "De groep stemt nog. Leg een moment vast zodra je genoeg weet.";
    case "moment":
      // Kan alleen bij een geannuleerde speeldag: niet open, en toch geen
      // moment. Dan is er niets meer te doen aan deze dag.
      return "Deze speeldag gaat niet door.";
    case "baan":
      return "Het moment staat vast — boek de baan.";
    case "indeling":
      return "De baan is geregeld — deel de wedstrijden in.";
    case "uitslagen":
      return `${v.gespeeld} van de ${v.totaal} uitslagen binnen.`;
  }
}
