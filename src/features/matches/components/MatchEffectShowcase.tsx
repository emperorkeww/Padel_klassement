// Dev-showcase (#1151): de acht effecttoestanden van de matchkaart naast elkaar.
//
// Lef, joker en drankje-inzet leggen elk hun eigen kleurlaag over de kaart, en
// het hele ontwerp staat of valt bij de combinaties: bij lef+joker hoort er
// herkenbaar paars én blauw te liggen, niet één lila gemiddelde. Dat is precies
// wat je met seed-data nooit te zien krijgt — drie effecten op één match komen
// in de praktijk zelden samen, en dan nog nooit alle acht varianten naast
// elkaar. Zonder dit raster is een visuele review dus niet reproduceerbaar.
//
// Alleen geregistreerd in development (App.tsx, import.meta.env.DEV), dus geen
// productiechunk. Zelfde opzet en zelfde voorwaarden als KaartShowcase (#664)
// en GlasShowcase (#1062).
//
// Waar je op let:
//   * ligt er bij elke combinatie écht een aparte kleur per effect?
//   * blijven de namen leesbaar? (de rekensom staat in npm run contrast)
//   * blijft de score het zwaartepunt?
//   * blijft de linkerrand van winst/verlies, niet van het effect?

import { useState } from "react";
import { MatchCard } from "@/features/matches/components/MatchList";
import type { Match, Profile, Team } from "@/types";

/** Twee ploegen met leesbare namen; de avatars komen uit de gewone Avatar. */
const PROFIELEN: Record<string, Profile> = {
  p1: { id: "p1", username: "Gilles Smet" } as Profile,
  p2: { id: "p2", username: "Gilles Van der Borght" } as Profile,
  p3: { id: "p3", username: "Lennart Boey" } as Profile,
  p4: { id: "p4", username: "Robbe" } as Profile,
};

const TEAMS: Record<string, Team> = {
  ta: { id: "ta", player1_id: "p1", player2_id: "p2" } as Team,
  tb: { id: "tb", player1_id: "p3", player2_id: "p4" } as Team,
};

const BASIS = {
  id: "showcase",
  team_a_id: "ta",
  team_b_id: "tb",
  status: "completed",
  winner_team_id: "ta",
  score_a: 6,
  score_b: 1,
  played_at: "2026-08-03T19:00:00.000Z",
  created_at: "2026-08-03T19:00:00.000Z",
  created_by: "p1",
  group_id: "g1",
  round_number: 1,
  format: "2v2",
  wager_drink: null,
  wager_drink_qty: 1,
  wager_settled_at: null,
} as unknown as Match;

const MET_DRANKJE = {
  ...BASIS,
  wager_drink: "duvel",
  wager_drink_qty: 2,
} as unknown as Match;

const LEF = "🎲 lef ×2 · Carol — verlies";
const JOKER = "🃏 Bob — 🛡️ Schild, winst";

/** De acht toestanden, in de volgorde waarin het issue ze opsomt. */
const TOESTANDEN: {
  naam: string;
  uitleg: string;
  match: Match;
  lef?: string;
  joker?: string;
}[] = [
  {
    naam: "Gewone match",
    uitleg: "geen effect — de neutrale kaart",
    match: BASIS,
  },
  { naam: "Lef", uitleg: "🟣 paars, linksonder", match: BASIS, lef: LEF },
  {
    naam: "Joker",
    uitleg: "🔵 blauw, rechtsboven",
    match: BASIS,
    joker: JOKER,
  },
  { naam: "Inzet", uitleg: "🟡 amber, rechtsonder", match: MET_DRANKJE },
  {
    naam: "Lef + joker",
    uitleg: "🟣 + 🔵 — beide herkenbaar, geen lila gemiddelde",
    match: BASIS,
    lef: LEF,
    joker: JOKER,
  },
  { naam: "Lef + inzet", uitleg: "🟣 + 🟡", match: MET_DRANKJE, lef: LEF },
  {
    naam: "Joker + inzet",
    uitleg: "🔵 + 🟡",
    match: MET_DRANKJE,
    joker: JOKER,
  },
  {
    naam: "Lef + joker + inzet",
    uitleg: "🟣 + 🔵 + 🟡 — de rijkste variant",
    match: MET_DRANKJE,
    lef: LEF,
    joker: JOKER,
  },
];

export function MatchEffectShowcase() {
  // Vanuit het perspectief van p1 (winst) of zonder perspectief (neutraal): zo
  // is te zien dat de groene winstrand en de effectkleur elkaar niet in de weg
  // zitten — dat zijn twee losse semantische lagen.
  const [perspectief, setPerspectief] = useState(true);

  // Geen eigen router eromheen: de route hangt al onder de BrowserRouter van de
  // app, en twee routers in elkaar is een harde fout. De <Link> in MatchCard
  // vindt zijn context dus vanzelf.
  return (
    <div
      className="page"
      style={{ padding: "var(--sp-4)", display: "grid", gap: "var(--sp-4)" }}
    >
      <header>
        <h1>Effect-swirls op de matchkaart (#1151)</h1>
        <p className="muted">
          Eén kleurlaag per actief effect. Bij een combinatie hoort elke kleur
          afzonderlijk herkenbaar te blijven. Wissel van thema met de gewone
          themawissel — de piek is bewust lager in donker.
        </p>
        <label className="row" style={{ gap: "var(--sp-2)" }}>
          <input
            type="checkbox"
            checked={perspectief}
            onChange={(e) => setPerspectief(e.target.checked)}
          />
          <span>Winstrand tonen (perspectief van de winnaar)</span>
        </label>
      </header>

      {TOESTANDEN.map((t) => (
        <section key={t.naam}>
          <h2 className="card__title">{t.naam}</h2>
          <p className="muted">{t.uitleg}</p>
          <ul className="matchlist">
            <li>
              <MatchCard
                match={t.match}
                teams={TEAMS}
                profiles={PROFIELEN}
                perspectiveId={perspectief ? "p1" : undefined}
                lef={t.lef}
                joker={t.joker}
              />
            </li>
          </ul>
        </section>
      ))}
    </div>
  );
}

export default MatchEffectShowcase;
