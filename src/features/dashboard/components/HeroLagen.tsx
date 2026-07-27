// De decoratieve lagen van de dashboard player card (#771).
//
// Alle thema's — divisie, Big Daddy, Dictator, Pias, schande-token — en de twee
// tijdelijke overlays tekenen in dezelfde vaste volgorde:
//
//   1. buitenste kaartschaduw        → box-shadow op .hero zelf
//   2. achterste ornamenten          ┐
//   3. basisachtergrond van de divisie│
//   4. permanent speciaal thema       ├ .hero__lagen (geklipt)
//   5. watermerken en materiaaltextuur│
//   7. tijdelijke In-Form/On Fire-tint│
//   8. bewegende glans               ┘
//   6. profielavatar en inhoud       → .hero__main / __divide / __foot (z-index 1)
//   9. crest, badge, voorste randhighlights → .hero__lagen--voor (niet geklipt)
//  10. interactieve knoppen          → in de inhoud, dus altijd boven de decoratie
//
// Twee containers omdat de twee helften een tegengestelde eis hebben: materiaal,
// watermerk en glans moeten binnen de afgeronde hoeken blijven (geklipt),
// terwijl een crest in de bovenrand, een ballon of een lintkrul in de hoek juist
// half buiten de kaart hangt. Klippen op .hero zelf kan niet — dat zou de
// tooltip van een HeroCrest afkappen.
//
// Beide containers zijn `aria-hidden` en laten alle aanwijzers door: decoratie
// mag nooit een knop of link afvangen (#771, AC10).
//
// De ornamenten zelf komen uit het register van de bijbehorende FUT-kaart
// (#710/#769): dezelfde kroon, dezelfde commandoster, dezelfde linten. Zie
// heroOrnamentenBigDaddy.tsx en dictatorOrnamenten.tsx.

import {
  DictatorGoudDefs,
  DictatorKaderHoek,
  DictatorKroonCrest,
  DictatorRandRuit,
  DictatorWatermerk,
} from "@/features/standings/components/dictatorOrnamenten";
import {
  BD_KROON_MOTIEF,
  BD_KROON_MOTIEF_KLEUR,
} from "@/features/rating/components/ornamentenBigDaddy";
import {
  PiasKaartDecor,
  PiasMaskerMedaillon,
  PiasNarrenkap,
  PiasWatermerk,
} from "@/features/standings/components/piasOrnamenten";
import {
  PietDoorgeefringen,
  PietGebrokenZegel,
  PietPionCrest,
  PietSluiting,
} from "./heroOrnamentenPiet";
import type { HeroBasis } from "../heroDivisie";
import type { HeroOverlay, HeroPermanent } from "../heroThema";
import { HeroSheen } from "./HeroSheen";
import { HeroWatermerk } from "./HeroWatermerk";
import {
  BigDaddyBallonnen,
  BigDaddyConfetti,
  BigDaddyKroonCrest,
  BigDaddyLint,
} from "./heroOrnamentenBigDaddy";

/** Wat een permanent thema in de geklipte laag legt: materiaaltextuur en het
 *  watermerk. Alles wat half buiten de kaart hangt staat in `OrnamentenVoor`. */
function OrnamentenAchter({ permanent }: { permanent: HeroPermanent }) {
  switch (permanent) {
    case "bigdaddy":
      return (
        <>
          {/* De kroon als watermerk, letterlijk het motief van de 👑-kaart. */}
          <HeroWatermerk
            paden={BD_KROON_MOTIEF}
            kleur={BD_KROON_MOTIEF_KLEUR}
            className="hero__watermerk--kroon"
          />
          <BigDaddyConfetti className="hero__confetti" />
        </>
      );
    case "dictator":
      return (
        <>
          {/* Bewust zónder de basisklasse .hero__watermerk: die is gemaakt voor
              de divisiemotieven (mask, dekking, en in het donkere thema een
              invert). Dit is een goudlijn-tekening op een donker vlak en heeft
              precies het omgekeerde nodig. */}
          <DictatorWatermerk className="hero__watermerk--lauwer" />
          {/* Randruiten op de boven- en onderrand, zoals op De Troon. */}
          <DictatorRandRuit className="hero__ruit hero__ruit--boven" />
          <DictatorRandRuit className="hero__ruit hero__ruit--onder" />
        </>
      );
    case "pias":
      return (
        <>
          {/* Harlekijnruiten en de handvol confettisnippers, precies zoals De
              Schandpaal ze legt: patroon in px, niet in procenten, zodat ze op
              een brede kaart even schaars blijven. */}
          <PiasKaartDecor className="hero__decor" />
          <PiasWatermerk className="hero__watermerk--maskers" />
        </>
      );
    case "piet":
      return <PietDoorgeefringen className="hero__ringen" />;
    default:
      return null;
  }
}

/** Wat een permanent thema vóór de kaart legt: crests en hoekornamenten die
 *  bewust over de rand heen steken. */
