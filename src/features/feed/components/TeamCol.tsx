import { Avatar } from "@/ui/Avatar";
import { playersOf } from "@/features/rating/results";
import type { Profile, Team } from "@/types";

/** Één teamkant in de match-kaart: avatars boven de teamnaam (#232). */
export function TeamCol({
  team,
  pmap,
  won,
  label,
}: {
  team: Team | undefined;
  pmap: Record<string, Profile>;
  won: boolean;
  label: string;
}) {
  const ids = playersOf(team);
  return (
    <div className={`fmatch__team ${won ? "is-win" : ""}`}>
      <span className="fmatch__avs">
        {ids.map((id) => (
          <Avatar key={id} profile={pmap[id]} size={24} short />
        ))}
      </span>
      <span className="fmatch__nm">{label}</span>
    </div>
  );
}
