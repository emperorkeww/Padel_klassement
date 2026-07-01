// Voorbeeld van pure, testbare logica. Vervang door je eigen helpers.

export function sum(numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}

export function greeting(name: string): string {
  return `Hallo, ${name}!`;
}