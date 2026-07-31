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
    (170, 826, 914, 942),      # statblok
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
    zonder=(),
) -> None:
    """Snijdt één onderdeel vrij, bijgesneden op zijn eigen alfa."""
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
            kern = vul_gaten(ontkorrel(kern, korrel))
            # Aangehecht schuim en water: dat hangt áán het voorwerp en hoort
            # erbij, maar alleen vlak ertegenaan. Zonder die begrenzing komt de
            # halve glaswand mee, want die is net zo getextureerd.
            nabij = dilate(kern, halo)
            alpha = np.maximum(
                vervaag(kern.astype(np.float32), zacht),
                ruw * nabij * aanhechting,
            )
            alpha = alpha * np.clip(contour * 1.6, 0, 1)
        else:
            alpha = ruw * contour
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

    De vier massieve voorwerpen (crest, trekker, emmer, onderschild) horen er niet
    in: de kaart is hoger dan de referentie, dus de ring rekt verticaal 1,22×.
    Voor een rail, voor glas en voor water is dat onzichtbaar — een rail ís een
    extrusie — maar een emmer wordt er zichtbaar uitgetrokken. Die worden dus uit
    de ring geknipt, het gat erachter wordt gevuld, en ze komen op ware
    verhouding weer bovenop.
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

    # De voorwerpen die wél rekken worden eruit geknipt. Het gat is hun échte
    # silhouet en niet de ruime handcontour: die contour is een stuk groter dan
    # het voorwerp, dus dan blijft er rondom een opgevulde rand over die het
    # voorwerp niet afdekt — een bleke schim in de vorm van het gereedschap. Het
    # gat schuift bovendien mee met de verschuiving die de laag in
    # `glazenwasserLayout.ts` krijgt, zodat voorwerp en gat samenvallen.
    VERZET = {                      # kaartfracties, gelijk aan GW_LAGEN
        "trekker-boven": (0.0, 0.012),
        "ophanging": (0.0, 0.0),
        "emmer": (0.004, -0.022),
        "onderschild": (0.0, 0.012),
    }
    weg = np.zeros_like(luma)
    for naam, (dx, dy) in VERZET.items():
        # Krap om het voorwerp: het gat moet kleiner zijn dan wat er overheen
        # komt. Ruimer betekent een opgevulde rand die het voorwerp niet afdekt,
        # en dat is precies de bleke halo die eromheen bleef hangen.
        vorm = dilate(VOL_ALFA[naam] > 0.25, 2).astype(np.float32)
        vorm = np.roll(vorm, (int(round(dy * RH)), int(round(dx * RW))), (0, 1))
        weg = np.maximum(weg, vervaag(vorm, 2.0))

    # De ingebakken kaarttekst. Die werd eerder wéggevaagd, waardoor er lichte
    # rechthoeken met halve dekking over het glas lagen — precies de vage vlekken
    # die de kaart goedkoop maakten. Nu wordt hij gevuld in plaats van uitgedoofd:
    # de lage frequenties uit de omgeving (dus de juiste toon en belichting) plus
    # de hoge frequenties van de glastegel (dus echte strepen en condens). De ring
    # blijft daarmee overal volledig dekkend.
    binnen = vervaag(erode(BRON.contour(GLAS_BINNEN, 0.0) > 0.5, 6)
                     .astype(np.float32), 10.0)
    tekst = np.zeros_like(luma)
    for (x0, y0, x1, y1) in INHOUD:
        blok = np.zeros_like(luma)
        blok[max(0, y0 - 8):y1 + 8, max(0, x0 - 8):x1 + 8] = 1.0
        tekst = np.maximum(tekst, vervaag(blok, 16.0))
    tekst = tekst * binnen * (1.0 - crest_metaal)

    onbekend = np.maximum(weg, tekst) > 0.35
    laag = inpaint(BRON.rgb, ~onbekend)
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

    # Verticaal herbemonsteren met dezelfde stuksgewijze afbeelding die de layout
    # gebruikt: de kap en de punt houden hun maat, het middenveld rekt mee.
    breedte = int(round((RING_X1 - RING_X0) * RW))
    ky0, ky1 = _naar_kaart_y(RING_Y0), _naar_kaart_y(RING_Y1)
    hoogte = int(round((ky1 - ky0) * RW * (139.0 / 100.0)))
    ref = np.linspace(-0.4, 1.4, 6000)
    kaart = np.array([_naar_kaart_y(float(v)) for v in ref])
    rij_ref = np.interp(ky0 + (np.arange(hoogte) + 0.5) / hoogte * (ky1 - ky0),
                        kaart, ref)
    bron_y = RY0 + rij_ref * RH
    kol_x = RX0 + (RING_X0 + (np.arange(breedte) + 0.5) / breedte
                   * (RING_X1 - RING_X0)) * RW

    def bemonster(vlak: np.ndarray) -> np.ndarray:
        y = np.clip(bron_y, 0, vlak.shape[0] - 1.001)
        x = np.clip(kol_x, 0, vlak.shape[1] - 1.001)
        y0i, x0i = y.astype(int), x.astype(int)
        fy, fx = (y - y0i)[:, None], (x - x0i)[None, :]
        a = vlak[np.ix_(y0i, x0i)]
        b = vlak[np.ix_(y0i + 1, x0i)]
        c = vlak[np.ix_(y0i, x0i + 1)]
        d = vlak[np.ix_(y0i + 1, x0i + 1)]
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


