// De zes statistieken op de Glazenwasser-kaart (#834).
//
// De referentie zet onder de naamplaat zes kolommen in FIFA-stijl (STREEPEN 96,
// GLANS 98, …). Die 90-en-hoger zijn decoratie: de app heeft geen
// attributenmodel en gaat er ook geen verzinnen — een kaart die zelfbedachte
// cijfers als spelersdata presenteert, liegt. De kolommen dragen daarom de
// vaktaal van de referentie als label en de échte cijfers van deze speler als
// waarde, met per kolom een uitleg in de `title` zodat niemand hoeft te gokken
// waar een getal vandaan komt.
//
// Alles komt uit de gegevens die de kaart toch al heeft (dezelfde bron als de
// achterkant van de FUT-kaart: vorm, balans, klassement, punten), dus er is geen
// tweede waarheid die stil uit de pas kan lopen.

/** Wat een Glazenwasser-kaart nodig heeft om zijn statistiekenrij te vullen.
 *  Bewust een platte vorm en niet `Row` uit het klassement: de profielkaart en
 *  de dev-stage hebben dezelfde cijfers uit een andere bron. */
export interface GlazenwasserStatBron {
  /** Gespeelde matches. */
  gespeeld: number;
  gewonnen: number;
  gelijk: number;
  verloren: number;
  punten: number;
  /** Saldo van gewonnen en verloren games. */
  saldo: number;
  /** Positie in het klassement; null als die er niet is. */
  rang?: number | null;
  /** Recente uitslagen, nieuwste eerst of laatst — alleen de telling doet mee. */
  vorm?: readonly ("W" | "D" | "L")[];
}

export interface GlazenwasserStat {
  /** Korte kop boven de waarde, in de vaktaal van de referentie. */
  label: string;
  /** De waarde zoals hij op de kaart staat. */
  waarde: string;
  /** Wat de waarde betekent — komt in de `title` van de kolom. */
  uitleg: string;
}

/** Hoeveel recente uitslagen de vormkolom telt. */
const VORM_VENSTER = 5;

const geen = "—";

/** De zes kolommen, in de volgorde van de referentie. */
export function glazenwasserStats(
  bron: GlazenwasserStatBron,
): GlazenwasserStat[] {
  const { gespeeld, gewonnen, punten, saldo, rang } = bron;
  const vorm = (bron.vorm ?? []).slice(-VORM_VENSTER);
  const vormWinst = vorm.filter((v) => v === "W").length;
  const winst = gespeeld > 0 ? Math.round((gewonnen / gespeeld) * 100) : null;

  return [
    {
      label: "Streepen",
      waarde: gespeeld > 0 ? String(gespeeld) : geen,
      uitleg: "Gespeelde matches",
    },
    {
      label: "Glans",
      waarde: winst != null ? `${winst}%` : geen,
      uitleg: "Aandeel gewonnen matches",
    },
    {
      label: "Uithouding",
      waarde: gespeeld > 0 ? String(punten) : geen,
      uitleg: "Klassementpunten",
    },
    {
      label: "Hoogte",
      waarde: rang != null ? `#${rang}` : geen,
      uitleg: "Positie in het klassement",
    },
    {
      label: "Precisie",
      waarde: gespeeld > 0 ? `${saldo > 0 ? "+" : ""}${saldo}` : geen,
      uitleg: "Gamesaldo over alle matches",
    },
    {
      label: "Concentratie",
      waarde: vorm.length > 0 ? `${vormWinst}/${vorm.length}` : geen,
      uitleg: `Gewonnen van de laatste ${vorm.length || VORM_VENSTER} matches`,
    },
  ];
}
