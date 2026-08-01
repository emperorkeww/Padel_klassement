import type { ReactNode } from "react";

/**
 * Foutmelding mét een weg vooruit (#910).
 *
 * Op veertien plekken stond een kale `<p className="msg msg--error">`: je las
 * dat het misging en dat was het. `useAsync` geeft al een `reload()` terug, dus
 * bij een mislukte fetch hoort gewoon een "Opnieuw proberen". Voor doodlopende
 * paden ("match niet gevonden") helpt herladen niet — daar hoort een link terug.
 *
 * De typing dwingt precies één van beide af: een foutstaat zonder herstelactie
 * is nu geen geldige aanroep meer.
 */

type Basis = {
  /** Wat er misging, in gewone taal. */
  melding: ReactNode;
  className?: string;
};

type MetRetry = Basis & { onRetry: () => void; actie?: never };
type MetActie = Basis & { actie: ReactNode; onRetry?: never };

export function ErrorRetry({
  melding,
  onRetry,
  actie,
  className,
}: MetRetry | MetActie) {
  return (
    <div className={`msg msg--error msg--actie ${className ?? ""}`} role="alert">
      <span className="msg__tekst">{melding}</span>
      {onRetry ? (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          Opnieuw proberen
        </button>
      ) : (
        actie
      )}
    </div>
  );
}

export default ErrorRetry;
