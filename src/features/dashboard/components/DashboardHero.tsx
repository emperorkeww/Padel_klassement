import { Link } from "react-router-dom";
import { Avatar } from "@/ui/Avatar";
import { CoachAvatar } from "@/features/coach/components/CoachAvatar";
import { COMMENTATOR } from "@/features/coach/roastTone";
import { coachEmptyState } from "@/features/coach/coachMoments";
import { FormChips } from "@/features/rating/components/FormChips";
import { TierBadge } from "@/features/rating/components/TierBadge";
import { THIN_GAMES } from "@/features/groups/groupRating";
import { BIG_DADDY_EMOJI } from "../bigDaddy";
import { DICTATOR_EMOJI, dictatorPropaganda } from "../dictator";
import type { Badge } from "@/features/profiles/badges";
import type { Profile } from "@/types";
import { heroKlassen, type HeroOverlay, type HeroPermanent } from "../heroThema";
import { HeroCrest } from "./HeroCrest";
import { HeroLagen } from "./HeroLagen";
import { BadgeStrip } from "./BadgeStrip";
import "./DashboardHero.css";

// De hero draagt de status van de speler zelf (#613, uitgebreid in #644, #760 en
// #771): keizerlijk donker voor de zittende dictator, roze/goud voor de Big
// Daddy, platina-lauwer voor de kampioen, kraftkarton voor de Pias van de week en
// de speelkaart voor de Zwarte Piet.
//
// Sinds #771 zijn dat twee assen (zie heroThema.ts): het permanente materiaal van
// de kaart, en daarbovenop de tijdelijke overlay van de weekwinst (In-Form) of een
// lopende reeks (On Fire). Die overlay vervángt de kaart dus niet meer — wie deze
// week in vorm is én de pias van zijn groep, ziet een piaskaart met een glans
// erover in plaats van een In-Form-kaart waarop de schande verdwenen is.
//
// Kleur is nooit de enige indicator: de winnende status staat vooraan als
// statusbadge en élke andere status blijft als crest-chip staan, ook die van het
// verliezende thema. Welk thema wint — en waarom een roast-schild alleen de
// schande-thema's dooft — staat in heroThema.ts.

/** Icoon + labeltekst van één crest, uit heroCrestTekst. */
type CrestTekst = { emoji: string; label: string };

/** Eén titel-crest, klaar om als chip of als statusbadge te renderen. */
type Crest = {
  variant:
    | "dictator"
    | "bigdaddy"
    | "kampioen"
    | "inform"
    | "onfire"
    | "piet"
    | "pias";
  emoji: string;
  label: string;
  uitleg: string;
};

export type HeroStatus = {
  dictator: boolean;
  bigDaddy: boolean;
  kampioen: boolean;
  inForm: boolean;
  onFire: boolean;
  piet: boolean;
  pias: boolean;
  /** Waar je pias bent, bv. "in Vrijdagavond Padel" — voor de crest-uitleg. */
  piasWaar: string;
  schild: boolean;
  /** Permanent materiaal van de kaart; null laat de kaart neutraal. */
  thema: HeroPermanent;
  /** Tijdelijke statusoverlay bovenop dat materiaal; null als er geen loopt. */
  overlay: HeroOverlay;
  /** Editie-regels van de drie club-brede statussen, zoals de FUT-kaart ze
   *  schrijft (editieLabel) — alleen gelezen als de bijbehorende vlag staat. */
  labels: { kampioen: CrestTekst; inform: CrestTekst; onfire: CrestTekst };
};

/** De crests die deze speler draagt, in weergavevolgorde. Elke titel staat hier
 *  precies één keer: zo kunnen de statusbadge en de chips nooit twee
 *  formuleringen van dezelfde status krijgen. */
function crestsVan(status: HeroStatus, myId: string): Crest[] {
  const uit: Crest[] = [];
  if (status.dictator)
    uit.push({
      variant: "dictator",
      emoji: DICTATOR_EMOJI,
      label: "El Padelissimo",
      uitleg: `Zittende dictator — ${dictatorPropaganda(myId)}.`,
    });
  if (status.bigDaddy)
    uit.push({
      variant: "bigdaddy",
      emoji: BIG_DADDY_EMOJI,
      label: "Big Daddy",
      uitleg: "#1 van het klassement — de baas van de baan.",
    });
  // De drie club-brede edities (#760). De uitleg zegt telkens expliciet "van de
  // club": de pias- en Piet-crests hieronder zijn per gróep (#655/#645), en zonder
  // dat woord zou de hero twee scopes door elkaar tonen zonder ze te benoemen.
  if (status.kampioen)
    uit.push({
      variant: "kampioen",
      emoji: status.labels.kampioen.emoji,
      label: status.labels.kampioen.label,
      uitleg:
        "Je won het vorige kwartaal in de hele club en draagt de titel het lopende kwartaal lang.",
    });
  if (status.inForm)
    uit.push({
      variant: "inform",
      emoji: status.labels.inform.emoji,
      label: status.labels.inform.label,
      uitleg:
        "Speler van de week van de hele club: de grootste Elo-winst van de laatste zeven dagen.",
    });
  if (status.onFire)
    uit.push({
      variant: "onfire",
      emoji: status.labels.onfire.emoji,
      label: status.labels.onfire.label,
      uitleg:
        "Je hebt een lopende winstreek. Anders dan de andere titels kunnen meerdere spelers in de club tegelijk on fire zijn.",
    });
  if (status.piet)
    uit.push({
      variant: "piet",
      emoji: status.schild ? "📊" : "🃏",
      label: status.schild ? "Schande-token" : "Zwarte Piet",
      uitleg:
        "Jij draagt het rondgaande schande-token van de groep — tot je wint en het doorschuift.",
    });
  if (status.pias)
    uit.push({
      variant: "pias",
      emoji: status.schild ? "📊" : "🤡",
      label: status.schild ? "Opvallende week" : "Pias van de week",
      uitleg: `De grootste afgang van deze week ${status.piasWaar}. De 🤡-editie op de FUT-kaart is voor de Pias van de club — de ergste van álle groepen samen.`,
    });
  return uit;
}

