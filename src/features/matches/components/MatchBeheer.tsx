import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Beheer-secties van het matchdetail achter één inklapper (#915).
 *
 * Na het scorebord stonden zes gelijkwaardige kaarten onder elkaar, waarvan de
 * meeste voor de meeste kijkers niet relevant zijn. Wat over de wedstrijd zelf
 * gaat (opstelling) en wat jóu aangaat (smoesjes, toto, lef, uitslag invullen)
 * blijft staan; de administratie die je hooguit één keer per match doet —
 * netrollers, groepskoppeling, gastenwissel — zakt hierin. Standaard dicht:
 * dit is de uitzondering, niet de regel.
 *
 * De balk verbergt zichzelf zodra er niets in zit. Dat kan de aanroeper niet
 * vooraf bepalen: elk van de drie secties beslist zélf of hij iets toont, en
 * sommige pas nadat hun eigen query binnen is (GroupLinkSection geeft null
 * zolang je groepen laden, of wanneer je de koppeling niet mag wijzigen).
 * Vandaar een MutationObserver op het lichaam: die ziet ook een sectie die
 * later alsnog verschijnt of wegvalt.
 */
export function MatchBeheer({ children }: { children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [leeg, setLeeg] = useState(true);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const meet = () => setLeeg(el.childElementCount === 0);
    meet();
    const mo = new MutationObserver(meet);
    mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, []);

  return (
    <details className="md-beheer" hidden={leeg}>
      <summary className="md-beheer__summary">
        <span className="md-beheer__title">Beheer &amp; correcties</span>
        <span className="md-beheer__hint">netrollers · groep · gastspeler</span>
      </summary>
      <div className="md-beheer__body" ref={bodyRef}>
        {children}
      </div>
    </details>
  );
}

export default MatchBeheer;
