import { useAanwezigheid } from "@/features/groups/useAanwezigheid";
import "@/features/groups/Proposals.css";

/**
 * "Ik kan toch niet" bij een vastgelegde speeldag (#1271, gedeeld sinds #1308).
 *
 * Eén regel met één knop, op elke plek waar een geboekte speeldag staat: de
 * speeldagkaart én het dag-sheet van de agenda. Dat sheet zei tot nu toe wél
 * hoeveel spelers er nog nodig waren en bood geen enkele manier om er een te
 * worden — je moest eerst doorklikken naar de speeldag.
 */
export function AfmeldRegel({
  optionId,
  groupId,
  myId,
  className,
}: {
  optionId: string;
  groupId: string;
  myId: string;
  className?: string;
}) {
  const { ikKomNiet, bezig, zet } = useAanwezigheid(optionId, groupId, myId);
  return (
    <p className={`winner-card__afmelden${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="btn btn--sm"
        disabled={bezig}
        onClick={zet}
      >
        {ikKomNiet ? "Toch weer mee" : "Ik kan toch niet"}
      </button>
      {ikKomNiet && (
        <span className="winner-card__afmeld-uitleg">
          Je staat niet in de indeling.
        </span>
      )}
    </p>
  );
}

export default AfmeldRegel;
