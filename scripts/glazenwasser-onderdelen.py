#!/usr/bin/env python3
"""Snijdt de losse Glazenwasser-onderdelen uit docs/referentie_glazenwasser.png.

Dit vervangt de aanpak waarbij één platte master als vensterbron diende. Die
master is een compositie: elke rechthoekige uitsnede sleepte de buren en de
achtergrondtextuur mee, dus elk onderdeel had een masker nodig en overlappende
onderdelen moesten één transform delen. Hier krijgt élk onderdeel zijn eigen
strak bijgesneden WebP met eigen alfa — geen overtollige transparante rand, geen
spookkopieën, en elk onderdeel kan los geschaald en geplaatst worden.

    python3 scripts/glazenwasser-onderdelen.py            # schrijft de assets
    python3 scripts/glazenwasser-onderdelen.py --preview   # ook een contactblad

Afhankelijkheden staan bewust buiten de npm-toolchain (eenmalige assetstap):
Python 3 met numpy en Pillow.

Werking
-------
De referentie is één platte render op zwart. Per onderdeel wordt een contour
getrokken en binnen die contour een sleutel gekozen:

* `vast`  — massieve voorwerpen (crest, trekkers, emmer, badge). De contour geeft
  het gebied aan; binnen dat gebied bepaalt de afwijking tegenover een lokaal
  achtergrondmodel welke pixels bij het voorwerp horen, waarna gaten worden
  gevuld. Zo volgt de alfa het échte silhouet in plaats van de handgetrokken lijn;
* `glas` — halftransparant materiaal (schuim, zeepbellen, water, condens): alfa
  komt rechtstreeks uit die afwijking, dus rook- en schuimranden blijven zacht;
* `zwart` — materiaal dat buiten de kaart op zwart staat: een luminantiesleutel.

Elk resultaat wordt op zijn alfa bijgesneden en met zijn `doos` (de plek in de
referentie) weggeschreven, zodat glazenwasserLayout.ts weet waar het hoort.

Naast de doos schrijft het script per onderdeel ook meetwaarden weg: hoeveel alfa
er in de uitsnede zit en hoeveel die alfa overlapt met de andere onderdelen. Die
twee getallen vangen precies de twee manieren waarop een uitsnede stuk kan gaan
zonder dat je het aan de WebP ziet — een onderdeel dat leeg is gekeyd, en een
onderdeel dat zijn buurman heeft meegenomen en dus als spookkopie op de kaart
belandt. `glazenwasserAssets.test.ts` bewaakt ze; een binaire asset is in een
diff niet te lezen, deze cijfers wel.
"""

from __future__ import annotations

import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "fut-kaarten" / "referentie_glazenwasser.png"
UIT = WORTEL / "src/features/rating/components/glazenwasser/assets"
KWALITEIT = 88

# Buitenrand van het frame in de referentie (1065 × 1477).
RX0, RY0, RX1, RY1 = 44.0, 118.0, 1019.0, 1232.0
RW, RH = RX1 - RX0, RY1 - RY0

# --- contouren ----------------------------------------------------------------
CREST = [
    (508, 30), (556, 48), (600, 76), (604, 152), (556, 190), (528, 208),
    (496, 208), (450, 158), (446, 78), (468, 50),
]

# Blad, kop, ferrule, steel en het schuim dat eraan hangt: één voorwerp.
# Ruim om het voorwerp heen: blad, kop, steel, het schuim dat eraan hangt én het
# waterspoor dat ervandaan loopt. Een contour die strak om de trekker zit, snijdt
# juist dat schuim af — en dat is precies wat een geplakte PNG verraadt.
# De onderlob liep langs het waterspoor rechts van de trekker (x 188–382) en
# lag daarmee náást de steel in plaats van eromheen: de steel loopt van (118,660)
# tot (178,818). Zonder die lob eindigde het onderdeel bij de ferrule en miste de
# trekker precies het deel dat hem op de referentie zijn massa geeft.
TREKKER_BOVEN = [
    (2, 640), (8, 598), (146, 540), (244, 508), (296, 516), (340, 548),
    (356, 592), (352, 640), (326, 684), (322, 706), (352, 760), (376, 818),
    (382, 872), (358, 892), (322, 856), (296, 810), (250, 748), (208, 690),
    (196, 700), (190, 780), (186, 830), (168, 842), (140, 822), (118, 762),
    (104, 690), (96, 660), (60, 664), (16, 672),
]

# Haak en ketting waaraan de emmer hangt. Begint bij de klem (y 466) in plaats
# van bij y 332: dáárboven staat alleen de glasrail, en die kwam als tweede,
# verschoven lijst op de kaart terecht.
OPHANGING = [
    (848, 456), (958, 456), (974, 492), (988, 548), (998, 610), (998, 672),
    (970, 682), (946, 624), (922, 560), (892, 514), (858, 520), (838, 566),
    (824, 616), (806, 620), (812, 560), (828, 496),
]

# Emmer met beugel, schuimkop en de druppels die eroverheen lopen.
# Emmer met beugel, schuimkop én de druppels die eronder doorlopen: die druppels
# zijn de verbinding met het water lager op de kaart.
# Ruim tot onder de kuip: de bodem zat eerder onder de statblok-rechthoek en
# werd daardoor halftransparant, waardoor de emmer recht afgesneden leek.
EMMER = [
    (794, 646), (802, 612), (846, 592), (850, 578), (874, 572), (938, 572),
    (952, 592), (954, 612), (988, 594), (1016, 618), (1034, 648), (1040, 704),
    (1038, 768), (1032, 840), (1020, 906), (1000, 948), (966, 962), (930, 946),
    (896, 900), (856, 866), (826, 826), (806, 748),
]

TREKKER_ONDER = [
    (366, 1104), (378, 1058), (700, 910), (764, 926), (782, 980), (458, 1184),
    (398, 1182), (362, 1140),
]

# Onderschild inclusief het schuim dat over zijn schouders slaat: zonder dat
# schuim eindigt de badge met een harde rand midden in de waterexplosie.
# Onderschild én de trekker die er diagonaal overheen loopt, als één contour: op
# de referentie zijn dat geen twee voorwerpen maar één brandpunt, en los gesneden
# blijft er altijd een naad tussen de twee zichtbaar.
ONDERSCHILD = [
    (356, 1100), (372, 1032), (692, 896), (776, 916), (794, 988), (700, 1042),
    (682, 1108), (650, 1160), (596, 1204), (540, 1246), (496, 1246),
    (440, 1200), (382, 1146), (360, 1080),
]

BADGE = [
    (372, 996), (664, 996), (678, 1064), (656, 1140), (596, 1194),
    (540, 1236), (500, 1236), (444, 1194), (386, 1140), (366, 1064),
    (368, 1010),
]

SCHUIM_BOVEN_LINKS = [
    (48, 172), (68, 132), (118, 110), (190, 100), (262, 96), (344, 98),
    (348, 150), (302, 180), (240, 190), (176, 200), (126, 218), (96, 246),
    (58, 240),
]

SCHUIM_BOVEN_RECHTS = [
    (730, 104), (812, 96), (886, 100), (948, 110), (996, 130), (1020, 166),
    (1036, 212), (1030, 256), (998, 260), (966, 220), (930, 192), (870, 174),
    (800, 158), (738, 148),
]

# Waterexplosie langs de onderrand, over de volle breedte en op volle
# referentiehoogte — niet de ingekorte band die het smalle schild afdwong.
WATER_ONDER = [
    (40, 872), (1022, 872), (1026, 1012), (980, 1064), (902, 1116),
    (802, 1164), (702, 1204), (602, 1238), (530, 1250), (458, 1238),
    (358, 1204), (258, 1164), (168, 1116), (92, 1064), (38, 1008),
]

# Waterstrepen en druppels langs de bínnenrand van de lijst, links en rechts. Die
# maken van de losse plassen boven en onder één doorlopende waterhuid rond het
# frame: zonder deze twee stroken stopt het water halverwege de flank.
DRUPPELS_LINKS = [
    (128, 250), (206, 236), (214, 640), (208, 880), (140, 900), (122, 640),
]
DRUPPELS_RECHTS = [
    (848, 250), (930, 238), (944, 640), (932, 890), (860, 906), (844, 640),
]

# Binnenrand van het frame: het glasvlak waar de natte textuur uit komt.
GLAS_BINNEN = [
    (400, 178), (530, 172), (660, 178), (780, 196), (858, 222), (892, 258),
    (900, 338), (904, 468), (906, 598), (902, 728), (890, 848), (864, 938),
    (816, 1008), (738, 1078), (648, 1128), (530, 1168), (412, 1128),
    (322, 1078), (244, 1008), (196, 938), (170, 848), (158, 728),
    (154, 598), (156, 468), (160, 338), (196, 258), (262, 204), (330, 186),
]

