/**
 * Initialen uit een weergavenaam (#949).
 *
 * Een eigen module omdat er twee afleidingen naast elkaar leefden: het
 * Avatar-component gaf "AA" (voor- + achternaam) terwijl de profielinstellingen
 * met de hand `naam.slice(0, 1)` deden en dus "A" toonden voor dezelfde
 * persoon. Eén regel, één plek — en los van het component, zodat een pagina die
 * zijn eigen avatarvorm tekent hem ook kan gebruiken.
 *
 * `kort` geeft één letter en is bedoeld voor overlappende avatarparen, waar
 * twee letters op 22–26px tegen elkaar aan lopen.
 */
export function initialen(naam: string, kort = false): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (kort || delen.length === 1)
    return delen[0].slice(0, kort ? 1 : 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}

export default initialen;
