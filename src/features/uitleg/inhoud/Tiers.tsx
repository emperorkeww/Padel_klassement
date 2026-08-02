import { TierLegend } from "@/features/rating/components/TierLegend";

/** Sectie 6: de divisieladder (#989). De tabel zelf is `TierLegend` (#127) —
 *  die leest `tierLegend()` uit tiers.ts, de enige plek met de drempels. */
export function Tiers() {
  return (
    <>
      <p>
        Je <strong>divisie</strong> volgt je rating: win je, dan klim je, verlies
        je, dan zak je. Elke divisie onder de top heeft drie treden (III → II →
        I); alleen bovenaan regeer je ongedeeld. Hieronder staat de volledige
        ladder met de rating die je ervoor nodig hebt.
      </p>
      <TierLegend />
      <p className="uitleg__noot">
        Ga je over een divisiegrens heen, dan krijg je dat te horen — een
        promotie komt als pack dat je zelf openscheurt.
      </p>
    </>
  );
}

export default Tiers;