# Kaartinhoud van de referentie: die zit in het bronbeeld ingebakken en mag
# nergens in een asset terechtkomen.
INHOUD = [
    (170, 186, 552, 366),      # rating 1150
    (296, 344, 396, 424),      # subniveau II
    (544, 154, 892, 502),      # avatarcirkel met ring
    (226, 580, 834, 624),      # glaslat boven de naamplaat
    (274, 628, 826, 748),      # PAPAPADEL
    (210, 744, 854, 806),      # GLAZENWASSER II
    (140, 826, 930, 948),      # statblok — tot 930: de laatste E van
                               # CONCENTRATIE steekt voorbij 914 uit; vanaf
                               # 140: de app zet zijn STREEPEN-kolom net links
                               # van de referentie, en de waterbewaarzone
                               # (WATER_ONDER begint op één rechte lijn op
                               # y 872) dekte die S via de voorstrip af
    (268, 428, 402, 584),      # het losse raampje bij de rating
]


# --- gereedschap --------------------------------------------------------------
def vervaag(m: np.ndarray, straal: float) -> np.ndarray:
    beeld = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8))
    return np.asarray(
        beeld.filter(ImageFilter.GaussianBlur(straal))
    ).astype(np.float32) / 255.0


def dilate(mask: np.ndarray, r: int = 1) -> np.ndarray:
    uit = mask
    for _ in range(r):
        p = np.pad(uit, 1, constant_values=False)
        uit = (
            p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2]
            | p[1:-1, 2:] | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
        )
    return uit


def erode(mask: np.ndarray, r: int = 1) -> np.ndarray:
    return ~dilate(~mask, r)


def ontkorrel(mask: np.ndarray, r: int = 1) -> np.ndarray:
    return dilate(erode(mask, r), r)


def vul_gaten(mask: np.ndarray, maxdeel: float = 0.08) -> np.ndarray:
    """Vult binnengaten die klein zijn tegenover het voorwerp zelf.

    Chroom, glimlichten en het venstertje op de emmer zijn lichter dan hun
    omgeving en vallen daarmee buiten de silhouetsleutel; als binnengat horen ze
    er wél bij. De maatgrens is wat deze functie bruikbaar maakt: zonder die
    grens wordt élke uitsparing dichtgesmeerd, en dan levert een sleutel die de
    contour bijna vult gewoon die contour terug — een massieve plaat achtergrond
    met het voorwerp erin. Dat was precies wat er misging."""
    gaten, n = ndimage.label(~mask)
    if n == 0:
        return mask
    maten = np.bincount(gaten.ravel())
    rand = np.unique(
        np.concatenate([gaten[0], gaten[-1], gaten[:, 0], gaten[:, -1]])
    )
    vul = maten <= maxdeel * float(mask.sum())
    # Label 0 is het voorwerp zelf; alles wat de canvasrand raakt is buitenwereld.
    vul[0] = False
    vul[rand] = False
    return mask | vul[gaten]


class Bron:
    def __init__(self) -> None:
        self.rgb = np.asarray(
            Image.open(REFERENTIE).convert("RGB")
        ).astype(np.float32)
        self.h, self.w = self.rgb.shape[:2]
        self.luma = (
            0.299 * self.rgb[..., 0]
            + 0.587 * self.rgb[..., 1]
            + 0.114 * self.rgb[..., 2]
        )
        self.afwijking = self._afwijking(22.0)
        self.detail = self._afwijking(9.0)
        self.voorwerp = self._voorwerp()
        self.vrij = np.ones((self.h, self.w), np.float32)
        for (x0, y0, x1, y1) in INHOUD:
            blok = np.zeros((self.h, self.w), np.float32)
            blok[max(0, y0 - 14):y1 + 14, max(0, x0 - 14):x1 + 14] = 1.0
            self.vrij *= 1.0 - vervaag(blok, 7.0)

    def _voorwerp(self) -> np.ndarray:
        """Silhouetsleutel: hoe sterk wijkt deze pixel af als *voorwerp*?

        Niet op afwijking-tegenover-vervaagd keyen. Nat glas is zélf getextureerd,
        dus die afwijking is over de hele kaartwand hoog en de sleutel geeft de
        handgetekende contour terug in plaats van een silhouet. Wat gereedschap
        wél onderscheidt van glas: het is donkerder dan zijn omgeving (rubber,
        chroom in de schaduw, blauwe steel) of sterker verzadigd (het blauw van
        emmer en steel). Glas en condens zijn licht en bleek, dus beide sleutels
        laten ze liggen.

        De verzadigingssleutel wordt op helderheid gepoort: de glasrail is óók fel
        blauw, maar hij is licht. Zonder die poort snijdt elke uitsnede langs de
        flank een stuk lijst mee."""
        verzadiging = self.rgb.max(-1) - self.rgb.min(-1)
        luma_vlak = vervaag(self.luma / 255.0, 26.0) * 255.0
        verz_vlak = vervaag(verzadiging / 255.0, 26.0) * 255.0
        donkerder = np.clip((luma_vlak - self.luma) / 34.0, 0, 1)
        verzadigder = np.clip((verzadiging - verz_vlak) / 26.0, 0, 1)
        poort = np.clip((190.0 - self.luma) / 50.0, 0, 1)
        return np.maximum(donkerder, verzadigder * poort)

    def _afwijking(self, straal: float) -> np.ndarray:
        vlak = np.stack(
            [vervaag(self.rgb[..., k] / 255.0, straal) * 255.0 for k in range(3)],
            axis=-1,
        )
        return np.abs(self.rgb - vlak).mean(-1)

    def contour(self, punten, feather: float) -> np.ndarray:
        m = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in punten],
                                  fill=255)
        arr = np.asarray(m).astype(np.float32) / 255.0
        return vervaag(arr, feather) if feather > 0 else arr


BRON = Bron()
DELEN: dict[str, dict] = {}
# Alfa van elk onderdeel op het hele referentiecanvas, vier keer verkleind. Op
# volle resolutie zou dit 11 × 6 MB kosten en die precisie is voor een
# overlapmeting nergens voor nodig.
ALFA: dict[str, np.ndarray] = {}
# Alfa op volle resolutie, alleen voor de voorwerpen die uit de ring worden
# geknipt: het gat moet exact hun silhouet zijn, niet de ruime contour.
VOL_ALFA: dict[str, np.ndarray] = {}
MONSTER = 4


def bewaar(naam: str, alpha: np.ndarray, x0: int, y0: int, x1: int, y1: int,
           kB: int, op_canvas: bool = True) -> None:
    """Legt doos én meetwaarden van één onderdeel vast.

    `op_canvas` staat uit voor de glastegel: die is geweven en heeft dus geen
    plek in de referentie, zodat hij ook niet met de andere onderdelen te
    vergelijken is."""
    uitsnede = alpha[y0:y1, x0:x1]
    if op_canvas:
        ALFA[naam] = alpha[::MONSTER, ::MONSTER].astype(np.float32)
        VOL_ALFA[naam] = alpha.astype(np.float32)
    DELEN[naam] = {
        # Plek in de referentie, als fractie van het kaartvak: dát is wat de
        # layout nodig heeft.
        "doos": [
            round((x0 - RX0) / RW, 4),
            round((y0 - RY0) / RH, 4),
            round((x1 - x0) / RW, 4),
            round((y1 - y0) / RH, 4),
        ],
        "pixels": [x0, y0, x1 - x0, y1 - y0],
        # Gemiddelde alfa binnen de uitsnede, en het aandeel pixels dat echt
        # dekkend is. Een onderdeel dat leeg is gekeyd valt hier meteen op.
        "alfa": round(float(uitsnede.mean()), 4),
        "dekking": round(float((uitsnede >= 0.5).mean()), 4),
        "kB": kB,
    }


def meet_overlap() -> None:
    """Hoeveel van elk onderdeel valt óók onder een ander onderdeel.

    Genormaliseerd op de kleinste van de twee, zodat een klein onderdeel dat
    volledig in een groot onderdeel zit op 1,0 uitkomt in plaats van te
    verdrinken in het oppervlak van de grote. Dat is precies het geval dat een
    spookkopie oplevert."""
    for naam in DELEN:
        alfa = ALFA.get(naam)
        if alfa is None:
            # Geweven tegel: staat niet op het canvas, dus niets om mee te vergelijken.
            DELEN[naam]["overlap"] = {}
            continue
        massa = float(alfa.sum())
        overlap: dict[str, float] = {}
        for ander, alfa_ander in ALFA.items():
            if ander == naam:
                continue
            deel = float(np.minimum(alfa, alfa_ander).sum())
            noemer = min(massa, float(alfa_ander.sum())) or 1.0
            waarde = round(deel / noemer, 4)
            # Randjes van een paar procent horen erbij: schuim loopt over de
            # lijst en water over het onderschild. Alleen echte dubbelingen
            # zijn het noteren waard.
            if waarde >= 0.02:
                overlap[ander] = waarde
        DELEN[naam]["overlap"] = dict(sorted(overlap.items()))


