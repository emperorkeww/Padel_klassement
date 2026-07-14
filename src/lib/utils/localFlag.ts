// Kleine, veilige localStorage-vlaggen voor "één keer tonen"-UI (kennismaking,
// dismissible banners). Faalt stil bij private mode / geen storage.

export function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value = "1"): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage niet beschikbaar — negeer
  }
}
