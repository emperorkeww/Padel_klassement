import { MatchList } from "@/features/matches/components/MatchList";
import { MatchListSkeleton } from "@/ui/Skeleton";
import { ErrorRetry } from "@/ui/ErrorRetry";
import type { ProfileData } from "@/features/profiles/components/types";

// Matches-tab: de volledige (seizoensgescoopte) matchlijst, niet afgekapt.
export function ProfileMatches({ d }: { d: ProfileData }) {
  const {
    scoped,
    tmap,
    pmap,
    id,
    upsets,
    season,
    matchesLoading,
    matchesError,
    matchesReload,
    matchExtras,
  } = d;
  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Matches</h2>
        {season && <span className="badge">{season.label}</span>}
      </div>
      {matchesLoading && <MatchListSkeleton count={6} />}
      {matchesError && (
        <ErrorRetry
          melding={`De matches laden mislukte: ${matchesError}`}
          onRetry={matchesReload}
        />
      )}
      {!matchesLoading && (
        <MatchList
          matches={scoped}
          teams={tmap}
          profiles={pmap}
          perspectiveId={id}
          upsets={upsets}
          extras={matchExtras}
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
