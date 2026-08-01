// Kleine presentatie-helpers die de hub (Groups) en de groepspagina
// (GroupDetail) delen. Sinds #917 draagt de groepskop dezelfde ledenrij als de
// kaart op de hub; zonder deze module stonden dat aantal en die drempel op twee
// plekken, en dan lopen ze uit elkaar.

/** Hoeveel lid-avatars er naast elkaar passen voordat het "+n" wordt. */
export const MAX_MEMBER_AVATARS = 4;

export function ledenLabel(n: number): string {
  return n === 1 ? "1 lid" : `${n} leden`;
}
