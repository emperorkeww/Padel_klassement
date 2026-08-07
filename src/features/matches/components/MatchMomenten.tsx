import { useState } from "react";
import type { Highlight } from "@/features/feed/feedLogic";
import type { Upset } from "@/features/matches/upset";
import type { TierBand } from "@/features/rating/tiers";
// Uit de constante zelf, zodat de uitleg niet wegdrijft van de regel (#915).
import { MONSTERZEGE_DREMPEL } from "@/features/profiles/badges.constants";

/**
 * Bijzondere momenten van een afgeronde match — derby, upset, bagel/monsterzege/
 * nagelbijter — als chips onder het scorebord.
 *
 * De uitleg zat ooit in een `title` en was daarmee op touch onbereikbaar
 * (#915); je klapt hem nu uit met een tik. Eén tegelijk: twee open uitleggen
 * naast elkaar leest niet. Gelijkspel staat er los bij — dat legt zichzelf uit
 * en heeft dus geen knop nodig.
 *
 * Uitgesneden uit MatchDetail in #1144, gedrag ongewijzigd.
 */
export function MatchMomenten({
  derby,
  upset,
  scoreHi,
  isDraw,
}: {
  derby: TierBand | null;
  upset: Upset | null;
  scoreHi: Highlight | null;
  isDraw: boolean;
}) {
  const [openMoment, setOpenMoment] = useState<string | null>(null);

  const momenten: { sleutel: string; label: string; uitleg: string }[] = [];
  if (derby)
    momenten.push({
      sleutel: "derby",
      label: `🏟️ Derby · ${derby.emoji} ${derby.naam}`,
      uitleg: `Alle spelers zitten in dezelfde divisie (${derby.naam}) — hier staat divisie-eer op het spel.`,
    });
  if (upset)
    momenten.push({
      sleutel: "upset",
      label: `🎯 Upset · ${Math.round(upset.chance * 100)}% kans`,
      uitleg:
        "De underdog won: op basis van de ratings vooraf was de winkans lager dan 35%.",
    });
  if (scoreHi && scoreHi.type === "score")
    momenten.push({
      sleutel: "score",
      label:
        scoreHi.label === "bagel"
          ? "🥯 6-0 Droog"
          : scoreHi.label === "monsterzege"
            ? "🦖 Monsterzege"
            : "😬 Nagelbijter",
      uitleg:
        scoreHi.label === "bagel"
          ? "Een bagel: de verliezer pakte geen enkele game."
          : scoreHi.label === "monsterzege"
            ? `Een monsterzege: minstens ${MONSTERZEGE_DREMPEL} games verschil.`
            : "Een nagelbijter: het scheelde maar één game.",
    });

  if (momenten.length === 0) return null;

  const openMomentUitleg =
    momenten.find((mo) => mo.sleutel === openMoment)?.uitleg ?? null;

  return (
    <>
      <div className="md-moments">
        {isDraw && <span className="md-moment md-moment--draw">Gelijkspel</span>}
        {momenten.map((mo) => (
          <button
            key={mo.sleutel}
            type="button"
            className={`md-moment md-moment--knop ${
              openMoment === mo.sleutel ? "is-open" : ""
            }`}
            aria-expanded={openMoment === mo.sleutel}
            aria-controls="md-moment-uitleg"
            onClick={() =>
              setOpenMoment((h) => (h === mo.sleutel ? null : mo.sleutel))
            }
          >
            {mo.label}
          </button>
        ))}
      </div>
      {openMomentUitleg && (
        <p className="md-moment-uitleg" id="md-moment-uitleg" role="status">
          {openMomentUitleg}
        </p>
      )}
    </>
  );
}

export default MatchMomenten;