def snijd(
    naam: str,
    punten,
    sleutel: str = "vast",
    feather: float = 2.0,
    drempel: float = 12.0,
    spreiding: float = 26.0,
    versterk: float = 1.0,
    inhoudvrij: bool = True,
    zacht: float = 0.8,
    korrel: int = 2,
    vrij_vanaf_x: float | None = None,
    silhouet: float = 0.42,
    halo: int = 6,
    aanhechting: float = 0.55,
    licht_aanhechting: bool = False,
    vul: float = 0.08,
    forceer: tuple = (),
    zonder=(),
) -> None:
    """Snijdt één onderdeel vrij, bijgesneden op zijn eigen alfa.

    `vul` is de maat van vul_gaten: het schuim ín de sopemmer is een groot,
    licht binnengat (geen van beide voorwerpsleutels pakt het) en valt met de
    standaard 8% buiten de vulling — dan kijk je op de kaart dwars door de
    emmer heen.

    `licht_aanhechting` poort het aangehechte materiaal op helderheid: schuim
    en druppels zijn licht, maar de afwijkingssleutel is tekenloos en nam ook
    donkere raildelen mee die binnen de contour vielen — de halfdoorzichtige
    brokstukken die om de trekker hingen.

    `forceer` is een reeks (punten, krimp): contouren die hoe dan ook dekkend
    meegaan, een aantal pixels naar binnen geërodeerd. Voor massieve delen die
    over een donkere ondergrond lopen (het trekkerblad over de linkerrail)
    faalt elke lokale sleutel — het silhouet ís daar het antwoord."""
    contour = BRON.contour(punten, feather)
    if sleutel == "zwart":
        alpha = np.clip((BRON.luma - 8.0) / 42.0, 0, 1) * contour
    else:
        ruw = np.clip((BRON.afwijking - drempel) / spreiding, 0, 1)
        if sleutel == "vast":
            # Het silhouet van het voorwerp zelf, uit de voorwerpsleutel: donker
            # of verzadigd tegenover de omgeving. De contour bakent alleen af
            # wáár gezocht wordt; hij is niet zelf het masker.
            kern = (contour > 0.5) & (BRON.voorwerp > silhouet)
            kern = vul_gaten(ontkorrel(kern, korrel), maxdeel=vul)
            # Aangehecht schuim en water: dat hangt áán het voorwerp en hoort
            # erbij, maar alleen vlak ertegenaan. Zonder die begrenzing komt de
            # halve glaswand mee, want die is net zo getextureerd.
            nabij = dilate(kern, halo)
            hecht = ruw * nabij * aanhechting
            if licht_aanhechting:
                hecht *= np.clip((BRON.luma - 150.0) / 60.0, 0, 1)
            alpha = np.maximum(vervaag(kern.astype(np.float32), zacht), hecht)
            alpha = alpha * np.clip(contour * 1.6, 0, 1)
        else:
            alpha = ruw * contour
    for fpunten, krimp in forceer:
        vast = erode(BRON.contour(fpunten, 0.0) > 0.5, krimp)
        alpha = np.maximum(alpha, vervaag(vast.astype(np.float32), 1.2))
    alpha = np.clip(alpha * versterk, 0, 1)
    if inhoudvrij:
        vrij = BRON.vrij
        if vrij_vanaf_x is not None:
            # De inhoudrechthoeken zijn ruim: die van het statblok loopt tot
            # x 914, terwijl de tekst erin op x 897 ophoudt en de emmer op 900
            # begint. Zo'n rechthoek knipt dan puur het voorwerp en geen letter.
            # Rechts van deze grens staat geen kaarttekst meer, dus daar hoeft
            # niets beschermd te worden.
            vrij = vrij.copy()
            vrij[:, int(vrij_vanaf_x):] = 1.0
        alpha *= vrij
    # Onderdelen die als eigen asset terugkomen horen niet ook in deze uitsnede:
    # anders staat er een tweede, verschoven exemplaar op de kaart zodra de twee
    # los worden geplaatst.
    for ander in zonder:
        alpha *= 1.0 - BRON.contour(ander, 6.0)

    ys, xs = np.where(alpha > 0.02)
    if len(xs) == 0:
        raise SystemExit(f"{naam}: niets overgebleven")
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1

    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = np.clip(BRON.rgb[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha[y0:y1, x0:x1] * 255, 0, 255).astype(np.uint8)
    beeld = Image.fromarray(rgba, "RGBA")
    pad = UIT / f"gw-{naam}.webp"
    beeld.save(pad, "WEBP", quality=KWALITEIT, method=6)
    bewaar(naam, alpha, x0, y0, x1, y1, pad.stat().st_size // 1024)


def schoon_glas() -> np.ndarray:
    """Waar staat in de referentie onbedekt nat glas?

    Niet onder een voorwerp, niet onder de ingebakken kaarttekst, en ruim binnen
    de glasrand. Dat blijkt weinig: de compositie van de referentie is dicht, er
    is nog geen 27.000 px schoon glas over. Te weinig om één vlak uit te snijden,
    genoeg om een tegel uit te weven."""
    vrij = BRON.vrij.copy()
    for punten in (CREST, TREKKER_BOVEN, OPHANGING, EMMER, ONDERSCHILD,
                   WATER_ONDER, DRUPPELS_LINKS, DRUPPELS_RECHTS,
                   SCHUIM_BOVEN_LINKS, SCHUIM_BOVEN_RECHTS):
        vrij *= 1.0 - BRON.contour(punten, 10.0)
    binnen = erode(BRON.contour(GLAS_BINNEN, 0.0) > 0.5, 12)
    return (vrij > 0.92) & binnen


def natglas(overlap: int = 24) -> None:
    """De natte glaswand als naadloze tegel.

    Waarom een tegel en niet één uitsnede zoals de andere onderdelen: de
    referentie heeft de kaarttekst ingebakken, dus de textuur ónder rating, naam
    en statistieken bestaat niet en is ook niet terug te halen — een lagere
    drempel haalt daar de tekst zelf naar boven. Eén vlak uitsnijden leverde
    daarom een vrijwel lege laag op (alfa 0,007) die vervolgens ook nog eens over
    een hogere kaart werd uitgerekt.

    Er is precies één stuk schoon glas van formaat in de referentie: 92 × 160 px,
    links onder de avatarcirkel. Dat wordt de tegel. Naadloos gemaakt met een
    overvloeier: de tegel wordt een overlapbreedte kleiner gesneden en de
    weggevallen rand wordt over de andere rand gemengd, zodat links op rechts
    aansluit en boven op onder. Dat kost alleen contrast in die smalle rand —
    anders dan spiegelen, dat een zichtbaar vlindermotief oplevert, en anders dan
    blokjes middelen, want het gemiddelde van willekeurige textuur is een egale
    vlakte.

    De alfa komt uit de tegel zelf: wat lokaal afwijkt van zijn eigen vervaging
    is streep, condens of druppel; het gladde verloop eronder levert de kaart.
    """
    bx, by, bw, bh = 427, 393, 92, 160
    if not schoon_glas()[by:by + bh, bx:bx + bw].all():
        raise SystemExit("glastegel: het bronvlak is niet schoon")
    bron = BRON.rgb[by:by + bh, bx:bx + bw].astype(np.float32)

    tw, th = bw - overlap, bh - overlap
    tegel = bron[:th, :tw].copy()
    helling = np.linspace(0.0, 1.0, overlap, dtype=np.float32)
    # Linkerrand mengen met wat er rechts wegviel, bovenrand met wat er onder
    # wegviel: daarmee loopt de tegel in zichzelf door.
    tegel[:, :overlap] = (
        tegel[:, :overlap] * helling[None, :, None]
        + bron[:th, tw:tw + overlap] * (1.0 - helling)[None, :, None]
    )
    tegel[:overlap, :] = (
        tegel[:overlap, :] * helling[:, None, None]
        + bron[th:th + overlap, :tw] * (1.0 - helling)[:, None, None]
    )

    # Vervagen met de tegel rondom zichzelf gelegd, zodat ook de alfa naadloos is.
    grof = np.stack(
        [
            vervaag(np.tile(tegel[..., k], (3, 3)) / 255.0, 7.0)[
                th:2 * th, tw:2 * tw
            ] * 255.0
            for k in range(3)
        ],
        axis=-1,
    )
    detail = np.abs(tegel - grof).mean(-1)
    alpha = np.clip((detail - 1.2) / 9.0, 0, 1) * 0.9

    rgba = np.zeros((th, tw, 4), np.uint8)
    rgba[..., :3] = np.clip(tegel, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    pad = UIT / "gw-glas.webp"
    Image.fromarray(rgba, "RGBA").save(pad, "WEBP", quality=96, method=6)
    bewaar("glas", alpha, 0, 0, tw, th, pad.stat().st_size // 1024,
           op_canvas=False)
    # Een tegel heeft geen plek in de referentie; een doos zou betekenisloos zijn.
    DELEN["glas"]["doos"] = [0.0, 0.0, 1.0, 1.0]
    DELEN["glas"]["tegel"] = True


def inpaint_verticaal(rgb: np.ndarray, bekend: np.ndarray,
                      zacht: float = 2.5) -> np.ndarray:
    """Vult onbekende plekken per kolom, uit wat er boven en onder staat.

    De gaten van de weggeknipte voorwerpen liggen grotendeels op de rails, en
    een rail is een verticale extrusie: de dichtstbijzijnde-buur-vulling van
    `inpaint` pakte zijwaarts het bleke glas en smeerde dat over de lijst —
    de witte veeg naast de emmer. Boven-onder mengen naar afstand zet de rail
    (en de verticale glasstrepen) gewoon door."""
    h, w = bekend.shape
    rijen = np.arange(h)[:, None].repeat(w, 1)
    boven_i = np.where(bekend, rijen, -1)
    boven_i = np.maximum.accumulate(boven_i, axis=0)
    onder_i = np.where(bekend, rijen, 2 * h)
    onder_i = np.minimum.accumulate(onder_i[::-1], axis=0)[::-1]
    kol = np.arange(w)[None, :].repeat(h, 0)
    b_ok, o_ok = boven_i >= 0, onder_i < h
    b_i = np.clip(boven_i, 0, h - 1)
    o_i = np.clip(onder_i, 0, h - 1)
    d_b = np.abs(rijen - b_i).astype(np.float32)
    d_o = np.abs(o_i - rijen).astype(np.float32)
    # Gewicht naar afstand; een kant zonder bekende pixel telt niet mee.
    w_b = np.where(b_ok, 1.0 / (d_b + 1.0), 0.0)
    w_o = np.where(o_ok, 1.0 / (d_o + 1.0), 0.0)
    som = np.maximum(w_b + w_o, 1e-6)
    vul = (
        rgb[b_i, kol] * (w_b / som)[..., None]
        + rgb[o_i, kol] * (w_o / som)[..., None]
    )
    week = np.stack(
        [vervaag(vul[..., k] / 255.0, zacht) * 255.0 for k in range(3)], -1
    )
    return np.where(bekend[..., None], rgb, week)


def inpaint(rgb: np.ndarray, bekend: np.ndarray, zacht: float = 40.0) -> np.ndarray:
    """Vult onbekende plekken met de dichtstbijzijnde omgeving, ruim uitgesmeerd.

    Er is ook een diffusievariant geprobeerd (herhaald vervagen met de bekende
    pixels er elke ronde weer in), die aan de rand van het gat theoretisch beter
    aansluit. In de praktijk gaf die juist zichtbare wolken in het glasvlak,
    terwijl deze eenvoudige vulling er vlak blijft — en vlak is hier wat telt,
    want er komt kaarttekst overheen en de korrel komt van de glastegel."""
    idx = ndimage.distance_transform_edt(
        ~bekend, return_distances=False, return_indices=True
    )
    gevuld = rgb[idx[0], idx[1]]
    week = np.stack(
        [vervaag(gevuld[..., k] / 255.0, zacht) * 255.0 for k in range(3)], -1
    )
    return np.where(bekend[..., None], rgb, week)


# Uiterste van de ring in kaartfracties: ruim om de kaart heen, zodat het ijs dat
# over de bovenrand hangt en het water dat langs de flanken naar buiten spat
# meekomen in plaats van op een rechthoek te worden afgesneden.
RING_X0, RING_X1 = -0.05, 1.05
# Onder de kaart staat in de referentie het infoblok (titel, ratingbereik,
# flavor). Gemeten begint dat op fractie 1,025; de waterexplosie is op 1,016 al
# afgelopen. Ondergrens dus op 1,02: één pixel lager en de ingebakken titel
# "Glazenwasser" komt mee in de ring, en dan staat hij op de kaart dubbel naast
# het echte infoblok.
RING_Y0, RING_Y1 = -0.14, 1.02


def _naar_kaart_y(y: float) -> float:
    """Zelfde stuksgewijze afbeelding als `naarKaartY` in glazenwasserLayout.ts."""
    krimp = (1114.0 / 975.0) / (139.0 / 100.0)
    boven, onder = y * krimp, 1.0 - (1.0 - y) * krimp
    sm = lambda t: t * t * (3.0 - 2.0 * t)
    kl = lambda t: min(1.0, max(0.0, t))
    if y < 0.2:
        return boven + (y - boven) * sm(kl((y - 0.1) / 0.1))
    if y > 0.7:
        return y + (onder - y) * sm(kl((y - 0.7) / 0.1))
    return y


def kaartring() -> None:
    """De hele omlijsting als één illustratie.

    Dit vervangt de losse lagen voor schuim, flankdruppels en onderwater én de
    in CSS nagebouwde lijst. Reden: op de referentie zíjn dat geen aparte dingen.
    Het ijs ligt óp de rail, het water loopt van de bovenhoek langs de flank naar
    de plas onderin, en de condens zit op hetzelfde glas. Knip je dat in stukken
    en zet je er een met verlopen gebouwde lijst onder, dan is elke overgang een
    naad en leest het geheel als plaatjes op een kaart. In één stuk is er niets
    om naadloos te maken.

    Sinds de herbouw blijven ook de massieve voorwerpen erin: elke uitsnede
    was een naad (gat + vulling + losse plaatsing + nagebouwde schaduw), en in
    de referentiepixels klopt de montage al. Het rek dat de uitsnedes ooit
    rechtvaardigde — de kaart is hoger dan de referentie, dus de ring rekt
    verticaal 1,22× — wordt in de herbemonstering opgelost met
    aspect-behoudende kolombanden over trekker en emmer.
    """
    luma = BRON.luma
    # Silhouet: buiten de kaart is de referentie zwart. Binnenin worden donkere
    # plekken (de diepe kant van de rail) opgevuld, anders wordt de lijst daar
    # halftransparant — en dan schemert de donkere onderlegger er als blauwe
    # waas doorheen. Binnen het silhouet is de alfa dus vol; alleen de spray die
    # buiten de kaart op zwart staat houdt een zachte alfa.
    # Drempel ruim boven de achtergrond. Buiten de kaart ligt de referentie op
    # lum 11–25, dus op een drempel van 14 werd een deel van die achtergrond als
    # massieve kaart gekeyd — dat gaf de rafelige donkere rand die aan de lijst
    # plakte. De donkere kant van de lijst zelf ligt hier wel onder, maar die is
    # ingesloten en wordt door `vul_gaten` alsnog dichtgezet.
    kern = luma > 46.0
    kern = vul_gaten(ontkorrel(kern, 2), maxdeel=10.0)
    binnen_sil = vervaag(kern.astype(np.float32), 1.0)
    # Drempel ruim boven de achtergrond. Buiten de kaart is de referentie niet
    # zwart maar een donkere gloed (lum 11–25); op de oude drempel kreeg die
    # alfa 0,3–0,6 en hing er dus een halftransparante donkere waas om de kaart,
    # die op de app-achtergrond duidelijk zichtbaar werd. Alleen echt licht
    # materiaal — ijs en opspattend water — hoort hier nog te keyen.
    spray = np.clip((luma - 40.0) / 50.0, 0, 1)
    alpha = np.clip(binnen_sil + spray * (1.0 - binnen_sil), 0, 1)

    # De crest blijft in de ring. In de bovenzone is de verticale afbeelding een
    # zuivere schaal (y·KRIMP·1,39 = y·1,1426), dus daar rekt niets: een los
    # onderdeel was er nooit nodig. In de ring hoort hij bij de lijst zoals op de
    # referentie — geen eigen alfarand, geen losse slagschaduw, en de rail loopt
    # er in één stuk omheen de inkeping in.
    crest_metaal = BRON.contour(CREST, 6.0) * (luma > 55.0)

    # Sinds de herbouw (referentie = enige waarheid) blijven álle voorwerpen in
    # de ring gebakken: trekker, ophanging, emmer en onderschild worden niet
    # meer uitgesneden en teruggeplakt. Elke knip was een naad — een gat dat
    # gevuld moest worden, een voorwerp dat los op de kaart kwam te staan, een
    # contactschaduw die nagebouwd moest worden. In de referentiepixels zelf
    # klopt dat allemaal al. Het rek-probleem dat de uitsnedes ooit
    # rechtvaardigde wordt nu in de herbemonstering opgelost: de flankzones met
    # een massief voorwerp krijgen een aspect-behoudende verticale afbeelding
    # (zie de banden hieronder).

    # De ingebakken kaarttekst. De poort is het glaspaneel zónder erosie en
    # zónder blur: de eerdere, naar binnen geërodeerde poort liet tekst vlak
    # langs de rand (de laatste E van CONCENTRATIE naast de emmer) buiten
    # schot, en een zachte poort lekte de tekstzone tot óver de glasrand — dat
    # sloeg een gat in de rail en de waterhuid naast de emmer, met een harde
    # streep als onderrand.
    kern_glas = BRON.contour(GLAS_BINNEN, 0.0) > 0.5
    binnen = kern_glas.astype(np.float32)
    tekst = np.zeros_like(luma)
    for (x0, y0, x1, y1) in INHOUD:
        blok = np.zeros_like(luma)
        blok[max(0, y0 - 8):y1 + 8, max(0, x0 - 8):x1 + 8] = 1.0
        tekst = np.maximum(tekst, vervaag(blok, 16.0))
    tekst = tekst * binnen * (1.0 - crest_metaal)

    onbekend = tekst > 0.35
    # Verticaal gevuld: de gaten liggen op rails en gestreept glas, allebei
    # verticale structuren — zijwaarts vullen smeerde glas over de lijst.
    laag = inpaint_verticaal(BRON.rgb, ~onbekend)
    tegel = np.asarray(
        Image.open(UIT / "gw-glas.webp").convert("RGB")
    ).astype(np.float32)
    th, tw = tegel.shape[:2]
    herhaald = np.tile(
        tegel,
        (BRON.h // th + 2, BRON.w // tw + 2, 1),
    )[:BRON.h, :BRON.w]
    fijn = herhaald - np.stack(
        [vervaag(herhaald[..., k] / 255.0, 9.0) * 255.0 for k in range(3)], -1
    )
    rgb = np.where(onbekend[..., None], laag + fijn * 1.15, BRON.rgb)

    # Randkleur terugrekenen. De referentie staat op bijna zwart, dus elke
    # halfdoorzichtige randpixel is een menging van kaart én die zwarte
    # achtergrond. Composite je hem daarna op een andere ondergrond, dan blijft
    # dat zwart als donkere zoom zichtbaar. Delen door de alfa haalt de
    # achtergrondbijdrage eruit en geeft de kleur die de kaart daar écht heeft.
    veilig = np.maximum(alpha, 0.06)[..., None]
    rgb = np.where(
        (alpha > 0.02)[..., None], np.clip(rgb / veilig, 0, 255), rgb
    )

    # Het kale glasinterieur gaat uit de ring; het glas komt uit `glasvlak()`
    # (schoon, zonder ingebakken tekst). Wat binnen de glascontour wél blijft
    # staan is alles wat op de referentie óp het glas ligt:
    #
    # * de waterexplosie — haar bogen spatten tot diep over het glas;
    # * de voorwerpen mét hun directe omgeving (contactschaduw, sopstrepen,
    #   druppels): de contourzones houden de referentiepixels vast, zodat elk
    #   voorwerp gemonteerd blijft zoals de referentie hem monteert.
    #
    # De tekstzones worden uit die uitzonderingen weggehouden: waar de
    # ingebakken statregel onder de watercontour of naast de emmer doorloopt,
    # wint de snede — geen spookletters.
    # Krappe marge: de contouren volgen de silhouetten al; een ruime feather
    # sleepte een plaat referentieglas mee die als bleek vlak op het
    # samengestelde glas lag (en de S van STREEPEN afdekte via de voorstrip).
    voorwerpen = np.zeros_like(luma)
    for punten in (TREKKER_BOVEN, OPHANGING, EMMER,
                   ONDERSCHILD, TREKKER_ONDER, BADGE):
        voorwerpen = np.maximum(voorwerpen, BRON.contour(punten, 5.0))
    houd = np.clip(BRON.contour(WATER_ONDER, 10.0) + voorwerpen, 0, 1)
    houd = houd * (1.0 - vervaag((tekst > 0.35).astype(np.float32), 3.0))
    binnenvlak = vervaag(kern_glas.astype(np.float32), 4.0) * (1.0 - houd)
    alpha = alpha * (1.0 - np.clip(binnenvlak, 0.0, 1.0))

    # Verticaal herbemonsteren met dezelfde stuksgewijze afbeelding die de
    # layout gebruikt: de kap en de punt houden hun maat, het middenveld rekt
    # mee. In dat middenveld hangen wél twee massieve voorwerpen aan de
    # flanken (trekker en emmer): die kolombanden krijgen een eigen afbeelding
    # met een aspect-behoudende helling over de hoogte van het voorwerp — het
    # rek gaat naar het glas en de rail erboven en eronder, waar het als
    # extrusie onzichtbaar is. De banden mengen horizontaal zacht in de
    # globale afbeelding; rails zijn verticaal, dus die menging verschuift
    # alleen, hij buigt niets om.
    breedte = int(round((RING_X1 - RING_X0) * RW))
    ky0, ky1 = _naar_kaart_y(RING_Y0), _naar_kaart_y(RING_Y1)
    hoogte = int(round((ky1 - ky0) * RW * (139.0 / 100.0)))
    ref = np.linspace(-0.4, 1.4, 6000)
    kaart_glob = np.array([_naar_kaart_y(float(v)) for v in ref])
    kaartrijen = ky0 + (np.arange(hoogte) + 0.5) / hoogte * (ky1 - ky0)
    rij_glob = np.interp(kaartrijen, kaart_glob, ref)
    kol_x = RX0 + (RING_X0 + (np.arange(breedte) + 0.5) / breedte
                   * (RING_X1 - RING_X0)) * RW
    kol_frac = (kol_x - RX0) / RW

    krimp_c = (1114.0 / 975.0) / (139.0 / 100.0)

    def band_inverse(y0: float, y1: float, anker: str) -> np.ndarray:
        """Inverse afbeelding voor één kolomband.

        Buiten [0,15 .. 0,85] is de band exact de globale afbeelding: de kap,
        de schouders, de punt en de waterrand liggen vast, dus aan de
        bandgrenzen kan daar niets verspringen. Binnen dat venster krijgt het
        voorwerp [y0, y1] de aspect-behoudende helling `krimp_c`; het rek gaat
        naar het glas ertussen. `anker` bepaalt waar het voorwerp aan
        vastzit: 'onder' voor de emmer (die tot in de onderzone doorloopt,
        waar de helling al krimp_c ís), 'midden' voor de trekker."""
        A0, A1 = 0.15, 0.85
        g0, g1 = _naar_kaart_y(A0), _naar_kaart_y(A1)
        k0, k1 = max(y0, A0), min(y1, A1)
        if anker == "onder":
            f1 = g1 - (A1 - k1) * krimp_c
            f0 = f1 - (k1 - k0) * krimp_c
        else:
            c = (k0 + k1) / 2.0
            fc = _naar_kaart_y(c)
            f0 = fc - (c - k0) * krimp_c
            f1 = fc + (k1 - c) * krimp_c
        f = np.array([_naar_kaart_y(float(v)) for v in ref])
        m = (ref >= A0) & (ref <= A1)
        f[m] = np.interp(ref[m], [A0, k0, k1, A1], [g0, f0, f1, g1])
        return np.interp(kaartrijen, f, ref)

    # Banden in referentiefracties: (x0, x1, y0, y1, anker) — de y-span is het
    # massieve deel van het voorwerp; kettingen en druppels mogen rekken.
    BANDEN = (
        # Trekker: blad, kop en steel.
        (-0.04, 0.365, 0.343, 0.705, "midden"),
        # Emmer: romp met beugel; de ophangketting erboven is verticaal.
        (0.745, 1.005, 0.576, 0.913, "onder"),
    )
    rij_2d = np.repeat(rij_glob[:, None], breedte, axis=1)
    for bx0, bx1, by0, by1, anker in BANDEN:
        w = np.clip(
            (np.minimum(kol_frac - bx0, bx1 - kol_frac)) / 0.05, 0, 1
        ).astype(np.float32)
        rij_band = band_inverse(by0, by1, anker)
        rij_2d = rij_2d * (1 - w)[None, :] + rij_band[:, None] * w[None, :]

    bron_y2 = np.clip(RY0 + rij_2d * RH, 0, BRON.h - 1.001)
    bron_x2 = np.clip(kol_x, 0, BRON.w - 1.001)

    def bemonster(vlak: np.ndarray) -> np.ndarray:
        y0i = bron_y2.astype(int)
        x0i = bron_x2.astype(int)[None, :].repeat(hoogte, 0)
        fy = bron_y2 - y0i
        fx = (bron_x2 - bron_x2.astype(int))[None, :]
        a = vlak[y0i, x0i]
        b = vlak[np.minimum(y0i + 1, vlak.shape[0] - 1), x0i]
        c = vlak[y0i, np.minimum(x0i + 1, vlak.shape[1] - 1)]
        d = vlak[np.minimum(y0i + 1, vlak.shape[0] - 1),
                 np.minimum(x0i + 1, vlak.shape[1] - 1)]
        return (a * (1 - fy) * (1 - fx) + b * fy * (1 - fx)
                + c * (1 - fy) * fx + d * fy * fx)

    rgba = np.zeros((hoogte, breedte, 4), np.uint8)
    for k in range(3):
        rgba[..., k] = np.clip(bemonster(rgb[..., k]), 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(bemonster(alpha) * 255, 0, 255).astype(np.uint8)
    pad = UIT / "gw-ring.webp"
    # Kwaliteit 82 en niet hoger: de ring is met afstand de zwaarste asset van de
    # app en op 94 ging het bundelbudget in `assetBudget.test.ts` eroverheen.
    # Gemeten tegenover 94 is dit 40 dB PSNR — voor fotografisch materiaal geen
    # zichtbaar verschil, wel 195 kB minder.
    Image.fromarray(rgba, "RGBA").save(pad, "WEBP", quality=82, method=6)

    DELEN["ring"] = {
        # Al in kaartfracties: de ring is al door de verticale afbeelding heen,
        # dus de layout mag hem niet nóg een keer verschuiven.
        "doos": [RING_X0, ky0, RING_X1 - RING_X0, ky1 - ky0],
        "pixels": [0, 0, breedte, hoogte],
        "alfa": round(float((rgba[..., 3] / 255).mean()), 4),
        "dekking": round(float((rgba[..., 3] >= 128).mean()), 4),
        "kB": pad.stat().st_size // 1024,
        "overlap": {},
        "voorbewerkt": True,
    }

    # Voorstrips: op de brede kaart staat de kaartinhoud (z 50) bóven de ring
    # (z 40), maar trekker, emmer en ondergroep horen vóór de tekst — de
    # referentie laat de emmer over de statkolom hangen. Die drie zones worden
    # als strips uit exact dit doek gesneden en op z 70/100 nóg een keer
    # geplaatst: dezelfde pixels op dezelfde plek, dus per constructie naadloos.
    def strip(naam: str, fx0: float, fx1: float, ry0: float, ry1: float,
              z_zone: tuple[float, float] | None = None) -> None:
        x0o = int((fx0 - RING_X0) / (RING_X1 - RING_X0) * breedte)
        x1o = int((fx1 - RING_X0) / (RING_X1 - RING_X0) * breedte)
        xc = (x0o + x1o) // 2
        kol = rij_2d[:, min(max(xc, 0), breedte - 1)]
        y0o = int(np.searchsorted(kol, ry0))
        y1o = int(np.searchsorted(kol, ry1))
        uitsnede = rgba[y0o:y1o, x0o:x1o]
        pad_s = UIT / f"gw-strip-{naam}.webp"
        Image.fromarray(uitsnede, "RGBA").save(pad_s, "WEBP", quality=82,
                                               method=6)
        DELEN[f"strip-{naam}"] = {
            "doos": [
                round(RING_X0 + x0o / breedte * (RING_X1 - RING_X0), 4),
                round(ky0 + y0o / hoogte * (ky1 - ky0), 4),
                round((x1o - x0o) / breedte * (RING_X1 - RING_X0), 4),
                round((y1o - y0o) / hoogte * (ky1 - ky0), 4),
            ],
            "pixels": [x0o, y0o, x1o - x0o, y1o - y0o],
            "alfa": round(float((uitsnede[..., 3] / 255).mean()), 4),
            "dekking": round(float((uitsnede[..., 3] >= 128).mean()), 4),
            "kB": pad_s.stat().st_size // 1024,
            "overlap": {},
            "voorbewerkt": True,
        }

    # Zones in referentiefracties (x) en -fracties (y, vóór de afbeelding).
    # Krap rond de voorwerpen: elke rij te veel draagt óók het glas-sliver
    # tussen lijst en glascontour mee, en dat hoort onder de kaartinhoud —
    # de trekker-strip tot 0,72 dekte de S van STREEPEN af.
    strip("trekker", -0.045, 0.375, 0.335, 0.655)
    strip("emmer", 0.745, 1.01, 0.15, 0.95)
    strip("ondergroep", 0.28, 0.685, 0.76, 1.02)


# Doek en kaartvak van de compacte master, exact zoals GlazenwasserEffect.css ze
# registreert (--glazenwasser-master-left/-top/-width). Het kaartvak erin is
# 880 × 1223 px, oftewel dezelfde 100:139 als het stelsel van de ring.
MASTER_DOEK = (1024, 1440)
MASTER_VAK = (72, 160, 880, 1223)

# Sinds de herbouw zitten alle voorwerpen ín de ring gebakken (zie
# kaartring()): er is geen aparte weergavetabel meer — wat de referentie
# monteert, staat gemonteerd.


def glasvlak() -> None:
    """Het volledige natte glasvlak van de kaart, zonder spoken (#briefing).

    Waarom niet gewoon het glas van de referentie uitsnijden: daar staat de
    kaartinhoud in gebakken, en elke poging het gat te vullen liet bleke wolken
    en donkere schimmen achter — de "faded / washed out"-vlekken. Dit vlak wordt
    daarom *samengesteld* uit uitsluitend schone stukken referentieglas:

    * het toonveld (de lage frequenties: toon, belichting, het donker weglopen
      naar de randen) komt uit het échte glas, met alle inhoud- en
      voorwerpzones weggelaten en de gaten breed gevuld;
    * de condens en de druppels zijn honderden echte detail-patches uit het
      schone glas, met een venster gestrooid zodat er nergens een naad of een
      herhaalritme ontstaat — het behang-effect van de kleine tegel;
    * de waterstrepen zijn getrokken, niet gesampled: lange verticale banen met
      een lichte kern en een donkere zoom, dichter aan de flanken en bovenaan,
      precies zoals de referentie ze toont. De vaste seed houdt de uitkomst
      reproduceerbaar.

    Het vlak is dekkend: het ís het glas, geen waas erover. De kaart klemt het
    onder de ring en de voorwerpen, dus alles wat hier middenin staat blijft
    onder de echte tekstlaag."""
    W, H = 880, 1223
    rng = np.random.default_rng(834)

    # -- toonveld ------------------------------------------------------------
    schoon = schoon_glas()
    toon = inpaint(BRON.rgb, schoon, zacht=36.0)
    # Breed genoeg vervaagd dat de vulzones (avatarcirkel, statblok) geen
    # herkenbare wolk achterlaten — op 28 tekende de cirkel zich nog af.
    toon = np.stack(
        [vervaag(toon[..., k] / 255.0, 42.0) * 255.0 for k in range(3)], -1
    )

    # Kaartraster → referentieraster, met dezelfde stuksgewijze verticale
    # afbeelding als de ring: het toonveld schuift mee met de langere kaart.
    ref = np.linspace(-0.2, 1.2, 4000)
    kaart = np.array([_naar_kaart_y(float(v)) for v in ref])
    vy = np.interp((np.arange(H) + 0.5) / H, kaart, ref)
    bron_y = np.clip(RY0 + vy * RH, 0, BRON.h - 1.001)
    bron_x = np.clip(RX0 + (np.arange(W) + 0.5) / W * RW, 0, BRON.w - 1.001)
    y0i, x0i = bron_y.astype(int), bron_x.astype(int)
    fy = (bron_y - y0i)[:, None, None]
    fx = (bron_x - x0i)[None, :, None]
    veld = (
        toon[np.ix_(y0i, x0i)] * (1 - fy) * (1 - fx)
        + toon[np.ix_(y0i + 1, x0i)] * fy * (1 - fx)
        + toon[np.ix_(y0i, x0i + 1)] * (1 - fy) * fx
        + toon[np.ix_(y0i + 1, x0i + 1)] * fy * fx
    )
    # Iets meer toonverschil dan het vervaagde veld overhoudt: zonder deze
    # uitvergroting rond het gemiddelde leest het vlak als één egale plaat,
    # terwijl de referentie zichtbaar donker wegloopt naar de flanken.
    veld = np.clip(veld.mean((0, 1), keepdims=True)
                   + (veld - veld.mean((0, 1), keepdims=True)) * 1.18, 0, 255)

    # -- condens en druppels: echte patches, gestrooid ------------------------
    detail = BRON.rgb - np.stack(
        [vervaag(BRON.rgb[..., k] / 255.0, 9.0) * 255.0 for k in range(3)], -1
    )

    def patches_van(maat: int, aantal: int) -> list[np.ndarray]:
        ok = erode(schoon, maat // 2 + 2)
        ys, xs = np.where(ok)
        keuze = rng.choice(len(ys), size=min(aantal, len(ys)), replace=False)
        return [
            detail[ys[i] - maat // 2:ys[i] + maat // 2,
                   xs[i] - maat // 2:xs[i] + maat // 2]
            for i in keuze
        ]

    def strooi(doel: np.ndarray, patches: list[np.ndarray], rondes: int,
               schaal: tuple[float, float], sterk: tuple[float, float],
               demp: np.ndarray | None = None) -> None:
        for _ in range(rondes):
            p = patches[int(rng.integers(len(patches)))]
            s = rng.uniform(*schaal)
            m = max(8, int(round(p.shape[0] * s)))
            beeld = Image.fromarray(
                np.clip(p + 128.0, 0, 255).astype(np.uint8)
            ).resize((m, m), Image.LANCZOS)
            stuk = np.asarray(beeld).astype(np.float32) - 128.0
            w = np.hanning(m)[:, None] * np.hanning(m)[None, :]
            x = int(rng.integers(0, W - m))
            y = int(rng.integers(0, H - m))
            kracht = rng.uniform(*sterk)
            if demp is not None:
                kracht *= float(demp[min(y + m // 2, H - 1),
                                     min(x + m // 2, W - 1)])
            doel[y:y + m, x:x + m] += stuk * w[..., None] * kracht

    # Iets rustiger achter naam, divisieregel en statblok — ook de referentie
    # houdt het daar kalmer, en de inkt houdt zo zijn contrast.
    yy = (np.arange(H) + 0.5) / H
    demp_v = 1.0 - 0.3 * np.clip(1.0 - np.abs(yy - 0.585) / 0.21, 0, 1)
    demp = np.repeat(demp_v[:, None], W, axis=1).astype(np.float32)

    # Randzone: waar het glas de lijst nadert. De natte overgang komt sinds de
    # smalle ringband uit dit vlak zelf — condens en druppels verdichten naar
    # de rand toe, en de toon koelt er een fractie af, zodat glas en lijst in
    # elkaar grijpen in plaats van langs elkaar heen te schuiven.
    poly = Image.new("L", (W, H), 0)
    ImageDraw.Draw(poly).polygon(
        [
            ((x - RX0) / RW * W, _naar_kaart_y((y - RY0) / RH) * H)
            for x, y in GLAS_BINNEN
        ],
        fill=255,
    )
    pm = np.asarray(poly) > 127
    rand = vervaag((pm & ~erode(pm, 64)).astype(np.float32), 16.0)
    demp = np.clip(demp * (1.0 + 1.3 * rand), 0, 2.2).astype(np.float32)

    cond = np.zeros((H, W, 3), np.float32)
    strooi(cond, patches_van(44, 26), 900, (0.85, 1.9), (0.7, 1.3), demp)
    # Kleinere, scherpere patches: losse druppels en spetters.
    strooi(cond, patches_van(20, 22), 650, (0.8, 1.7), (1.1, 1.9), demp)
    # Extra druppels in de randzone alleen: op de referentie zitten de dichtste
    # druppels tegen de lijst aan.
    strooi(cond, patches_van(20, 22), 260, (0.7, 1.3), (1.0, 1.7),
           rand.astype(np.float32))
    veld = np.clip(
        veld - (rand * 9.0)[..., None] * np.array([1.0, 0.55, 0.15], np.float32),
        0, 255,
    )

    # -- verticale waterstrepen ----------------------------------------------
    licht = np.zeros((H, W), np.float32)
    donker = np.zeros((H, W), np.float32)

    def streep(xc: float, ytop: float, lengte: float, breed: float,
               sterk: float) -> None:
        yy_ = np.arange(int(max(0, ytop)), int(min(H, ytop + lengte)))
        if len(yy_) == 0:
            return
        slinger = xc + np.cumsum(rng.normal(0.0, 0.06, len(yy_)))
        halve = max(1, int(round(breed))) // 2
        for j, y in enumerate(yy_):
            x = int(round(slinger[j]))
            if 1 + halve <= x < W - halve - 2:
                # Uitlopende staart: een streep eindigt dun, niet abrupt.
                duik = 1.0 - 0.7 * (j / len(yy_)) ** 2
                licht[y, x - halve:x + halve + 1] += sterk * duik
                donker[y, x + halve + 1:x + halve + 2] += sterk * 0.55 * duik

    # Dunne druipsporen: dichter aan de flanken (beta-verdeling met een kuil in
    # het midden) en beginnend in de bovenhelft, zoals op de referentie.
    for _ in range(150):
        streep(rng.beta(0.55, 0.55) * W, rng.uniform(-40, H * 0.45),
               rng.uniform(H * 0.12, H * 0.85), rng.uniform(1, 3),
               rng.uniform(7, 22))
    # Brede, zachte waterlopen daaronder.
    for _ in range(26):
        streep(rng.beta(0.7, 0.7) * W, rng.uniform(-40, H * 0.3),
               rng.uniform(H * 0.3, H * 0.9), rng.uniform(6, 14),
               rng.uniform(3.5, 7.0))
    licht = vervaag(licht / 32.0, 0.8) * 32.0
    donker = vervaag(donker / 32.0, 1.3) * 32.0

    # -- glasdiepte: één zachte diagonale reflectiebaan ------------------------
    xx = (np.arange(W) + 0.5) / W
    baan = np.clip(
        1.0 - np.abs(xx[None, :] * 0.62 - yy[:, None] * 0.44 - 0.08) / 0.11,
        0, 1,
    ).astype(np.float32)
    baan = vervaag(baan, 30.0)

    rgb = (
        veld
        + cond
        + licht[..., None] * np.array([0.9, 1.0, 1.08], np.float32)
        - donker[..., None] * np.array([0.9, 0.8, 0.66], np.float32)
        + (baan * 5.5)[..., None]
    )
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = 255
    pad = UIT / "gw-glasvlak.webp"
    Image.fromarray(rgba, "RGBA").save(pad, "WEBP", quality=80, method=6)
    DELEN["glasvlak"] = {
        # Samengesteld op kaartmaat: de doos is de hele kaart, en de
        # uitsnedecontroles gelden er niet voor (zie glazenwasserAssets.test.ts).
        "doos": [0.0, 0.0, 1.0, 1.0],
        "pixels": [0, 0, W, H],
        "alfa": 1.0,
        "dekking": 1.0,
        "kB": pad.stat().st_size // 1024,
        "voorbewerkt": True,
    }


def compacte_master() -> None:
    """Bouwt glazenwasser-master.webp uit de ring en de losse voorwerpen.

    De brede `GlazenwasserKaart` staat alleen op de dev-route; wat spelers in de
    app zien is `FutKaart` met dit master-artwork. Zolang die master uit het oude
    `glazenwasser-master.py` kwam, zag niemand het nieuwe werk. Door hem uit
    dezelfde ring en dezelfde voorwerpen op te bouwen krijgt élke plek waar een
    platina-kaart staat het nieuwe artwork, zónder dat er één aanroeper verandert
    — de flip naar de statistieken, de overlays en de editie-skins blijven van
    FutKaart.

    Het kaartvak in dit doek heeft dezelfde verhouding als de kaart zelf, dus de
    lagen worden hier één op één ingezet: geen tweede afbeelding, geen rek.

    Sinds de referentiepass draagt de master ook het glas zelf: het interieur
    was leeg omdat het voormasker als alfamasker overal dekkend was (zwart is
    net zo ondoorzichtig als wit) en de `voor`-laag dus de héle master over
    rating en naam legde. Dat masker komt nu uit dit script, mét een echt
    transparant gat boven het glas — de `voor`-laag toont alleen lijst, band en
    voorwerpen, en de `binnen`-laag (onder de tekst) mag het volle natte glas
    laten zien. Zo leest de klassement-kaart eindelijk als de referentie in
    plaats van als een leeg platina-vlak met een natte rand."""
    vx, vy, vw, vh = MASTER_VAK

    # Ring + voorwerpen eerst op een eigen doek: dat is precies wat er bóven
    # het glas ligt, en dus ook precies wat de voor-laag mag tonen. Het
    # voormasker wordt uit deze alfa afgeleid in plaats van uit ruime
    # handcontouren — binnen zo'n contour zou anders ook het (dekkende) glas
    # vóór de kaartinhoud komen.
    boven = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))

    def plaats(pad: Path, vak: tuple[float, float, float, float],
               masker: np.ndarray | None = None) -> None:
        left, top, breedte, hoogte = vak
        b = max(1, int(round(breedte * vw)))
        h = max(1, int(round(hoogte * vh)))
        laag = Image.open(pad).convert("RGBA").resize((b, h), Image.LANCZOS)
        px, py = int(round(vx + left * vw)), int(round(vy + top * vh))
        if masker is None:
            boven.alpha_composite(laag, (px, py))
            return
        # Masker op doekmaat: eerst op een eigen doek zetten (PIL knipt de
        # overloop), dan de doek-alfa vermenigvuldigen.
        tdoek = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
        tdoek.alpha_composite(laag, (max(0, px), max(0, py)))
        a = np.asarray(tdoek.split()[3]).astype(np.float32) * masker
        tdoek.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
        boven.alpha_composite(tdoek)

    def master_poly(reeks) -> np.ndarray:
        beeld = Image.new("L", MASTER_DOEK, 0)
        ImageDraw.Draw(beeld).polygon(
            [
                (vx + (x - RX0) / RW * vw,
                 vy + _naar_kaart_y((y - RY0) / RH) * vh)
                for x, y in reeks
            ],
            fill=255,
        )
        return np.asarray(beeld) > 127

    # De ring — met alle voorwerpen erin gebakken — komt hier met de
    # leesbaarheidssnede van de compacte kaart: binnen de glascontour alleen
    # wat op het glas ligt, en de waterexplosie alleen ónder 80% kaarthoogte.
    # Boven die lijn spatten de bogen op de brede kaart vol over het glas —
    # maar hier tekent FutKaart daar zijn divisieregel, en op 0,72 was
    # "GLAZENWASSER" al eens onleesbaar.
    pm = master_poly(GLAS_BINNEN)
    snede = pm.astype(np.float32)
    snede[int(vy + 0.80 * vh):] = 0.0
    # Heldere zone achter de divisieregel (briefing §1): het water blijft aan
    # de flanken en onder de punt, maar wijkt in het midden waar FutKaart
    # "GLAZENWASSER II" zet. De ondergroep (schild, tweede trekker) is van de
    # opening uitgezonderd — die hoort als voorwerp gewoon te blijven staan.
    xs = (np.arange(MASTER_DOEK[0]) - (vx + 0.5 * vw)) / (0.30 * vw)
    ys = (np.arange(MASTER_DOEK[1]) - (vy + 0.872 * vh)) / (0.085 * vh)
    helder = np.exp(-(xs[None, :] ** 2 + ys[:, None] ** 2) / 2.0)
    ondergroep = (
        master_poly(ONDERSCHILD) | master_poly(TREKKER_ONDER)
        | master_poly(BADGE)
    )
    helder = helder * (1.0 - vervaag(ondergroep.astype(np.float32), 6.0))
    # De voorwerpen op de flanken (trekker, emmer, ophanging) blijven ook in
    # de snedezone staan: zij liggen óp het glas en horen vóór de inhoud.
    voorwerpen = (
        master_poly(TREKKER_BOVEN) | master_poly(OPHANGING)
        | master_poly(EMMER)
    )
    snede = snede * (1.0 - vervaag(voorwerpen.astype(np.float32), 4.0))
    snede = np.clip(snede + 0.9 * helder.astype(np.float32), 0, 1)
    snede = np.asarray(
        Image.fromarray((snede * 255).astype(np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(7.0))
    ).astype(np.float32) / 255.0
    plaats(UIT / "gw-ring.webp", DELEN["ring"]["doos"], masker=1.0 - snede)

    # Het natte glas als onderste laag, strak binnen de glascontour; ring en
    # voorwerpen eroverheen — dezelfde stapeling als de brede kaart.
    binnen = Image.new("L", MASTER_DOEK, 0)
    ImageDraw.Draw(binnen).polygon(
        [
            (vx + (x - RX0) / RW * vw, vy + _naar_kaart_y((y - RY0) / RH) * vh)
            for x, y in GLAS_BINNEN
        ],
        fill=255,
    )
    glas = Image.open(UIT / "gw-glasvlak.webp").convert("RGBA").resize(
        (vw, vh), Image.LANCZOS
    )
    doek = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
    doek.paste(glas, (vx, vy))
    doek.putalpha(binnen.filter(ImageFilter.GaussianBlur(1.5)))
    doek.alpha_composite(boven)

    # Grade voor kaartformaat (briefing: "premium, hoog contrast"). Op de
    # maat van een klassement-kaart vervlakken de referentiekleuren: het ijs
    # en de spray middelen uit tegen de rails en het geheel leest melkig.
    # Meer verzadiging en contrast rond het middengrijs geven de rails hun
    # diepe blauw terug zonder de lichte glaspartij te verduisteren.
    arr = np.asarray(doek).astype(np.float32)
    rgb_m = arr[..., :3]
    grijs = rgb_m.mean(-1, keepdims=True)
    rgb_m = grijs + (rgb_m - grijs) * 1.3
    rgb_m = 127.5 + (rgb_m - 127.5) * 1.1
    arr[..., :3] = np.clip(rgb_m, 0, 255)
    doek = Image.fromarray(arr.astype(np.uint8), "RGBA")

    pad = UIT / "glazenwasser-master.webp"
    doek.save(pad, "WEBP", quality=82, method=6)
    print(f"  {'master (compact)':16s} {doek.width}×{doek.height}px  "
          f"{pad.stat().st_size // 1024} kB")
    voormasker(np.asarray(binnen) > 127,
               np.asarray(boven.split()[3]).astype(np.float32) / 255.0)


def voormasker(glasvlak_mask: np.ndarray, boven_alpha: np.ndarray) -> None:
    """Schrijft glazenwasser-front-mask.svg met een écht transparant glasgat.

    Zowel de CSS (`mask: url(...)`) als de canvasrenderer (`destination-in`)
    maskeren op álfa. De oude SVG had een zwarte achtergrond met witte lobes:
    als luminantiemasker correct, als alfamasker overal dekkend — en dus
    selecteerde hij niets en lag de hele master over de kaarttekst. Daarom
    moest het glasinterieur destijds uit de master worden gesneden.

    Dit masker is de exacte selectie "wat ligt er boven het glas": buiten de
    glascontour alles, erbinnen alleen waar ring en voorwerpen echt pixels
    hebben. Handcontouren waren hier te ruim — binnen zo'n contour kwam ook
    het (voortaan dekkende) glas vóór de kaartinhoud te liggen, dwars over de
    naamregel. De alfa komt daarom uit de compositie zelf en gaat als raster
    de SVG in; iets verruimd en zacht gemaakt, zodat de rand van een voorwerp
    nooit een sliver kaarttekst laat doorschemeren."""
    vol = np.clip(boven_alpha * 1.2, 0.0, 1.0)
    vol = vervaag(vol, 2.0)
    # Voor- en binnen-masker zijn complementair. Zonder die splitsing tekenden
    # beide lagen het volledige frame en composit elk halfdoorzichtig ijs- en
    # spraypixel twee keer — de melkwitte, uitgewassen compacte kaart. Het
    # frame alléén in de binnen-laag kan ook niet: de keyline-decoraties van
    # FutKaart schilderen op de zijde zelf en liggen dus over z −1 heen.
    # Daarom: frame en alles-op-het-glas in de voor-laag, het kale glas in de
    # binnen-laag (onder de kaartinhoud), elk precies één keer.
    masker = np.where(glasvlak_mask, vol, 1.0)
    binnen_masker = vervaag(
        np.where(glasvlak_mask, 1.0, 0.0).astype(np.float32), 2.0
    )
    def schrijf_masker(m: np.ndarray, naam: str, wat: str) -> int:
        # Op halve resolutie de SVG in: een masker hoeft niet pixelscherp (de
        # rand is toch zacht) en op volle maat woog de data-URI 125 kB — te
        # veel voor het bundelbudget van assetBudget.test.ts.
        beeld = Image.fromarray(
            np.clip(m * 255, 0, 255).astype(np.uint8), "L"
        ).resize((MASTER_DOEK[0] // 2, MASTER_DOEK[1] // 2), Image.LANCZOS)
        # Alfa == luminantie: als PNG met alfakanaal, zodat élke afnemer
        # (CSS-mask, canvas destination-in) hetzelfde selecteert.
        la = np.asarray(beeld.convert("LA")).copy()
        la[..., 1] = la[..., 0]
        png = io.BytesIO()
        Image.fromarray(la, "LA").save(png, "PNG", optimize=True)
        data = base64.standard_b64encode(png.getvalue()).decode("ascii")
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{MASTER_DOEK[0]}" height="{MASTER_DOEK[1]}" viewBox="0 0 {MASTER_DOEK[0]} {MASTER_DOEK[1]}">
  <!-- Gegenereerd door scripts/glazenwasser-onderdelen.py (voormasker()): {wat}
       Niet met de hand bijwerken. Expliciete width/height: canvas drawImage heeft een
       intrinsieke maat nodig (de posterrenderer maskeert met dit bestand). -->
  <image width="{MASTER_DOEK[0]}" height="{MASTER_DOEK[1]}" href="data:image/png;base64,{data}" />
</svg>
"""
        (UIT / naam).write_text(svg, encoding="utf8")
        return len(svg) // 1024

    kb_voor = schrijf_masker(
        masker, "glazenwasser-front-mask.svg",
        "frame en alles-op-het-glas voor de voor-laag, gat over het kale glas.",
    )
    kb_binnen = schrijf_masker(
        binnen_masker, "glazenwasser-binnen-mask.svg",
        "het kale glas voor de binnen-laag, complement van het front-mask.",
    )
    print(f"  {'voormasker':16s} raster-alfa uit de compositie  "
          f"{kb_voor} + {kb_binnen} kB")


def naar_kaart_h(h: float) -> float:
    """Referentiehoogte naar kaarthoogte, gelijk aan `naarKaartH` in de layout."""
    return h * (1114.0 / 975.0) / (139.0 / 100.0)


def main() -> int:
    UIT.mkdir(parents=True, exist_ok=True)

    # Sinds de herbouw wordt er geen enkel voorwerp meer los gesneden: crest,
    # trekker, ophanging, emmer en ondergroep zitten in de ring gebakken zoals
    # de referentie ze monteert, en de voorstrips (voor de z-volgorde op de
    # brede kaart) komen uit exact datzelfde doek. De contouren hierboven
    # blijven in gebruik voor `schoon_glas()`, de houd-zones in `kaartring()`
    # en de leesbaarheidssnede van de compacte master.
    natglas()
    glasvlak()
    kaartring()
    meet_overlap()

    for naam, d in sorted(DELEN.items()):
        spook = ", ".join(f"{k} {v:.2f}" for k, v in d["overlap"].items())
        print(f"  {naam:16s} {d['pixels'][2]:4d}×{d['pixels'][3]:4d}px  "
              f"alfa {d['alfa']:.3f}  dekking {d['dekking']:.3f}  {d['kB']:3d} kB"
              f"{'  overlap: ' + spook if spook else ''}")
    compacte_master()
    (UIT / "gw-onderdelen.json").write_text(
        json.dumps({k: v for k, v in sorted(DELEN.items())}, indent=2) + "\n",
        encoding="utf8",
    )

    if "--preview" in sys.argv:
        blad = Image.new("RGB", (1065, 1477), (12, 16, 24))
        for naam in DELEN:
            # Dekkende WebP's (het glasvlak) opent Pillow als RGB; als masker
            # moet het RGBA zijn.
            beeld = Image.open(UIT / f"gw-{naam}.webp").convert("RGBA")
            x, y = DELEN[naam]["pixels"][:2]
            blad.paste(beeld, (x, y), beeld)
        pad = WORTEL / "screenshots" / "glazenwasser" / "onderdelen.png"
        pad.parent.mkdir(parents=True, exist_ok=True)
        blad.save(pad)
        print(pad.relative_to(WORTEL))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
