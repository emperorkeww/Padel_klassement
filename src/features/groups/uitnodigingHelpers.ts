// Wat er mis kan gaan met een uitnodigingslink, en wat de speler dan leest.
// Los van de component gehouden zodat de teksten en de herkenning van een
// oorzaak los te testen zijn (#923).

/** De herkenbare oorzaken. `onbekend_probleem` is de vangnet-tak. */
export type UitnodigingProbleem =
  | "verlopen"
  | "onbekend"
  | "niet_ingelogd"
  | "onbekend_probleem";

/** Waar de vervolgstap van een foutstaat naartoe gaat. */
export type UitnodigingActie = "hub" | "login" | "opnieuw";

export interface UitnodigingTekst {
  titel: string;
  tekst: string;
  actie: UitnodigingActie;
}

/**
 * Leidt de oorzaak af uit een fout van `redeem_group_invite` /
 * `group_invite_preview`. De functies zetten sinds #923 een stabiele code in
 * DETAIL; PostgREST geeft die door als `details`. Daarvóór was de Nederlandse
 * foutzin het enige onderscheid — die fallback staat er nog voor een omgeving
 * waar de migratie nog niet gedraaid heeft, maar nieuwe code hangt eraan vast
 * dat `details` de bron is.
 */
export function uitnodigingProbleem(err: unknown): UitnodigingProbleem {
  const fout = (err ?? {}) as { details?: unknown; code?: unknown; message?: unknown };
  const details = typeof fout.details === "string" ? fout.details : "";
  if (details === "uitnodiging_verlopen") return "verlopen";
  if (details === "uitnodiging_onbekend") return "onbekend";
  if (details === "niet_ingelogd") return "niet_ingelogd";

  // Een token dat geen uuid is (typefout in de link) haalt de functie niet
  // eens: Postgres struikelt al op de cast. Dat is voor de speler hetzelfde
  // geval als een ingetrokken link.
  if (fout.code === "22P02") return "onbekend";

  const bericht = typeof fout.message === "string" ? fout.message.toLowerCase() : "";
  if (bericht.includes("verlopen")) return "verlopen";
  if (bericht.includes("bestaat niet")) return "onbekend";
  return "onbekend_probleem";
}

export const UITNODIGING_TEKST: Record<UitnodigingProbleem, UitnodigingTekst> = {
  verlopen: {
    titel: "Deze uitnodiging is verlopen",
    tekst:
      "Uitnodigingslinks gaan na een paar weken op slot. Vraag iemand uit de groep om een nieuwe link — dat is één tik in de ledenlijst.",
    actie: "hub",
  },
  onbekend: {
    titel: "Deze uitnodiging bestaat niet meer",
    tekst:
      "De link is ingetrokken of niet helemaal goed overgenomen. Vraag degene die je uitnodigde om hem opnieuw te sturen.",
    actie: "hub",
  },
  niet_ingelogd: {
    titel: "Je bent niet meer ingelogd",
    tekst:
      "Log opnieuw in; daarna kom je vanzelf terug bij deze uitnodiging.",
    actie: "login",
  },
  onbekend_probleem: {
    titel: "De uitnodiging kon niet geladen worden",
    tekst: "Er ging onderweg iets mis. Probeer het zo nog een keer.",
    actie: "opnieuw",
  },
};

const DAG_MS = 24 * 60 * 60 * 1000;

/**
 * Korte vervalregel onder de groepsnaam, of null als die niets toevoegt: geen
 * einddatum, al verlopen (dat is een eigen scherm), of nog ruim een week te
 * gaan — dan is "verloopt over 12 dagen" alleen ruis.
 */
export function vervalTekst(
  expiresAt: string | null,
  nu: Date = new Date(),
): string | null {
  if (!expiresAt) return null;
  const over = new Date(expiresAt).getTime() - nu.getTime();
  if (Number.isNaN(over) || over <= 0 || over > 7 * DAG_MS) return null;
  const dagen = Math.floor(over / DAG_MS);
  if (dagen === 0) return "Deze link verloopt binnen een dag.";
  if (dagen === 1) return "Deze link verloopt over 1 dag.";
  return `Deze link verloopt over ${dagen} dagen.`;
}
