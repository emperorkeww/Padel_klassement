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
import { laadAvatar } from "@/lib/utils/futKaartCanvas";
import {
  laadKaartMaster,
  masterVoor,
} from "@/features/rating/components/kaartMasters";
import { divisieLayout } from "@/features/rating/components/layouts/divisieLayouts";
import { laadDivisieOnderdelen } from "@/features/rating/components/layouts/divisieKaartCanvas";
import { getPlayerRatings } from "@/features/standings/ratingsApi";
import { getPlayerStandings } from "@/features/standings/api";
import { statBronVoorStand } from "@/features/standings/leaderboardHelpers";
import { laadEditieContext } from "@/features/standings/editieContext";
import { vsKaartVoor } from "@/features/profiles/compare";
import { displayName } from "@/features/profiles/api";
import { teamLabel } from "@/features/matches/api";
import { dateInZone } from "@/lib/utils/time";
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
  timezone,
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
  /** Clubtijdzone: bepaalt welke kalenderdag "vandaag" is voor de poster. */
  timezone: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const today = dateInZone(timezone);
  const summary = useMemo(
    () => eveningSummary(matches, teams, today, timezone, histories),
    [matches, teams, today, timezone, histories],
  );

  if (summary.matches.length === 0) return null;

  async function share() {
    setBusy(true);
    try {
      const naam = (playerId: string) => displayName(profiles[playerId]);
      // Ratings en editie-context pas hier ophalen, net als de speeldagposter:
      // de Vandaag-tab hoeft ze niet bij elke render te kennen en alles zit
      // achter cached(). Faalt het, dan valt de poster terug op de versie
      // zonder kaart — een samenvatting delen is belangrijker dan de trofee.
      const [ratings, edities, standen] = await Promise.all([
        getPlayerRatings(),
        laadEditieContext(),
        getPlayerStandings().catch(() => []),
      ]).catch(() => [null, null, []] as const);
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
        kaart: (playerId) => {
          const profile = profiles[playerId];
          if (!profile || !ratings || !edities) return null;
          const kaart = vsKaartVoor({
            id: playerId,
            profile,
            naam: naam(playerId),
            ratings,
            edities,
          });
          return {
            name: kaart.naam,
            avatarUrl: kaart.avatarUrl,
            rating: kaart.rating,
            tier: kaart.tier,
            editie: kaart.editie,
            editieTekst: kaart.editieTekst,
            // Bewust de all-time stand en niet de avondcijfers: de kaart is de
            // klassementskaart van deze speler, niet een avondrapport (#895).
            stats: statBronVoorStand(
              standen.find((s) => s.player_id === playerId),
            ),
          };
        },
      });
      // Profielfoto en rastermaster van de winnaar vooraf laden — het canvas
      // tekent synchroon.
      const layout = divisieLayout(
        poster.winnaar?.tier?.key,
        poster.winnaar?.editie,
      );
      const [avatarImg, master, onderdelen] = await Promise.all([
        laadAvatar(poster.winnaar?.avatarUrl ?? null),
        laadKaartMaster(
          masterVoor(poster.winnaar?.tier?.key, poster.winnaar?.editie),
        ),
        layout ? laadDivisieOnderdelen(layout) : Promise.resolve(null),
      ]);
      const outcome = await sharePng(
        (ctx) => drawEveningPoster(ctx, poster, avatarImg, master, onderdelen),
        {
          width: W,
          height: H,
          filename: "vamos-avond.png",
          title: "Vamos! avond",
        },
      );
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