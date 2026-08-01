/**
 * Foutmelding bij één veld (#922).
 *
 * De authformulieren draaien op `noValidate` en toonden elke fout — verkeerd
 * wachtwoord, ongeldig e-mailadres, niet-overeenkomende bevestiging — als één
 * regel onderaan boven de knop. Deze hangt hem onder het veld waar het misging.
 *
 * De `id` koppelt de aanroeper via `aria-describedby` aan het invoerveld; met
 * `role="alert"` hoort een screenreader hem ook als de fout pas bij het
 * versturen verschijnt.
 */
export function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span className="field__error" id={id} role="alert">
      {text}
    </span>
  );
}

export default FieldError;
