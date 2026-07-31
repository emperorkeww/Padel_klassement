// De lijst van een dashboardkaart die een eigen profiel draagt (#834).
//
// Vier geneste, identiek afgeronde vlakken — rail, band, keyline, vlak — precies
// de stapeling die de FUT-kaart al gebruikt (`.fut-kaart__zijde` > `__liner` >
// `__keyline` > `__vlak`, FutKaart.css). Elk vlak is dekkend en ligt ín zijn
// voorganger, dus wat je als lijst ziet is het verschil tussen twee
// opeenvolgende vlakken. Eén element met vier inset-schaduwen kan dat niet: de
// buitenste rail is een metaalverloop en een inset-schaduw draagt geen verloop.
//
// Het vlak is tegelijk het montagepunt voor decoratie die áchter de lijst hoort
// te verdwijnen. Het klipt op zijn eigen afgeronde binnenrand, dus een watermerk
// of een lintmiddenstuk kan er per constructie niet overheen schilderen — de
// tegenhanger van de inside-layer op de FUT-kaart, die het echte
// `clip-path: var(--schild)` erft. Alles wat vóór de lijst hoort te komen staat
// in `hero__lagen--voor` (HeroLagen).
//
// De diktes staan in de CSS van het thema, in `cqw`: een percentage in `inset`
// rekent horizontaal tegen de breedte en verticaal tegen de hoogte, en dat zou
// een brede kaart een dunnere boven- dan zijrand geven.

import type { ReactNode } from "react";

export function HeroLijst({ children }: { children?: ReactNode }) {
  return (
    <span className="hero__lijst">
      <span className="hero__lijst-band">
        <span className="hero__lijst-key">
          <span className="hero__vlak">{children}</span>
        </span>
      </span>
    </span>
  );
}

export default HeroLijst;
