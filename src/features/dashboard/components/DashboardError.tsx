import { Avatar } from "@/ui/Avatar";
import { ErrorRetry } from "@/ui/ErrorRetry";
import type { Profile } from "@/types";

// Mislukte kernquery → echte foutstaat i.p.v. lege stats en onboarding-teksten
// die doen alsof de data weg is (issue #67). De baanbeschikbaarheid heeft zijn
// eigen melding in CourtTeaser en blijft hier bewust buiten.

export function DashboardError({
  profile,
  naam,
  error,
  onRetry,
}: {
  profile: Profile | undefined;
  naam: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero__main">
          <Avatar profile={profile} name={naam || undefined} size={56} />
          <div className="hero__text">
            <p className="hero__eyebrow">Welkom terug</p>
            <h1 className="hero__name">{naam ? `Hoi, ${naam}` : "Hoi!"}</h1>
          </div>
        </div>
      </section>
      <section className="card">
        <ErrorRetry
          melding={`Het dashboard kon niet laden: ${error}`}
          onRetry={onRetry}
        />
      </section>
    </div>
  );
}

export default DashboardError;