export function DashboardHero({
  myId,
  profile,
  naam,
  rating,
  ratingGames,
  rank,
  heeftStand,
  loading,
  status,
  earnedBadges,
  form,
  briefing,
  generateCta,
}: {
  myId: string;
  profile: Profile | undefined;
  naam: string;
  rating: number | null;
  ratingGames: number;
  rank: number | null;
  /** Staat de speler al in het klassement? Zo niet: lege-staat-tekst. */
  heeftStand: boolean;
  loading: boolean;
  status: HeroStatus;
  earnedBadges: Badge[];
  form: ("W" | "D" | "L")[];
  briefing: string | null;
  generateCta: { to: string; label: string };
}) {
  const { thema, overlay } = status;
  const crests = crestsVan(status, myId);
  // De statusbadge is de crest van het thema dat de kaart draagt; loopt er een
  // tijdelijke overlay, dan is dát de badge — die vertelt het nieuws van deze
  // week, terwijl het materiaal eronder de permanente titel al toont. Met een
  // roast-schild is er geen winnend schande-thema en dus ook geen badge: de
  // neutrale 📊-chip blijft gewoon in de rij staan (#183).
  const badgeVariant = overlay ?? thema;
  const badge = crests.find((c) => c.variant === badgeVariant) ?? null;
  const chips = crests.filter((c) => c !== badge);

  return (
    <section className={heroKlassen(thema, overlay)}>
      <HeroLagen permanent={thema} overlay={overlay} />
      <div className="hero__main">
        {/* Primaire ingang naar de profielweergave (#706). De avatar is de
            conventionele gesture, maar een klikbare avatar alleen is niet
            vindbaar — vandaar het zichtbare label eronder. Het staat in de
            avatarkolom (die korter is dan het tekstblok ernaast) zodat de
            hero geen regel hoger wordt op smalle schermen. */}
        <Link className="hero__me" to={`/spelers/${myId}`} aria-label="Naar mijn profiel">
          <Avatar profile={profile} name={naam || undefined} size={56} />
          <span className="hero__me-label" aria-hidden="true">
            Mijn profiel →
          </span>
        </Link>
        <div className="hero__text">
          <p className="hero__eyebrow">Racket in de aanslag?</p>
          <h1 className="hero__name">
            {naam ? `Hoi, ${naam}` : "Hoi!"}
            <TierBadge
              rating={rating}
              dimmed={ratingGames > 0 && ratingGames < THIN_GAMES}
            />
          </h1>
          {loading ? (
            // Geen "speel je eerste match"-flits terwijl de stand nog laadt.
            <span className="sk sk--line hero__sub-sk" aria-hidden="true" />
          ) : (
            <p className="hero__sub">
              {heeftStand
                ? `Je bezet momenteel plek #${rank || "?"} in het klassement met een rating van ${rating || "1000"}.`
                : profile
                  ? coachEmptyState({
                      type: "dashboard",
                      seed: `${myId}-empty-dashboard`,
                      ctx: {
                        intensiteit: profile.roast_intensiteit ?? "gemeen",
                        schild: profile.roast_schild ?? false,
                      },
                    })
                  : "Kom in beweging en speel je eerste match om het klassement te bestormen!"}
            </p>
          )}
          {(crests.length > 0 || earnedBadges.length > 0) && (
            <div className="hero__titles" aria-label="Jouw titels en badges">
              {badge && (
                <HeroCrest
                  variant={badge.variant}
                  emoji={badge.emoji}
                  label={badge.label}
                  uitleg={badge.uitleg}
                  prominent
                />
              )}
              {chips.map((c) => (
                <HeroCrest
                  key={c.variant}
                  variant={c.variant}
                  emoji={c.emoji}
                  label={c.label}
                  uitleg={c.uitleg}
                />
              ))}
              {earnedBadges.length > 0 && (
                <BadgeStrip badges={earnedBadges} to={`/spelers/${myId}`} />
              )}
            </div>
          )}
          {briefing && !loading && (
            <p className="hero__coach" role="note">
              <CoachAvatar size={26} className="hero__coach-face" />
              <span>
                <span className="hero__coach-name">{COMMENTATOR.naam}:</span>{" "}
                {briefing}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="hero__divide" aria-hidden="true" />
      <div className="hero__foot">
        {form.length > 0 && (
          <Link className="hero__form" to={`/spelers/${myId}`}>
            <span className="hero__form-label">Vorm</span>
            <FormChips form={form} />
          </Link>
        )}
        <div className="hero__actions">
          <Link className="btn btn--primary" to="/matches">
            + Match loggen
          </Link>
          <Link className="btn" to={generateCta.to}>
            {generateCta.label}
          </Link>
          <Link className="btn" to="/banen">
            Vrije banen
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DashboardHero;
