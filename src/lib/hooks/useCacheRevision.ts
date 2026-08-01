import { useEffect, useState } from "react";
import { subscribeInvalidate } from "@/lib/supabase/queryCache";

/**
 * Teller die omhoog gaat zodra de querycache voor een prefix geleegd wordt
 * (#907). Zet hem in de deps van een `useAsync` en de component haalt opnieuw
 * op zodra iemand — deze kaart of een andere — de gedeelde gegevens wijzigt:
 *
 *     const rev = useCacheRevision("match-stakes");
 *     const stakes = useAsync(() => getMatchStakes(id), [id, rev]);
 *
 * Nodig omdat `invalidate()` alleen de cache leegt: componenten die al staan
 * te renderen houden hun eigen kopie in state en zouden pas na een refresh
 * kloppen. Dat is precies wat het lef-dagtegoed over meerdere matchkaarten
 * scheeftrok.
 *
 * Een invalidatie telt mee als de prefixen elkaar raken in welke richting dan
 * ook: `invalidate("match-stakes")` raakt een kijker op
 * "match-stakes:day:…", en het legen van één dagsleutel raakt een kijker op de
 * bredere prefix. Liever één refetch te veel dan een scherm dat blijft liegen.
 */
export function useCacheRevision(prefix: string): number {
  const [rev, setRev] = useState(0);

  useEffect(
    () =>
      subscribeInvalidate((prefixes) => {
        const raakt = prefixes.some(
          (p) => prefix.startsWith(p) || p.startsWith(prefix),
        );
        if (raakt) setRev((n) => n + 1);
      }),
    [prefix],
  );

  return rev;
}
