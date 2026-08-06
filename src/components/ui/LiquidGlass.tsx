import type { ComponentPropsWithRef, ElementType, ReactNode } from "react";
import { useGlasAanwijzer } from "@/lib/hooks/useGlasAanwijzer";
import "./glas.css";

/**
 * Liquid Glass-vlak (#1062).
 *
 * Een doorschijnend materiaal met een geblurde backdrop, een refractieve rand,
 * een binnengloed en — als het vlak interactief is — een hooglicht dat de
 * aanwijzer volgt. Dit is een benadering in browsertechniek, niet het native
 * Liquid Glass van Apple; zie docs/liquid-glass.md voor wat er precies mist.
 *
 * Het echte werk zit in glas.css. Dit component stelt alleen de classes samen
 * en koppelt de aanwijzer-hook aan. Bestaande vlakken (de balken, het sheet)
 * krijgen die classes rechtstreeks, zonder wrapper: een extra element eromheen
 * zou hun layout veranderen.
 *
 * Twee bewuste afwijkingen van de huisstijl in components/ui, allebei omdat de
 * issue er expliciet om vraagt: dit component spreidt de resterende
 * HTML-attributen door (elders in de repo doen we dat nergens) en het heeft een
 * `as`-prop. Een ref doorgeven mag gewoon als prop — React 19 heeft daar geen
 * forwardRef meer voor nodig.
 */

export type GlasVariant = "subtiel" | "standaard" | "sterk" | "interactief";
export type GlasVorm = "paneel" | "pil" | "cirkel" | "eigen";

type GlasEigen = {
  children: ReactNode;
  className?: string;
  /** Hoeveel materiaal: van bijna vlak (`subtiel`) tot duidelijk zwevend (`sterk`). */
  variant?: GlasVariant;
  /** De afronding. `eigen` laat de hoeken aan het element zelf. */
  vorm?: GlasVorm;
  /** Reageren op de aanwijzer. Standaard aan bij `variant="interactief"`. */
  interactief?: boolean;
  /** Dof materiaal, geen hooglicht, geen indrukbeweging. */
  uitgeschakeld?: boolean;
};

/** Polymorf: de props van het element uit `as` horen er gewoon bij, zodat een
 *  `<LiquidGlass as="button" type="button">` net zo streng gecontroleerd wordt
 *  als een kale knop. */
export type LiquidGlassProps<T extends ElementType = "div"> = GlasEigen & {
  /** Het te renderen element; bv. `"button"`, `"section"` of `Link`. */
  as?: T;
} & Omit<ComponentPropsWithRef<T>, keyof GlasEigen | "as">;

export function LiquidGlass<T extends ElementType = "div">({
  children,
  className,
  variant = "standaard",
  vorm = "paneel",
  interactief,
  uitgeschakeld = false,
  as,
  ...rest
}: LiquidGlassProps<T>) {
  const Element = (as ?? "div") as ElementType;
  const reageert = (interactief ?? variant === "interactief") && !uitgeschakeld;
  const aanwijzer = useGlasAanwijzer(reageert);

  const classes = ["glas", `glas--${variant}`];
  // Een `interactief`-vlak met een andere variant krijgt de toestandsregels er
  // bij; bij variant="interactief" staat die class er al.
  if (reageert && variant !== "interactief") classes.push("glas--interactief");
  if (vorm !== "eigen") classes.push(`glas--${vorm}`);
  if (className) classes.push(className);

  return (
    <Element
      className={classes.join(" ")}
      data-interactief={reageert ? "true" : undefined}
      aria-disabled={uitgeschakeld ? true : undefined}
      {...aanwijzer}
      {...rest}
    >
      <span className="glas__inhoud">{children}</span>
    </Element>
  );
}

export default LiquidGlass;
