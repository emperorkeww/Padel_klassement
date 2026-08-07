import {
  eigenSwing,
  jokerIcoon,
  jokerLabel,
  type JokerId,
} from "@/features/matches/jokers";
import "./RatingPreview.css";

/**
 * Wat deze uitslag met jóuw rating doet — te zien vóór je opslaat (#1144).
 *
 * Bewust jouw mutatie en niet "team A +24 / team B −24": de multiplier is per
 * speler. Een schild van jou zet jouw mutatie op nul en laat je partner
 * ongemoeid, en een lef-tip van je tegenstander verdubbelt alleen de zijne. Een
 * teambreed cijfer zou dus voor de helft van de kaarten een leugen zijn.
 *
 * Daarom ook: geen preview voor wie niet meespeelt. Een organisator die de
 * uitslag invult heeft hier geen rating in het spel, en een verzonnen cijfer is
 * erger dan geen cijfer.
 */
export function RatingPreview({
  mijnKans,
  staked = false,
  joker = null,
}: {
  /** Winkans (0..1) van jóuw team; null = geen ratings bekend, geen preview. */
  mijnKans: number | null;
  /** Staat er een lef-tip van jou op deze match? Verdubbelt je mutatie. */
  staked?: boolean;
  /** Jouw joker op deze match, of null. */
  joker?: JokerId | null;
}) {
  if (mijnKans == null) return null;

  const { winst, verlies } = eigenSwing({ mijnKans, staked, joker });

  const schild = joker === "schild";
  const modifier = joker
    ? `${jokerIcoon(joker)} ${jokerLabel(joker)}`
    : staked
      ? "🎲 Lef — dubbel of niets"
      : null;

  return (
    <div className="ratingpreview">
      <div className="ratingpreview__kop">
        <span className="ratingpreview__titel">Jouw rating</span>
        {modifier && (
          <span className="ratingpreview__modifier">{modifier}</span>
        )}
      </div>
      {schild ? (
        <p className="ratingpreview__schild">
          Je schild ligt op deze match: hij telt niet mee — 0 bij winst, 0 bij
          verlies.
        </p>
      ) : (
        <div className="ratingpreview__cijfers">
          <span className="ratingpreview__cel">
            <span className="ratingpreview__wat">bij winst</span>
            <strong className="ratingpreview__waarde is-up">+{winst}</strong>
          </span>
          <span className="ratingpreview__cel">
            <span className="ratingpreview__wat">bij verlies</span>
            <strong className="ratingpreview__waarde is-down">{verlies}</strong>
          </span>
        </div>
      )}
      {!schild && (staked || joker === "dubbel_of_niets") && (
        <p className="ratingpreview__voet">
          Verdubbeld — bij een gelijkspel telt dat niet en blijft het bij de
          gewone mutatie.
        </p>
      )}
    </div>
  );
}

export default RatingPreview;
