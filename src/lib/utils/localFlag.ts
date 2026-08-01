// Kleine, veilige localStorage-vlaggen voor "één keer tonen"-UI (kennismaking,
// dismissible banners). Faalt stil bij private mode / geen storage.

export function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `null` wist de vlag. Nodig sinds #912: de coach-kennismaking moet ook terug
 *  te halen zijn, en die was met alleen zetten voorgoed weg. */
export function writeFlag(key: string, value: string | null = "1"): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage niet beschikbaar — negeer
  }
}
