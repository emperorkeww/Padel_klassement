/**
 * Stille uren (#1273).
 *
 * De momenten waarop de app pusht komen uit door gebruikers gezette tijden:
 * poll-deadline draait elk uur en rekent terug vanaf de speeldag, dus een
 * speeldag om 08:00 levert een "vandaag spelen jullie"-push om 03:05.
 * match-reminders tikt elk kwartier met drie uur voorsprong; een ochtendmatch
 * om 09:00 buzzt om 06:00. Er was geen bodem onder dat uur en geen manier voor
 * een speler om er een te zetten.
 *
 * Alleen de bezorging zwijgt. De inboxrij wordt hoe dan ook geschreven — dat is
 * de scheiding die #1090 heeft neergezet en die hier ongemoeid blijft: de
 * schakelaars bepalen of je toestel piept, niet of de gebeurtenis bestaat.
 *
 * Puur en zonder Deno-globals, zodat vitest hem gewoon kan draaien.
 */

/** De vaste klok van de club, net als poll-deadline aanhoudt. */
export const CLUB_TIJDZONE = "Europe/Brussels";

/** "23:00" of "23:00:00" → minuten sinds middernacht; null als het geen tijd is. */
export function minutenVanTijd(tijd: string | null | undefined): number | null {
  if (!tijd) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(tijd.trim());
  if (!m) return null;
  const uren = Number(m[1]);
  const minuten = Number(m[2]);
  if (uren > 23 || minuten > 59) return null;
  return uren * 60 + minuten;
}

/** Hoe laat het is in de gegeven zone, in minuten sinds middernacht. */
export function minutenInZone(nu: Date, tijdZone = CLUB_TIJDZONE): number {
  const delen = new Intl.DateTimeFormat("nl-NL", {
    timeZone: tijdZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(nu);
  const uur = Number(delen.find((d) => d.type === "hour")?.value ?? "0");
  const minuut = Number(delen.find((d) => d.type === "minute")?.value ?? "0");
  // 24:00 bestaat in sommige omgevingen als middernacht.
  return (uur % 24) * 60 + minuut;
}

/**
 * Valt dit moment binnen de stille uren van deze speler?
 *
 * Fail-open, net als zonderUitgezet: staat er geen venster of is het onleesbaar,
 * dan pushen we gewoon. Een lege of kapotte instelling mag nooit betekenen dat
 * iemand zijn meldingen stil kwijtraakt.
 *
 * Het venster loopt bijna altijd over middernacht heen (23:00–07:30), dus dat
 * is geen randgeval maar het normale geval. `van` telt mee, `tot` niet: om
 * precies 07:30 mag het weer piepen.
 */
export function inStilteVenster(
  nu: Date,
  van: string | null | undefined,
  tot: string | null | undefined,
  tijdZone = CLUB_TIJDZONE,
): boolean {
  const start = minutenVanTijd(van);
  const eind = minutenVanTijd(tot);
  if (start === null || eind === null || start === eind) return false;
  const moment = minutenInZone(nu, tijdZone);
  return start < eind
    ? moment >= start && moment < eind
    : moment >= start || moment < eind;
}
