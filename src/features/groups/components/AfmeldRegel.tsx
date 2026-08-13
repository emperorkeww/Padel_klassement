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
  standaardMee,
  className,
}: {
  optionId: string;
  groupId: string;
  myId: string;
  /** Sta je standaard in de indeling? (Je stemde "ik kan".) Zonder dat gegeven
   *  bood deze regel "Ik kan toch niet" aan iemand die er niet bij stond
   *  (#1308) — en wie er wél bij wil komen had helemaal geen knop. */
  standaardMee: boolean;
  className?: string;
}) {
  const { mee, bezig, zet } = useAanwezigheid(
    optionId,
    groupId,
    myId,
    standaardMee,
  );
  return (
    <p className={`winner-card__afmelden${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="btn btn--sm"
        disabled={bezig}
        onClick={zet}
      >
        {/* Drie gevallen, en het verschil zit in waar je vandaan komt: wie in
            de indeling stond en zich afmeldde gaat "toch weer mee"; wie er
            nooit bij stond kan "toch meedoen" (#1271, #1308). */}
        {mee ? "Ik kan toch niet" : standaardMee ? "Toch weer mee" : "Toch meedoen"}
      </button>
      <span className="winner-card__afmeld-uitleg">
        {mee ? "Je staat in de indeling." : "Je staat niet in de indeling."}
      </span>
    </p>
  );
}

export default AfmeldRegel;
