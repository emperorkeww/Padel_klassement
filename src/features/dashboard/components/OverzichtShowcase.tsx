// Dev-showcase (#940): de kaartenrij ónder de hero — volgende match, het
// cijfer-blok in zijn zone (#1242), en de baanteaser — met synthetische props.
//
// Zelfde reden als /dev/hero: deze kaarten hangen aan ingelogde seed-data
// (matches van vandaag, een badge met voortgang, een rivaal met genoeg duels),
// en die combinatie staat er zelden allemaal tegelijk. Zonder vaste stage is
// een visuele review op 390px niet reproduceerbaar — en juist daar bleken de
// namen te truncaten en de kaartranden te stapelen.
//
// De omhullende `.dashboard` is bewust echt: de tussenruimtes tussen de blokken
// zijn onderdeel van wat hier beoordeeld wordt. Alleen geregistreerd in
// development (App.tsx, import.meta.env.DEV) — geen productiechunk.

import type { DayAvailability } from "@/features/availability/api";
import type { Badge } from "@/features/profiles/badges";
import type { Match, Profile, RatingPoint, Team } from "@/types";
import type { Rival } from "../dashboardHelpers";
import { CourtTeaser } from "./CourtTeaser";
import { DashExtras } from "./DashExtras";
import { NextMatchCard } from "./NextMatchCard";
import { RatingCard } from "./RatingCard";
import { StatsRow } from "./StatsRow";
// De stylesheet van het overzicht hangt normaal aan Dashboard.tsx; deze stage
// rendert de kaarten zonder die pagina en heeft hem dus zelf nodig.
import "../Dashboard.css";
import "./HeroShowcase.css";

const MIJ = "p1";

/** Vier spelers met namen van realistische lengte: de kaart moet ook een
 *  dubbele voornaam aankunnen zonder de rest weg te knippen. */
const PROFIELEN: Record<string, Profile> = Object.fromEntries(
  [
    ["p1", "Remco Marien"],
    ["p2", "Alice Vandenberghe"],
    ["p3", "Fran Vermeersch"],
    ["p4", "Carla Vanderplancke"],
    ["p5", "Erik Vandewalle"],
  ].map(([id, naam]) => [
    id,
    {
      id,
      full_name: naam,
      username: id,
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
    } as Profile,
  ]),
);

const TEAMS: Record<string, Team> = {
  ta: {
    id: "ta",
    name: null,
    player1_id: "p2",
    player2_id: "p3",
    created_at: "2026-01-01T00:00:00Z",
  },
  tb: {
    id: "tb",
    name: null,
    player1_id: "p4",
    player2_id: "p5",
    created_at: "2026-01-01T00:00:00Z",
  },
};

const MATCH: Match = {
  id: "m1",
  team_a_id: "ta",
  team_b_id: "tb",
  status: "scheduled",
  winner_team_id: null,
  played_at: null,
  created_by: MIJ,
  created_at: "2026-08-01T08:00:00Z",
  group_id: "g1",
  round_number: 1,
  score_a: null,
  score_b: null,
  format: "2v2",
};

/** Genoeg punten voor een echte grafiek; de waarden zelf doen er niet toe. */
const HISTORIE: RatingPoint[] = [
  1180, 1172, 1190, 1186, 1201, 1194, 1207, 1201,
].map((r, i) => ({
  match_id: `h${i}`,
  rating_before: i === 0 ? r : 0,
  rating_after: r,
  delta: 0,
  played_at: `2026-07-${String(10 + i).padStart(2, "0")}T19:00:00Z`,
}));

/** De badge uit de issue: een lange omschrijving náást een brede teller. Precies
 *  die combinatie kapte de tekst af, terwijl een rij met een smal vinkje hem
 *  wél voluit toonde. */
const VOLGENDE_BADGE: Badge = {
  id: "klimmer",
  naam: "Klimmer",
  emoji: "📈",
  omschrijving: "Bereik een rating van 1300 in het clubklassement.",
  behaald: false,
  voortgang: { nu: 1201, doel: 1300 },
};

const BADGES: Badge[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `b${i}`,
    naam: `Badge ${i}`,
    emoji: "🏅",
    omschrijving: "Behaald.",
    behaald: true,
  })),
  VOLGENDE_BADGE,
];

const RIVAAL: Rival = {
  oppId: "p4",
  rec: { played: 11, won: 5, drawn: 1, lost: 5 },
};

const BANEN: DayAvailability = {
  open: "08:00",
  close: "23:00",
  timeZone: "Europe/Brussels",
  courts: [
    {
      court: { id: "c1", name: "Panoramabaan 3", type: "panorama" },
      free: new Map([["19:30", [{ duration: 90, price: "36 €", perPerson: "9 €" }]]]),
    },
    {
      court: { id: "c2", name: "Baan 5", type: "binnen" },
      free: new Map([["19:30", [{ duration: 90, price: "32 €", perPerson: "8 €" }]]]),
    },
  ],
  source: "snapshot",
  fetchedAt: "2026-08-01T12:00:00Z",
};

export function OverzichtShowcase() {
  return (
    <div className="hero-showcase">
      <h1 className="hero-showcase__kop">Overzicht-kaarten — #940</h1>
      <p className="hero-showcase__intro">
        De blokken onder de hero, met de data die op 390px het meeste pijn deed:
        vier spelers met een volledige naam, een missie en een badge met een lange
        omschrijving náást een brede teller, en het cijfer-blok met alles erin.
        Bekijk deze pagina op 390px breed — daar hoort niets af te kappen en horen
        de tussenruimtes gelijk te zijn.
      </p>

      <div className="dashboard">
        <section className="dash-zone" aria-labelledby="showcase-vandaag">
          <h2 className="dash-zone__titel" id="showcase-vandaag">
            Vandaag
          </h2>
          <div className="dash-zone__body">
            <NextMatchCard
              match={MATCH}
              groupName="Vrijdagavond Padel"
              teams={TEAMS}
              profiles={PROFIELEN}
              myId="p1"
            />
            <CourtTeaser
              availability={{
                data: BANEN,
                loading: false,
                error: null,
                reload: () => {},
              }}
              timezone="Europe/Brussels"
            />
          </div>
        </section>

        <section className="dash-zone" aria-labelledby="showcase-cijfers">
          <h2 className="dash-zone__titel" id="showcase-cijfers">
            Jouw cijfers
          </h2>
          <div className="dash-zone__body">
            <StatsRow loading={false} rank={6} winrate={0.58} played={64} />
            <RatingCard
              loading={false}
              rating={1201}
              dayDelta={12}
              history={HISTORIE}
            />
            <DashExtras
              myId={MIJ}
              matches={[]}
              teams={TEAMS}
              profiles={PROFIELEN}
              badges={BADGES}
              nextBadge={VOLGENDE_BADGE}
              rival={RIVAAL}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default OverzichtShowcase;
