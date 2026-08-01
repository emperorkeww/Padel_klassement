import { PASSWORD_MIN_LENGTH } from "./authErrors";

/**
 * Grove sterkte-inschatting voor het wachtwoordveld (#922).
 *
 * Je zag pas ná het versturen of je wachtwoord voldeed. Dit oordeelt terwijl je
 * typt — bewust grof: lengte weegt het zwaarst (dat is wat écht helpt), variatie
 * in tekensoorten geeft een zetje. Geen zxcvbn-achtige woordenboekanalyse: dat
 * is een pakket van honderden kB's voor één veld, en het oordeel zou alsnog een
 * schatting zijn.
 *
 * Niveau 0 betekent "voldoet niet aan de harde eis" en is dus meer dan een
 * kleurtje: `passwordError` (dezelfde bron, `authErrors.ts`) houdt de submit
 * dan tegen.
 */

export type Sterkte = {
  /** 0 = te kort, 1 = zwak, 2 = redelijk, 3 = sterk. */
  niveau: 0 | 1 | 2 | 3;
  label: string;
};

/** Hoeveel verschillende tekensoorten komen erin voor? (0 t/m 4) */
function soorten(pw: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw))
    .length;
}

const LABELS: Record<1 | 2 | 3, string> = {
  1: "Zwak",
  2: "Redelijk",
  3: "Sterk",
};

export function wachtwoordSterkte(password: string): Sterkte {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { niveau: 0, label: "Te kort" };
  }
  // Lengte doet het meeste werk; variatie kan er hooguit één niveau bovenop
  // doen. Een lang wachtwoord van enkel kleine letters is nog altijd beter dan
  // een kort met een uitroepteken erin.
  const lang = password.length >= 12 ? 2 : password.length >= 9 ? 1 : 0;
  const variatie = soorten(password) >= 3 ? 1 : 0;
  const score = Math.min(3, 1 + lang + variatie) as 1 | 2 | 3;
  return { niveau: score, label: LABELS[score] };
}
