import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import type { ActiveBounty, BountyReden } from "@/features/rating/bounty";

// Bounty's (#805): wie draagt er nú een prijs op z'n hoofd. Read-only uit de
// view public.active_bounties — de waarde wordt serverside berekend, zodat het
// getal op het klassement hetzelfde is als wat _bounty_deltas straks uitkeert.
// RLS zorgt ervoor dat je alleen de kronen van je eigen groepen ziet; de troon
// (1600+) is clubbreed zichtbaar.

/** Alle actieve bounty's; één rij per drager-per-reden. */
export function getActiveBounties(): Promise<ActiveBounty[]> {
  return cached("bounties:actief", async () => {
    const { data, error } = await supabase
      .from("active_bounties")
      .select("player_id, group_id, reden, streak, pool");
    if (error) throw error;
    // De view-kolommen zijn in de gegenereerde types nullable (Postgres kan de
    // not-null-belofte van een view niet garanderen); rijen zonder speler of
    // waarde zeggen niets en gaan eruit.
    return (data ?? []).flatMap((r) =>
      r.player_id == null || r.pool == null
        ? []
        : [
            {
              playerId: r.player_id,
              groupId: r.group_id,
              reden: (r.reden ?? "bigdaddy") as BountyReden,
              streak: r.streak ?? 0,
              pool: r.pool,
            },
          ],
    );
  });
}