function OrnamentenVoor({ permanent }: { permanent: HeroPermanent }) {
  switch (permanent) {
    case "bigdaddy":
      return (
        <>
          <BigDaddyKroonCrest className="hero__crest hero__crest--kroon" />
          <BigDaddyBallonnen className="hero__ballonnen" />
          <BigDaddyLint className="hero__lint hero__lint--links" />
          <BigDaddyLint className="hero__lint hero__lint--rechts" />
        </>
      );
    case "dictator":
      return (
        <>
          <DictatorKroonCrest className="hero__crest hero__crest--troon" />
          {/* Vier keer hetzelfde lauwerdetail; de CSS spiegelt drie ervan, zodat
              de hoeken per constructie identiek zijn. */}
          <DictatorKaderHoek className="hero__hoek hero__hoek--lb" />
          <DictatorKaderHoek className="hero__hoek hero__hoek--rb" />
          <DictatorKaderHoek className="hero__hoek hero__hoek--lo" />
          <DictatorKaderHoek className="hero__hoek hero__hoek--ro" />
        </>
      );
    case "pias":
      return (
        <>
          {/* De narrenkap hangt over de bovenrand en het gebarsten
              maskermedaillon zit in de onderhoek — dezelfde twee ornamenten die
              op De Schandpaal de portretlijst vastzetten. */}
          <PiasNarrenkap className="hero__crest hero__crest--kap" />
          <PiasMaskerMedaillon className="hero__medaillon" />
        </>
      );
    case "piet":
      return (
        <>
          <PietPionCrest className="hero__crest hero__crest--pion" />
          <PietGebrokenZegel className="hero__zegel-breuk" />
          <PietSluiting className="hero__ketting hero__ketting--links" />
          <PietSluiting className="hero__ketting hero__ketting--rechts" />
        </>
      );
    default:
      return null;
  }
}

export function HeroLagen({
  permanent,
  overlay,
  basis = null,
}: {
  permanent: HeroPermanent;
  overlay: HeroOverlay;
  /** Divisiebasis (#771): alleen gezet zolang geen permanent thema het
   *  materiaal overneemt — zie heroBasis. */
  basis?: HeroBasis | null;
}) {
  // Zonder basis, thema én overlay is er niets te tekenen: geen lege lagen in de
  // DOM van een kaart die niets bijzonders draagt (een speler zonder rating).
  if (!basis && !permanent && !overlay) return null;

  // Niet elk thema heeft iets dat over de rand steekt; zonder inhoud blijft de
  // tweede container weg.
  const heeftVoor =
    permanent === "bigdaddy" ||
    permanent === "dictator" ||
    permanent === "pias" ||
    permanent === "piet";

  return (
    <>
      {/* Het goudverloop dat de troonornamenten delen. Documentbreed, dus één
          keer per kaart volstaat; een tweede definitie met hetzelfde id wint
          niet, en dezelfde stops leveren hetzelfde goud op. */}
      {permanent === "dictator" && <DictatorGoudDefs />}
      <span className="hero__lagen" aria-hidden="true">
        {/* Stap 3: de basisachtergrond van de divisie — het materiaal onder alles.
            De kleuren komen als custom properties op .hero binnen (heroDivisie.ts);
            deze laag legt ze in een verloop. */}
        {basis && <span className="hero__materiaal" />}
        {/* Stap 5: het divisiemotief als watermerk, en voor de twee toptiers de
            statische stand van hun premium glans (#773). */}
        {basis?.watermerk && (
          <HeroWatermerk
            paden={basis.watermerk.paden}
            kleur={basis.watermerk.kleur}
            breedte={basis.watermerk.breedte}
          />
        )}
        {basis?.glans && <span className="hero__glans" />}
        {/* Stap 4 en 5 voor een permanent thema: zijn materiaaltextuur en
            watermerk. Het vlak zelf staat op .hero (DashboardHero.css). */}
        <OrnamentenAchter permanent={permanent} />
        {/* Stap 7: de tint van de tijdelijke overlay. Bewust een láág en niet de
            achtergrond van .hero — anders vervangt de overlay het permanente
            materiaal in plaats van erop te liggen (AC4), en dat is precies wat
            #771 rechtzet. Half doorlatend, zodat de kaart eronder herkenbaar
            blijft. */}
        {overlay && <span className={`hero__tint hero__tint--${overlay}`} />}
        {/* Stap 8: de bewegende glans, gedeeld door beide overlays. */}
        {overlay && <HeroSheen overlay={overlay} />}
      </span>
      {/* Stap 9: alles wat over de rand heen steekt. Alleen renderen als er iets
          in staat — een lege span in de DOM van elke kaart is nergens goed voor. */}
      {heeftVoor && (
        <span className="hero__lagen hero__lagen--voor" aria-hidden="true">
          <OrnamentenVoor permanent={permanent} />
        </span>
      )}
    </>
  );
}

export default HeroLagen;
