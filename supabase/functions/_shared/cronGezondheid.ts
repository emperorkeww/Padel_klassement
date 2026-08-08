// Wanneer is een cron-job "te lang stil"? (#1049)
//
// Zelfde opzet als cronAuth.ts en adminAuth.ts: de beslissing is een pure
// functie zonder Deno-globals, netwerk of clients, zodat ze met Vitest vast te
// zetten is. De edge function haalt alleen de feiten op uit cron.job_run_details
// en laat het oordeel hier vallen.
//
// Het antwoord moet expres saai zijn. Een dashboard dat te snel rood wordt,
// leert je het te negeren — en dan heb je hetzelfde als nu, alleen met meer
// pixels.

/** Alleen de vormen die de snippets in supabase/snippets/ echt gebruiken. */
const MINUUT_LIJST = /^\d+(,\d+)*$/;
const ELKE_N = /^\*\/(\d+)$/;

/**
 * Hoeveel minuten er hoogstens tussen twee runs horen te zitten, of `null` als
 * de expressie buiten het ondersteunde repertoire valt.
 *
 * Bewust de *grootste* tussenruimte en niet de gemiddelde: `17,32,47 * * * *`
 * draait drie keer per uur, maar tussen 47 en 17 (het volgende uur) zit een gat
 * van 30 minuten. Reken je met het gemiddelde van 20, dan staat dat schema elke
 * nacht een half uur onterecht op rood.
 */
export function verwachtIntervalMinuten(schedule: string): number | null {
  const velden = schedule.trim().split(/\s+/);
  if (velden.length !== 5) return null;

  const [minuut, uur, dag, maand, weekdag] = velden;

  // Alles wat op dag-, maand- of weekdagniveau filtert, laten we met rust: dat
  // komt in dit project niet voor en een verkeerde gok is erger dan geen gok.
  if (dag !== "*" || maand !== "*" || weekdag !== "*") return null;

  if (uur !== "*") {
    // Eén keer per dag op een vast uur (`5 3 * * *`).
    if (!/^\d+$/.test(uur) || !/^\d+$/.test(minuut)) return null;
    return 24 * 60;
  }

  if (minuut === "*") return 1;

  const elkeN = ELKE_N.exec(minuut);
  if (elkeN) {
    const n = Number(elkeN[1]);
    // `*/40` springt van :40 naar :00 — dat gat is 20, niet 40. Het grootste
    // gat is dus het maximum van de stap en wat er van het uur overblijft.
    if (n <= 0 || n > 60) return null;
    const laatste = Math.floor(59 / n) * n;
    return Math.max(n, 60 - laatste);
  }

  if (MINUUT_LIJST.test(minuut)) {
    const punten = [...new Set(minuut.split(",").map(Number))].sort(
      (a, b) => a - b,
    );
    if (punten.some((p) => p < 0 || p > 59)) return null;
    if (punten.length === 1) return 60;
    let grootste = 60 - punten[punten.length - 1] + punten[0]; // over het uur heen
    for (let i = 1; i < punten.length; i++) {
      grootste = Math.max(grootste, punten[i] - punten[i - 1]);
    }
    return grootste;
  }

  return null;
}

/**
 * Hoe lang een job stil mag zijn voor hij rood wordt: zijn interval plus een
 * marge. De marge is de helft van het interval met een bodem van tien minuten,
 * zodat één gemiste of trage run nog geen alarm is maar twee dat wél zijn.
 */
export function drempelMinuten(intervalMinuten: number): number {
  return intervalMinuten + Math.max(10, Math.round(intervalMinuten / 2));
}

export type CronStatus =
  /** Draaide recent en slaagde. */
  | "ok"
  /** Staat op non-actief in cron.job — uitgezet, geen storing. */
  | "uit"
  /** De laatste run gaf een fout terug. */
  | "mislukt"
  /** Te lang niets gedaan. */
  | "laat"
  /** Staat gepland maar heeft nog nooit gedraaid. */
  | "nooit"
  /** Schema niet te lezen, of geen pg_cron: geen oordeel. */
  | "onbekend";

export interface CronJobFeiten {
  jobname: string;
  schedule: string;
  actief: boolean;
  laatste_start: string | null;
  laatste_status: string | null;
}

export interface CronOordeel {
  status: CronStatus;
  /** Minuten sinds de laatste run, of null als hij nooit draaide. */
  stilMinuten: number | null;
  /** Vanaf hoeveel minuten stilte dit rood wordt, of null bij "onbekend". */
  drempel: number | null;
}

/**
 * Beoordeelt één job. `nu` wordt meegegeven en niet uit Date.now() gehaald,
 * zodat de test geen klok hoeft te vervalsen.
 *
 * De volgorde is bewust: uitgezet vóór alles (dat is een keuze, geen storing),
 * daarna een mislukte run (die weet je zeker), en pas dan het oordeel op
 * stilte — dat laatste is het enige dat op een gok berust.
 */
export function beoordeelCron(
  job: CronJobFeiten,
  nu: Date,
): CronOordeel {
  if (!job.actief) return { status: "uit", stilMinuten: null, drempel: null };

  const interval = verwachtIntervalMinuten(job.schedule);
  const drempel = interval === null ? null : drempelMinuten(interval);

  if (job.laatste_start === null) {
    // Nooit gedraaid. Dat is een storing zodra hij actief staat — behalve als
    // het schema net is aangemaakt, en dat kunnen we hier niet zien.
    return { status: "nooit", stilMinuten: null, drempel };
  }

  const stil = Math.round(
    (nu.getTime() - new Date(job.laatste_start).getTime()) / 60000,
  );

  if (job.laatste_status !== null && job.laatste_status !== "succeeded") {
    return { status: "mislukt", stilMinuten: stil, drempel };
  }

  if (drempel === null) {
    return { status: "onbekend", stilMinuten: stil, drempel: null };
  }

  return {
    status: stil > drempel ? "laat" : "ok",
    stilMinuten: stil,
    drempel,
  };
}
