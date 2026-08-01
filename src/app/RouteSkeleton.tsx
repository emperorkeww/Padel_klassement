/**
 * Laadvorm per route (#949).
 *
 * De shell toonde tijdens het lazy-laden voor élke pagina dezelfde twee grijze
 * blokken: titel, subtitel, twee kaarten. Daarna plofte de echte layout
 * eroverheen — de placeholder voorspelde niets. Deze variant leidt uit het pad
 * af wat er komt en zet díe vorm neer: de hero van het overzicht, de dagrijen
 * van de feed, het podium van het klassement, en zo verder.
 *
 * Eén component in plaats van een fallback per route: de vormen zijn een paar
 * regels elk, en zo blijft er één plek waar de shell zijn laadstaat bepaalt.
 * De inhoud is decoratief (`aria-hidden`) — dat de pagina laadt zegt de route
 * zelf zodra hij er is.
 */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  return (
    <div className="route-skeleton" aria-hidden="true">
      <div className="route-skeleton__bar route-skeleton__bar--title" />
      <div className="route-skeleton__bar route-skeleton__bar--sub" />
      {vormVoor(pathname)}
    </div>
  );
}

/** Blok van `h` hoog; de vormen hieronder zijn niets anders dan een stapeling. */
function Blok({ h, w = "100%" }: { h: string; w?: string }) {
  return (
    <div className="route-skeleton__card" style={{ height: h, width: w }} />
  );
}

/** Rij van gelijke blokken (tegels, kaarten naast elkaar). */
function Rij({ n, h }: { n: number; h: string }) {
  return (
    <div className="route-skeleton__rij">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="route-skeleton__card" style={{ height: h }} />
      ))}
    </div>
  );
}

function vormVoor(pathname: string) {
  // Overzicht: de player card, dan de zone "Vandaag" met twee kaarten.
  if (pathname === "/")
    return (
      <>
        <Blok h="13rem" />
        <Blok h="6rem" />
        <Blok h="6rem" />
      </>
    );
  // Feed: dagkop met een reeks smalle gebeurtenisrijen.
  if (pathname.startsWith("/feed"))
    return (
      <>
        <div className="route-skeleton__bar route-skeleton__bar--sub" />
        <Blok h="3.5rem" />
        <Blok h="3.5rem" />
        <Blok h="3.5rem" />
        <Blok h="3.5rem" />
      </>
    );
  // Klassement: het podium (drie kolommen) boven de ranglijst.
  if (pathname.startsWith("/klassement"))
    return (
      <>
        <Rij n={3} h="9rem" />
        <Blok h="16rem" />
      </>
    );
  // Matchdetail: één groot scorebord; de lijst is een rij matchkaarten.
  if (pathname.startsWith("/matches/")) return <Blok h="18rem" />;
  if (pathname.startsWith("/matches"))
    return (
      <>
        <Blok h="2.5rem" />
        <Blok h="5rem" />
        <Blok h="5rem" />
        <Blok h="5rem" />
      </>
    );
  // Spelen en Vrienden: kaarten/rijen onder elkaar.
  if (pathname.startsWith("/spelen") || pathname.startsWith("/groepen"))
    return (
      <>
        <Blok h="7rem" />
        <Blok h="7rem" />
      </>
    );
  if (pathname.startsWith("/vrienden"))
    return (
      <>
        <Blok h="2.5rem" />
        <Blok h="12rem" />
      </>
    );
  // Spelersprofiel: de FUT-kaart naast de identiteit, dan de tegelrij.
  if (pathname.startsWith("/spelers"))
    return (
      <>
        <Blok h="14rem" />
        <Rij n={2} h="5rem" />
      </>
    );
  // Instellingen: twee kaarten naast elkaar.
  if (pathname.startsWith("/profiel")) return <Rij n={2} h="12rem" />;
  // Banen: het rooster als één breed blok.
  if (pathname.startsWith("/banen")) return <Blok h="20rem" />;
  return (
    <>
      <Blok h="8rem" />
      <Blok h="8rem" />
    </>
  );
}

export default RouteSkeleton;
