import type { OptionState } from "@/features/groups/pollLogic";
import { PollStateIcon } from "./pollIconen";
/* De klassen hieronder (poll-state--*, moment-meta) wonen in Proposals.css.
   Feature-CSS hangt aan de route, dus een component die elders belandt — dit
   staat sinds #1308 óók in het agenda-dag-sheet — brengt zijn eigen stijl mee. */
import "@/features/groups/Proposals.css";

/* ------------------------------------------------------------------ */
/* Eén moment in cijfers: wie doet mee, wat is er nog nodig (#1308).   */
/*                                                                     */
/* Deze regel stond alleen op de speeldagpagina (MomentKiezer, #1181): */
/* "2 mee · 1? · 1 baan vrij, 1 nodig · ± € 6 p.p.". De agenda zei over */
/* hetzelfde moment "1 kan" en "1 vrij" — en over een moment zonder     */
/* banendata helemaal niets. Drie woordenschatten voor twee getallen.   */
/*                                                                     */
/* Nu één component, zodat de bewoording niet uit elkaar kan lopen. De  */
/* spelersdrempel hoort erbij: "0 kunnen" vertelde niet dat er nog vier */
/* nodig zijn, terwijl dat het enige getal is waar het om draait.       */
/* ------------------------------------------------------------------ */

/** De haalbaarheidsring; de betekenis staat in de tekst ernaast. */
export function MomentMeter({
  state,
  className,
}: {
  state: OptionState;
  className?: string;
}) {
  return (
    <span
      className={`${className ? `${className} ` : ""}poll-state--${state}`}
      aria-hidden="true"
    >
      <PollStateIcon state={state} />
    </span>
  );
}

export function MomentMeta({
  ja,
  misschien,
  tekort,
  vrij,
  banenNodig,
  prijs,
  className,
}: {
  /** Spelers met "ik kan". */
  ja: number;
  /** Spelers met "misschien"; 0 laat het deel weg. */
  misschien: number;
  /** Spelers die er nog bij moeten voor één baan; 0 = drempel gehaald. */
  tekort: number;
  /** Vrije banen; `null` = we weten het niet (buiten het Playtomic-venster),
   *  `undefined` = de vraag speelt hier niet (de baan is al geboekt). */
  vrij?: number | null;
  /** Banen die bij dit aantal ja-stemmers nodig zijn. */
  banenNodig: number;
  /** ± prijs per persoon, of null. */
  prijs?: string | null;
  className?: string;
}) {
  const delen = [`${ja} mee`];
  if (misschien > 0) delen.push(`${misschien}?`);
  // De spelersdrempel alleen zolang hij niet gehaald is: "nog 4 spelers nodig"
  // is een oproep, "0 nodig" is ruis.
  if (tekort > 0)
    delen.push(`nog ${tekort} ${tekort === 1 ? "speler" : "spelers"} nodig`);
  if (vrij !== undefined)
    delen.push(
      vrij === null
        ? "beschikbaarheid onbekend"
        : `${vrij === 0 ? "geen baan" : `${vrij} ${vrij === 1 ? "baan" : "banen"}`} vrij, ${banenNodig} nodig`,
    );
  if (prijs) delen.push(`± ${prijs} p.p.`);
  return (
    <span className={className}>{delen.join(" · ")}</span>
  );
}

export default MomentMeta;
