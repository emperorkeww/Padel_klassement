import {
  huidigeStap,
  speeldagStappen,
  voortgangZin,
  type VoortgangInput,
} from "@/features/groups/speeldagVoortgang";
import "./DoorloopBalk.css";

/**
 * De doorloop van één speeldag in beeld (#1271).
 *
 * De pagina droeg drie flows onder elkaar zonder dat ergens stond wat de
 * volgorde was of waar je nu zat: `PollCard` klapt zichzelf dicht na het
 * boeken, `MakeTeams` staat open tot er één ronde is en verdwijnt dan, en
 * `RondeBlok` klapt per status. Drie antwoorden op "wat is nu belangrijk".
 *
 * Dit is er één: stemmen → moment → baan → indeling → uitslagen, met de stap
 * waar je staat gemarkeerd en één zin over wat er te doen valt.
 */
export function DoorloopBalk(props: VoortgangInput) {
  const stappen = speeldagStappen(props);
  const nu = huidigeStap(stappen);

  return (
    <section className="doorloop" aria-label="Voortgang van deze speeldag">
      <ol className="doorloop__stappen">
        {stappen.map((s) => (
          <li
            key={s.id}
            className={`doorloop__stap${s.klaar ? " is-klaar" : ""}${
              s.id === nu?.id ? " is-nu" : ""
            }`}
            // De stand staat in de vorm én in woorden: een screenreader hoort
            // "Baan, nu aan de beurt" in plaats van alleen een bolletje.
            aria-current={s.id === nu?.id ? "step" : undefined}
          >
            <span className="doorloop__bol" aria-hidden="true">
              {s.klaar ? "✓" : ""}
            </span>
            <span className="doorloop__label">{s.label}</span>
            {s.klaar && <span className="sr-only"> (klaar)</span>}
          </li>
        ))}
      </ol>
      <p className="doorloop__zin">{voortgangZin(props)}</p>
    </section>
  );
}

export default DoorloopBalk;