# Doek en kaartvak van de compacte master, exact zoals GlazenwasserEffect.css ze
# registreert (--glazenwasser-master-left/-top/-width). Het kaartvak erin is
# 880 × 1223 px, oftewel dezelfde 100:139 als het stelsel van de ring.
MASTER_DOEK = (1024, 1440)
MASTER_VAK = (72, 160, 880, 1223)

# Verschuiving per voorwerp, gelijk aan `verzet` in GW_LAGEN. Zelfde tabel als in
# `kaartring()`; staat hier apart zodat de compacte master exact dezelfde
# compositie oplevert als de brede kaart.
MASTER_LAGEN = (
    # naam, z-volgorde
    ("ophanging", (0.0, 0.0)),
    ("trekker-boven", (0.0, 0.012)),
    ("emmer", (0.004, -0.022)),
    ("onderschild", (0.0, 0.012)),
)


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
    lagen worden hier één op één ingezet: geen tweede afbeelding, geen rek."""
    doek = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
    vx, vy, vw, vh = MASTER_VAK

    def plaats(pad: Path, vak: tuple[float, float, float, float]) -> None:
        left, top, breedte, hoogte = vak
        b = max(1, int(round(breedte * vw)))
        h = max(1, int(round(hoogte * vh)))
        laag = Image.open(pad).convert("RGBA").resize((b, h), Image.LANCZOS)
        doek.alpha_composite(
            laag, (int(round(vx + left * vw)), int(round(vy + top * vh)))
        )

    # De ring naar binnen toe laten uitdoven. De compacte kaart tekent zijn tekst
    # ín de `voor`-laag, dus alles wat het artwork midden op het vlak zet, komt
    # over rating, naam en divisieregel te liggen; FutKaart tekent daar bovendien
    # zijn eigen glasvlak al. Rechthoeken uitknippen langs de tekstzones geeft
    # zichtbare blokken — een uitdoving vanaf de lijst niet, en die houdt precies
    # vast wat de kaart wél moet erven: de lijst, het ijs, het water en de bellen.
    binnen = Image.new("L", MASTER_DOEK, 0)
    ImageDraw.Draw(binnen).polygon(
        [
            (vx + (x - RX0) / RW * vw, vy + _naar_kaart_y((y - RY0) / RH) * vh)
            for x, y in GLAS_BINNEN
        ],
        fill=255,
    )
    # Strak wegsnijden op de glasrand in plaats van naar binnen uitdoven. De
    # `voor`-laag toont de master ongemaskeerd (het front-mask-SVG is in CSS een
    # alfamasker en is overal ondoorzichtig, dus het selecteert niets), dus alles
    # wat hier op het kaartvlak staat komt over rating, naam en divisieregel.
    # Een uitdoving over 17% kaartbreedte las als een grote bleke gradiënt midden
    # op de kaart; een korte snede valt weg onder de binnenrand van de lijst.
    # De onderste waterexplosie blijft staan: die hoort op de referentie óver het
    # vlak te lopen en zat ook in de oude master.
    vlak = np.asarray(binnen).astype(np.float32) / 255.0
    onder = np.zeros_like(vlak)
    # Tot 0,80 wegsnijden: op 0,72 liep de waterexplosie over de divisieregel
    # van FutKaart heen en was 'GLAZENWASSER' niet meer te lezen.
    onder[int(vy + 0.80 * vh):] = 1.0
    snede = np.clip(vlak - onder, 0, 1)
    snede = np.asarray(
        Image.fromarray((snede * 255).astype(np.uint8), "L")
        .filter(ImageFilter.GaussianBlur(7.0))
    ).astype(np.float32) / 255.0
    verval = 1.0 - snede

    ringdoos = DELEN["ring"]["doos"]
    ringlaag = Image.open(UIT / "gw-ring.webp").convert("RGBA")
    rb = max(1, int(round(ringdoos[2] * vw)))
    rh = max(1, int(round(ringdoos[3] * vh)))
    ringlaag = ringlaag.resize((rb, rh), Image.LANCZOS)
    ringdoek = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
    ringdoek.alpha_composite(
        ringlaag,
        (int(round(vx + ringdoos[0] * vw)), int(round(vy + ringdoos[1] * vh))),
    )
    ra = np.asarray(ringdoek.split()[3]).astype(np.float32) * verval
    ringdoek.putalpha(Image.fromarray(np.clip(ra, 0, 255).astype(np.uint8), "L"))
    doek.alpha_composite(ringdoek)

    for naam, (dx, dy) in MASTER_LAGEN:
        left, top, breedte, hoogte = DELEN[naam]["doos"]
        plaats(
            UIT / f"gw-{naam}.webp",
            (left + dx, _naar_kaart_y(top) + dy, breedte, naar_kaart_h(hoogte)),
        )

    pad = UIT / "glazenwasser-master.webp"
    doek.save(pad, "WEBP", quality=82, method=6)
    print(f"  {'master (compact)':16s} {doek.width}×{doek.height}px  "
          f"{pad.stat().st_size // 1024} kB")


def naar_kaart_h(h: float) -> float:
    """Referentiehoogte naar kaarthoogte, gelijk aan `naarKaartH` in de layout."""
    return h * (1114.0 / 975.0) / (139.0 / 100.0)


def main() -> int:
    UIT.mkdir(parents=True, exist_ok=True)

    # De crest wordt niet meer los gesneden: hij zit in de ring, waar hij bij de
    # lijst hoort zoals op de referentie. Zijn contour blijft nodig om hem daar
    # tegen het tekstmasker te beschermen.
    # Dunne, hooggekleurde steel: een grovere ontkorreling knipt hem weg.
    # Krappere aanhechting: het schuim aan het blad hoort erbij, de losse
    # glasvlekken rechts ernaast niet.
    snijd("trekker-boven", TREKKER_BOVEN, "vast", feather=5.0, drempel=14.0,
          korrel=1, zacht=1.0, halo=5, aanhechting=0.42)
    snijd("ophanging", OPHANGING, "glas", feather=6.0, drempel=11.0,
          spreiding=24.0, versterk=1.15, zonder=(EMMER,))
    snijd("emmer", EMMER, "vast", feather=5.0, drempel=14.0, zacht=1.0,
          vrij_vanaf_x=900)
    snijd("onderschild", ONDERSCHILD, "vast", feather=6.0, drempel=14.0,
          zacht=1.2)
    # Waterexplosie, hoekijs en flankdruppels zijn geen losse onderdelen meer:
    # ze zitten in de ring, waar ze in één doorlopende waterhuid om het schild
    # lopen zoals op de referentie. Hun contouren blijven hierboven staan omdat
    # `schoon_glas()` ze nodig heeft om te weten waar géén water staat.
    natglas()
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
            beeld = Image.open(UIT / f"gw-{naam}.webp")
            x, y = DELEN[naam]["pixels"][:2]
            blad.paste(beeld, (x, y), beeld)
        pad = WORTEL / "screenshots" / "glazenwasser" / "onderdelen.png"
        pad.parent.mkdir(parents=True, exist_ok=True)
        blad.save(pad)
        print(pad.relative_to(WORTEL))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
