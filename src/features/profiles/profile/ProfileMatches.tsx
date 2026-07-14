import { MatchList } from "../../matches/MatchList";
import { MatchListSkeleton } from "@/ui/Skeleton";
import type { ProfileData } from "./types";

// Matches-tab: de volledige (seizoensgescoopte) matchlijst, niet afgekapt.
export function ProfileMatches({ d }: { d: ProfileData }) {
  const { scoped, tmap, pmap, id, upsets, season, matchesLoading, matchesError } = d;
  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Matches</h2>
        {season && <span className="badge">{season.label}</span>}
      </div>
      {matchesLoading && <MatchListSkeleton count={6} />}
      {matchesError && <p className="msg msg--error">{matchesError}</p>}
      {!matchesLoading && (
        <MatchList
          matches={scoped}
          teams={tmap}
          profiles={pmap}
          perspectiveId={id}
          upsets={upsets}
          empty={
            season
              ? "Geen matches in dit seizoen."
              : "Deze speler heeft nog geen matches gespeeld."
          }
        />
      )}
    </section>
  );
}

export default ProfileMatches;
