// utils.js — voorbeeld van testbare, pure logica.
// Vervang dit door je eigen functies.

export function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

export function greeting(name) {
  return `Hallo, ${name}!`;
}
