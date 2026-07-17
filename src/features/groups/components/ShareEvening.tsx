import { useMemo, useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { sharePng } from "@/lib/utils/shareImage";
import {
  avondDatumLabel,
  drawEveningPoster,
  eveningCoachQuote,
  eveningPoster,
} from "@/features/groups/eveningPoster";
import { eveningSummary } from "@/features/feed/eveningSummary";
import { displayName } from "@/features/profiles/api";
import { teamLabel } from "@/features/matches/api";
import type { Match, Profile, RatingPoint, RoastIntensiteit, Team } from "@/types";

// Deelbare poster (4:5) met de samenvatting van vanavond: Coach Rudy's verslag
// als blikvanger, de avondstand-top-3, de uitslagen en het beste duo. Verschijnt
// zodra er vandaag minstens één afgeronde match in de groep is. Inhoud en
// opbouw zitten in eveningPoster.ts; hier alleen de deel-flow.

const W = 1080;
const H = 1350;

export function ShareEvening({
  groupId,
  groupName,
  matches,
  teams,
  profiles,
  histories,
  intensiteit,
}: {
  /** Seed-basis: `groupId|dag` — gelijk aan de feed, zodat de poster hetzelfde
   *  verslag toont als de app (#421). */
  groupId: string;
  groupName: string;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  /** Rating-historie om de grootste upset van de avond te bepalen (#85). */
  histories?: Record<string, RatingPoint[]>;
  /** Roast-toon voor Coach Rudy's avondverslag. */
  intensiteit: RoastIntensiteit;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(
    () => eveningSummary(matches, teams, today, histories),
    [matches, teams, today, histories],
  );

  if (summary.matches.length === 0) return null;

  async function share() {
    setBusy(true);
    try {
      const naam = (playerId: string) => displayName(profiles[playerId]);
      const poster = eveningPoster(summary, {
        groepsnaam: groupName,
        datum: avondDatumLabel(today),
        naam,
        duo: (teamId) => teamLabel(teams[teamId], profiles),
        coachQuote: eveningCoachQuote(summary, `${groupId}|${today}`, {
          intensiteit,
          profiles,
          naam,
        }),
      });
      const outcome = await sharePng((ctx) => drawEveningPoster(ctx, poster), {
        width: W,
        height: H,
        filename: "vamos-avond.png",
        title: "Vamos! avond",
      });
      if (outcome === "clipboard")
        toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : "↗ Deel avond-samenvatting"}
    </button>
  );
}

export default ShareEvening;