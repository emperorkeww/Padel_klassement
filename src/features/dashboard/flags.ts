/* Eenvoudige, mislukt-veilige booleaanse vlaggen in localStorage. In privémodus
   of testomgevingen zonder werkende opslag vallen ze stil terug op "uit". */
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Zet de vlag aan, of wist hem met `aan = false`. Wissen is nodig sinds #911:
 *  de inklap-keuze van het cijfer-blok kan beide kanten op. */
export function writeFlag(key: string, aan = true) {
  try {
    if (aan) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* privémodus — dan geldt de keuze alleen voor deze sessie */
  }
}
