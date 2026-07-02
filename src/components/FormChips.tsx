import type { Outcome } from "../lib/results";

const LABEL: Record<Outcome, string> = { W: "winst", D: "gelijk", L: "verlies" };

/** Rij kleine W/D/L-bolletjes: recente vorm, nieuwste links. */
export function FormChips({ form, size = "md" }: { form: Outcome[]; size?: "sm" | "md" }) {
  if (form.length === 0) return null;
  return (
    <span
      className={`formchips ${size === "sm" ? "formchips--sm" : ""}`}
      role="img"
      aria-label={`Vorm: ${form.map((o) => LABEL[o]).join(", ")}`}
    >
      {form.map((o, i) => (
        <span key={i} className={`formchip formchip--${o.toLowerCase()}`}>
          {o}
        </span>
      ))}
    </span>
  );
}

export default FormChips;