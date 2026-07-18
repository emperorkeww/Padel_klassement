import type { Outcome } from "@/features/rating/results";

const LABEL: Record<Outcome, string> = { W: "winst", D: "gelijk", L: "verlies" };

/** Rij kleine W/D/L-bolletjes: recente vorm, nieuwste rechts.
 *  `form` komt newest-first binnen (zie `recentForm`); we tonen 'm als
 *  tijdlijn oud → nieuw, dus omgekeerd van links naar rechts. */
export function FormChips({ form, size = "md" }: { form: Outcome[]; size?: "sm" | "md" }) {
  if (form.length === 0) return null;
  const chronological = [...form].reverse();
  return (
    <span
      className={`formchips ${size === "sm" ? "formchips--sm" : ""}`}
      role="img"
      aria-label={`Vorm: ${chronological.map((o) => LABEL[o]).join(", ")}`}
    >
      {chronological.map((o, i) => (
        <span key={i} className={`formchip formchip--${o.toLowerCase()}`}>
          {o}
        </span>
      ))}
    </span>
  );
}

export default FormChips;