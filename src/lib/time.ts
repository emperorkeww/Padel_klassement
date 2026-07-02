/* Kloktijd-helpers ("HH:MM") en tijdzone-bewuste "vandaag"/"nu".
   Gebruikt door het beschikbaarheidsraster, dat in clubtijd rekent. */

export function toMinutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

export function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Kalenderdatum (YYYY-MM-DD) + aantal dagen, zonder tijdzone-verrassingen. */
export function addDays(date: string, days: number): string {
  // 's Middags rekenen, zodat een DST-omschakeling de datum niet kan kantelen.
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Kolommen van het raster: elke stap van openings- tot sluitingstijd. */
export function buildTimeAxis(open: string, close: string, stepMin = 30): string[] {
  const times: string[] = [];
  for (let m = toMinutes(open); m < toMinutes(close); m += stepMin) {
    times.push(fromMinutes(m));
  }
  return times;
}

/** Datum (YYYY-MM-DD) van vandaag + offsetDays in de opgegeven tijdzone. */
export function dateInZone(timeZone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA formatteert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Minuten sinds middernacht van "nu" in de opgegeven tijdzone. */
export function minutesNowInZone(timeZone: string): number {
  return toMinutes(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
}
