/* Eenvoudige, mislukt-veilige booleaanse vlaggen in localStorage. In privémodus
   of testomgevingen zonder werkende opslag vallen ze stil terug op "uit". */
export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* privémodus — dan geldt de keuze alleen voor deze sessie */
  }
}
