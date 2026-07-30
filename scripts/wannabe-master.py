#!/usr/bin/env python3
"""Bouwt het Wannabe-master-artwork uit docs/referentie_wannabe.png.

Net als bij de pias, de GOAT en de Glazenwasser is dit script de bron van
waarheid voor `src/features/rating/components/wannabe/assets/`: master én
frontmasker komen hier uit, dus bij een gewijzigde referentie of een andere
uitsnede draai je het opnieuw in plaats van de WebP met de hand bij te werken.

    python3 scripts/wannabe-master.py             # master + masker
    python3 scripts/wannabe-master.py --preview   # ook twee controlebeelden

Afhankelijkheden staan bewust buiten de npm-toolchain (eenmalige assetstap, geen
build- of runtime-afhankelijkheid): Python 3 met numpy en Pillow.

Werking
-------
Anders dan de andere referenties staat deze kaart op *wit*, niet op zwart. Een
luminantiesleutel zou hier dus precies het verkeerde vasthouden. Het model is in
plaats daarvan `P = a·C + (1−a)·BG`, met `BG` een lokale schatting van het
papier: een maximumfilter (de dikste stift is smaller dan het venster, dus het
maximum ís het onbeschreven papier) gevolgd door een lichte vervaging. Dat werkt
in één keer op het witte buitenveld én op het perkament van het kaartvlak — en
dat is nodig, want dezelfde stiftstreek loopt hier van buiten de kaart tot over
het frame.

Per onderdeel wordt een contour getrokken en binnen die contour een sleutel
gekozen:

* `inkt`  — alles wat met stift of inkt op iets anders ligt: pijlen, kruisen,
  het kroontje, de krassenbundel en de druipers onder de lijst. Deze sleutel
  moest hier drie poorten hebben in plaats van één, want de stift loopt over de
  lijst en die lijst is even donker als de stift zelf:
  1. *donkerte* tegenover het lokale papier — de eigenlijke sleutel;
  2. *chroma* (max − min kanaal): alles wat getekend is, is neutraal zwart
     (5–14), de lijst is warm bruin (40–65). Waar de lijst zó diep in de
     schaduw staat dat hij óók neutraal wordt, is hij ook bijna zwart en valt
     het verschil met inkt weg;
  3. *lokaal contrast* tegenover een straal-12-vervaging: een streek is smal en
     springt eruit, het vlak van de lijst is breed en glad. Zonder deze poort
     landt de halve onderhoek van de referentie als zwarte plaat op de kaart.
  De kleur komt rauw uit de referentie (geen un-premultiply): de poorten
  verhogen de alpha boven de echte dekking uit, en tegen die opgeblazen alpha
  zou een un-premultiply van zwarte stift juist grijs maken.
* `vast`  — massieve voorwerpen (beide medaillons, de twee plakstroken, de twee
  briefjes, de afgesprongen splinter). De contour ís het masker: hun eigen papier
  is lichter dan het perkament, dus een donkerte-sleutel zou ze juist wegpoetsen.
  Eén poort blijft nodig: het witte veld en de grijze slagschaduw búiten de kaart
  vallen binnen elke contour die over de kaartrand loopt, dus wat licht én
  neutraal is valt weg. Papier is warm (chroma 30–60) en blijft dus staan.
* `perkament` — de vuilklasse van het kaartvlak zelf: rasterpunten, spatten,
  vlekken en het getekende tekstballonnetje met kroontje. Alpha komt uit het
  verschil met twee vervagingen (fijn voor spatten, grof voor de rasterpunten:
  een punt van ±14 px overleeft een straal-7-vervaging en zou er anders uit
  vallen), en alleen uit de *donkere* helft van dat verschil — vuil maakt papier
  donkerder, dus de lichte helft meenemen levert een bleke waas over het
  kaartvlak in plaats van slijtage.

Registratie
-----------
Het canvas is het gedeelde coördinatenstelsel van achter-, binnen- en voorlaag.
Het kaartvak erin volgt exact uit de drie CSS-waarden in WannabeEffect.css. De
referentiekaart is verhoudingsgewijs iets smaller dan de echte kaart (0,70 tegen
0,72), dus x en y krijgen elk hun eigen afbeelding: `kaart_x`/`kaart_y` zetten
een referentiepunt op zijn kaartfractie, terwijl elk voorwerp op één uniforme
schaal (`S`) wordt verkleind — zo blijft een medaillon rond.

Het echte verschil zit onderin: de referentie loopt tot ~84% kaarthoogte op
volle breedte door en tapst dan naar de punt, het app-schild (`#fut-schild-notch`)
begint zijn taps al op 60%. Alles wat in de referentie in die onderhoek staat —
het kroontje, de krassenbundel, de druipers — zou op zijn referentieplek naast de
kaart hangen. Die onderdelen krijgen daarom een verschuiving in kaartfracties
(`dfx`/`dfy`); de vier CSS-waarden blijven voor alle drie de lagen gelijk.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "referentie_wannabe.png"
UIT = WORTEL / "src/features/rating/components/wannabe/assets"
KWALITEIT = 78

# --- registratie -------------------------------------------------------------
# Buitenrand van de lijst in de referentie (1086 × 1448). De bovenrand is geen
# rechte lijn maar een flauwe gevel: hij loopt van y≈160 in de schouders op naar
# y≈100 onder de crest. RY0 ligt daar bewust tussenin, zodat de gevel een paar
# procent boven de rechte bovenrand van het app-schild uitkomt in plaats van er
# scheef doorheen te snijden.
RX0, RY0, RX1, RY1 = 97.0, 120.0, 986.0, 1392.0
RW, RH = RX1 - RX0, RY1 - RY0            # 889 × 1272

CW, CH = 1024, 1440                      # mastercanvas
CARD_W = 860.0
CARD_H = CARD_W * 1.39                   # 1195,4 — de vaste aspect-ratio
CARD_X, CARD_Y = 82.0, 150.0

S = CARD_W / RW                          # 0,9674: uniforme voorwerpschaal
SY = CARD_H / RH                         # 0,9398: verticale kaartafbeelding


def kaart_x(x: float) -> float:
    return CARD_X + (x - RX0) * S


def kaart_y(y: float) -> float:
    return CARD_Y + (y - RY0) * SY


def ellips(cx: float, cy: float, rx: float, ry: float, n: int = 40):
    return [
        (cx + rx * math.cos(2 * math.pi * i / n),
         cy + ry * math.sin(2 * math.pi * i / n))
        for i in range(n)
    ]


# --- contouren ---------------------------------------------------------------
# Alle punten in referentiecoördinaten, met de klok mee. Bij `vast` volgen ze het
# silhouet; bij `inkt` mogen ze ruim zijn, want daar doet de sleutel het werk.

CREST = ellips(539, 132, 84, 95)
MEGAFOON = ellips(543, 1207, 106, 104)

TAPE_LINKS = [
    (84, 452), (102, 418), (150, 404), (212, 406), (256, 448), (250, 482),
    (196, 500), (164, 524), (126, 532), (94, 500),
]

TAPE_RECHTS = [
    (988, 398), (1014, 394), (1038, 436), (1030, 456), (916, 580), (884, 580),
    (868, 546), (880, 524),
]

# Afgesprongen splinter langs de linkerlijst, met de haarscheur eronder.
SPLINTER_LINKS = [
    (90, 290), (104, 292), (194, 398), (188, 412), (172, 406), (94, 302),
]

NOTITIE_LINKS = [
    (72, 642), (78, 600), (110, 586), (170, 582), (224, 588), (242, 620),
    (240, 678), (232, 714), (194, 728), (138, 730), (94, 716), (74, 688),
]

# De pijlen en het handgetekende kader eromheen; ruim genomen, want de
# inktsleutel houdt alleen de streken over.
PIJLEN_LINKS = [
    (84, 600), (146, 556), (196, 504), (258, 508), (272, 596), (264, 692),
    (272, 744), (250, 810), (194, 812), (136, 778), (92, 732), (76, 666),
]

NOTITIE_RECHTS = [
    (846, 702), (886, 688), (942, 684), (1002, 690), (1016, 726), (1020, 800),
    (1012, 862), (1006, 908), (948, 912), (898, 904), (858, 898), (844, 852),
    (840, 780), (842, 730),
]

KRUIS_RECHTS = [
    (824, 590), (858, 570), (902, 576), (940, 610), (942, 662), (912, 702),
    (866, 714), (828, 692), (816, 640),
]

# Kroontje plus krassenbundel in de linker onderhoek. De bovenrand blijft onder
# het statblok van de referentie (y≈1098), anders komt "POTENTIE 75" mee als
# spookkopie.
KROON_LINKSONDER = [
    (134, 1164), (168, 1122), (240, 1104), (322, 1104), (392, 1122),
    (442, 1172), (448, 1218), (410, 1264), (330, 1286), (248, 1278),
    (178, 1242), (138, 1202),
]

# Diagonale inktstreek met spatten, van het statblok naar de onderrand.
INKTSTREEK_RECHTS = [
    (588, 1140), (620, 1104), (678, 1106), (742, 1142), (788, 1196),
    (792, 1246), (752, 1260), (690, 1232), (630, 1188), (588, 1162),
]

# De drie druipers die onder de lijst uit hangen.
INKTDRUPPELS = [
    (704, 1214), (760, 1204), (814, 1214), (820, 1270), (806, 1332),
    (776, 1370), (746, 1374), (724, 1336), (710, 1280),
]

# De beschadigingen ín de lijst zelf staan er bewust níet in: de zwarte vegen op
# de band vallen samen met het statblok van de referentie, de afgesprongen hoek
# rechtsboven leverde een bruine plaat lijst óver het frame van de app, en de
# gescheurde flard onder de rechter plakstrook las als een willekeurige grijze
# veeg naast de avatar. De lijst van de app draagt zijn eigen verwering.

# --- kaartinhoud van de referentie -------------------------------------------
# Deze zones zitten in het bronbeeld ingebakken. De perkamenttextuur laat ze
# leeg; anders staat er een spookkopie van rating, avatar, naam en statblok naast
# de echte inhoud van de kaart.
INHOUD = [
    (195, 228, 562, 388),      # rating 1050
    (342, 388, 402, 468),      # subniveau II
    (306, 468, 438, 592),      # vormemoji
    (266, 626, 624, 660),      # bovenste scheidingslijn
    (262, 686, 812, 720),      # onderste scheidingslijn
    (286, 738, 858, 878),      # PAPAPADEL
    (276, 876, 818, 988),      # WANNABE II-band
    (186, 992, 902, 1098),     # statblok
]

# De avatar wordt als cirkel uitgespaard en niet als rechthoek: precies in de
# hoeken van zijn bounding box zit het dichtste rasterpuntveld van de
# referentie, en met een rechthoek verdwijnt juist dat.
INHOUD_ROND = [(750, 415, 168)]

# Zone van de perkamenttextuur: strikt bínnen de lijst (die begint op x≈156 en
# x≈948), tot net boven de taps. De lijst zelf hoort er niet in: die is bruin en
# zou als tweede kader over het frame van de app komen.
TEXTUUR = (186, 200, 906, 1120)


# --- gereedschap -------------------------------------------------------------
def vervaag(m: np.ndarray, straal: float) -> np.ndarray:
    beeld = Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8))
    return np.asarray(
        beeld.filter(ImageFilter.GaussianBlur(straal))
    ).astype(np.float32) / 255.0


class Bron:
    """De referentie plus de afgeleiden die elke sleutel nodig heeft."""

    def __init__(self) -> None:
        beeld = Image.open(REFERENTIE).convert("RGB")
        self.rgb = np.asarray(beeld).astype(np.float32)
        self.h, self.w = self.rgb.shape[:2]
        self.luma = (
            0.299 * self.rgb[..., 0]
            + 0.587 * self.rgb[..., 1]
            + 0.114 * self.rgb[..., 2]
        )
        # Lokaal papiermodel. Het maximumfilter wist elke streek die smaller is
        # dan zijn venster; de vervaging erna haalt de blokjesrand eruit. Buiten
        # de kaart levert dat wit, op het kaartvlak perkament — precies de twee
        # achtergronden waar de stift op ligt.
        papier = np.asarray(
            beeld.filter(ImageFilter.MaxFilter(21)).filter(
                ImageFilter.GaussianBlur(9.0)
            )
        ).astype(np.float32)
        self.papier_luma = (
            0.299 * papier[..., 0]
            + 0.587 * papier[..., 1]
            + 0.114 * papier[..., 2]
        )
        # Chroma als materiaalpoort: getekend = neutraal, lijst = warm bruin.
        self.chroma = self.rgb.max(-1) - self.rgb.min(-1)
        # Lokaal contrast als vormpoort: een streek is smal, een vlak is breed.
        self.contrast = np.abs(self.luma - vervaag(self.luma / 255.0, 12.0) * 255.0)
        # Twee detailschalen voor de perkamenttextuur: fijn voor spatten en
        # krasjes, grof voor de rasterpunten van ±14 px. Alleen de *donkere*
        # afwijking telt: vuil maakt papier donkerder, en de lichte helft van de
        # afwijking zou als bleke waas over het kaartvlak komen te liggen.
        fijn = vervaag(self.luma / 255.0, 7.0) * 255.0
        grof = vervaag(self.luma / 255.0, 26.0) * 255.0
        self.detail_fijn = np.clip(fijn - self.luma, 0, None)
        self.detail_grof = np.clip(grof - self.luma, 0, None)

    def contourmasker(self, punten, feather: float) -> np.ndarray:
        m = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in punten],
                                  fill=255)
        arr = np.asarray(m).astype(np.float32) / 255.0
        return vervaag(arr, feather) if feather > 0 else arr


BRON = Bron()


def _rgba(x0: int, y0: int, x1: int, y1: int,
          alpha: np.ndarray) -> Image.Image:
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = np.clip(BRON.rgb[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


# Poorten van de inktsleutel. Ze staan hier als constanten en niet als
# parameters: ze scheiden materiaal (stift versus lijst), niet onderdelen, dus
# per onderdeel afwijken zou betekenen dat "wat is inkt" per plek verschilt.
CHROMA_NEUTRAAL, CHROMA_BRUIN = 12.0, 28.0
CONTRAST_VLAK, CONTRAST_STREEK = 10.0, 36.0


def uitsnede(
    naam: str,
    punten,
    sleutel: str = "vast",
    feather: float = 3.0,
    drempel: float = 30.0,
    spreiding: float = 110.0,
    versterk: float = 1.0,
) -> dict:
    """Sleutelt één onderdeel vrij en levert het als RGBA-uitsnede."""
    xs = [p[0] for p in punten]
    ys = [p[1] for p in punten]
    x0, y0 = int(max(0, min(xs) - 14)), int(max(0, min(ys) - 14))
    x1, y1 = int(min(BRON.w, max(xs) + 14)), int(min(BRON.h, max(ys) + 14))

    contour = BRON.contourmasker(punten, feather)[y0:y1, x0:x1]
    if sleutel == "vast":
        # Het witte veld buiten de kaart (luma ≈ 254, chroma ≈ 1) en de grijze
        # slagschaduw eromheen vallen bínnen elke contour die over de kaartrand
        # heen loopt. Zonder deze poort krijgt elk briefje en elke plakstrook een
        # witte halo op de kaart — en de contactschaduw hoort van CSS te komen,
        # niet uit een tweede, meegekopieerde schaduw. Papier is warm (chroma
        # 30–60), dus de poort raakt alleen het neutrale wit.
        licht = np.clip((BRON.luma[y0:y1, x0:x1] - 240.0) / 12.0, 0, 1)
        neutraal = np.clip((14.0 - BRON.chroma[y0:y1, x0:x1]) / 10.0, 0, 1)
        alpha = np.clip(contour * (1.0 - licht * neutraal) * versterk, 0, 1)
    elif sleutel == "inkt":
        donkerte = BRON.papier_luma[y0:y1, x0:x1] - BRON.luma[y0:y1, x0:x1]
        poort_chroma = np.clip(
            (CHROMA_BRUIN - BRON.chroma[y0:y1, x0:x1])
            / (CHROMA_BRUIN - CHROMA_NEUTRAAL),
            0, 1,
        )
        poort_vorm = np.clip(
            (BRON.contrast[y0:y1, x0:x1] - CONTRAST_VLAK)
            / (CONTRAST_STREEK - CONTRAST_VLAK),
            0, 1,
        )
        ruw = np.clip((donkerte - drempel) / spreiding, 0, 1)
        alpha = np.clip(
            ruw * poort_chroma * poort_vorm * contour * versterk, 0, 1
        )
    else:
        raise ValueError(f"onbekende sleutel {sleutel!r}")
    beeld = _rgba(x0, y0, x1, y1, alpha)

    beeld = beeld.resize(
        (max(1, round(beeld.width * S)), max(1, round(beeld.height * SY))),
        Image.LANCZOS,
    )
    return {
        "naam": naam,
        "beeld": beeld,
        "punten": punten,
        "bron": (x0, y0, x1, y1),
        "fx": S,
        "fy": SY,
    }


def perkament() -> dict:
    """Rasterpunten, spatten, vlekken en het getekende tekstballonnetje van het
    kaartvlak. Anders dan de voorwerpen wordt deze uitsnede óók verticaal met SY
    opgerekt — het is een textuur, geen voorwerp, en vuil dat meerekt met de
    hogere kaart leest juist natuurlijker."""
    x0, y0, x1, y1 = TEXTUUR
    detail = np.maximum(
        BRON.detail_fijn[y0:y1, x0:x1],
        BRON.detail_grof[y0:y1, x0:x1] * 0.9,
    )
    alpha = np.clip((detail - 3.0) / 22.0, 0, 1) * 0.78
    vrij = np.ones_like(alpha)
    for (ax0, ay0, ax1, ay1) in INHOUD:
        blok = np.zeros((BRON.h, BRON.w), np.float32)
        blok[ay0:ay1, ax0:ax1] = 1.0
        # Vervaagde rand: met een harde rand blijft de uitgespaarde zone als
        # rechthoek in het vuil staan, en dan leest de textuur als een sticker.
        vrij *= 1.0 - np.clip(vervaag(blok, 16.0)[y0:y1, x0:x1] * 1.7, 0, 1)
    for (cx, cy, r) in INHOUD_ROND:
        m = Image.new("L", (BRON.w, BRON.h), 0)
        ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        rond = np.asarray(m).astype(np.float32) / 255.0
        vrij *= 1.0 - np.clip(vervaag(rond, 16.0)[y0:y1, x0:x1] * 1.7, 0, 1)
    alpha *= vrij
    # Naar de randen uitdoven, zodat de textuur nergens als rechthoek eindigt.
    hh, ww = alpha.shape
    gx = np.clip(np.minimum(np.arange(ww), ww - 1 - np.arange(ww)) / 54.0, 0, 1)
    gy = np.clip(np.minimum(np.arange(hh), hh - 1 - np.arange(hh)) / 54.0, 0, 1)
    alpha *= gy[:, None] * gx[None, :]

    beeld = _rgba(x0, y0, x1, y1, alpha)
    beeld = beeld.resize((round(ww * S), round(hh * SY)), Image.LANCZOS)
    return {
        "naam": "perkament",
        "beeld": beeld,
        "punten": [(x0, y0), (x1, y0), (x1, y1), (x0, y1)],
        "bron": (x0, y0, x1, y1),
        "fx": S,
        "fy": SY,
    }


# --- compositie --------------------------------------------------------------
PLAATSING: dict[str, tuple[int, int, int, int]] = {}


def plaats(doel: Image.Image, el: dict, dfx: float = 0.0, dfy: float = 0.0):
    """Zet een uitsnede op zijn kaartfractie, met een correctie in
    kaartbreedtes/-hoogtes. Het anker is het midden van de uitsnede."""
    x0, y0, x1, y1 = el["bron"]
    mx = kaart_x((x0 + x1) / 2) + dfx * CARD_W
    my = kaart_y((y0 + y1) / 2) + dfy * CARD_H
    beeld: Image.Image = el["beeld"]
    px, py = round(mx - beeld.width / 2), round(my - beeld.height / 2)
    doel.alpha_composite(beeld, (px, py))
    PLAATSING[el["naam"]] = (px, py, px + beeld.width, py + beeld.height)
    el["plaats"] = (px, py)
    return el


def naar_canvas(el: dict) -> list[tuple[float, float]]:
    """De contour van een onderdeel in canvascoördinaten — de bron van de
    maskervormen, zodat een maskervorm nooit los van een voorwerp kan
    verschuiven."""
    bx0, by0 = el["bron"][0], el["bron"][1]
    px, py = el["plaats"]
    return [
        (px + (x - bx0) * el["fx"], py + (y - by0) * el["fy"])
        for x, y in el["punten"]
    ]


def inkrimp(punten, factor: float):
    """Contour naar zijn zwaartepunt trekken. Bij een massief voorwerp verbergt
    een maskerrand die bínnen de uitsnede eindigt de rechte snederand; bij inkt
    is er geen snederand te verbergen, dus die maskers blijven ruim."""
    cx = sum(p[0] for p in punten) / len(punten)
    cy = sum(p[1] for p in punten) / len(punten)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in punten]


def pad(punten) -> str:
    kop = f"M{punten[0][0]:.0f} {punten[0][1]:.0f}"
    rest = " ".join(f"L{x:.0f} {y:.0f}" for x, y in punten[1:])
    return f"{kop} {rest} Z"


def bouw() -> tuple[Image.Image, list[dict]]:
    doel = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    # 1. Perkamentvuil: onderste laag, want alles ligt er in de referentie op.
    plaats(doel, perkament())

    # 2. Beschadigingen ín de lijst: de afgesprongen hoek rechtsboven, de
    #    gescheurde flard onder de rechter plakstrook en de splinter links.
    splinter = plaats(
        doel,
        uitsnede("splinter-links", SPLINTER_LINKS, "vast", feather=2.5),
    )

    # 3. Stift op het kaartvlak. Deze blijven binnen het schild.
    kruis = plaats(
        doel,
        uitsnede("kruis-rechts", KRUIS_RECHTS, "inkt", feather=6.0,
                 versterk=2.6),
        dfx=0.015, dfy=0.09,
    )
    streek = plaats(
        doel,
        uitsnede("inktstreek-rechts", INKTSTREEK_RECHTS, "inkt", feather=6.0,
                 versterk=2.2),
        dfx=-0.02, dfy=-0.035,
    )

    # 4. Plakstroken over beide flanken.
    tape_l = plaats(doel, uitsnede("tape-links", TAPE_LINKS, "vast",
                                   feather=2.5))
    tape_r = plaats(doel, uitsnede("tape-rechts", TAPE_RECHTS, "vast",
                                   feather=2.5), dfx=0.03)

    # 5. "ALMOST THERE?" links: eerst het papier, dan de streken erover.
    notitie_l = plaats(doel, uitsnede("notitie-links", NOTITIE_LINKS, "vast",
                                      feather=3.0))
    pijlen = plaats(
        doel,
        uitsnede("pijlen-links", PIJLEN_LINKS, "inkt", feather=6.0,
                 versterk=2.4),
    )

    # 6. "NOT BAD" rechts. De app zet zijn avatar lager en groter dan de
    #    referentie, dus het briefje zakt mee — anders ligt zijn bovenhoek over
    #    de foto.
    notitie_r = plaats(
        doel,
        uitsnede("notitie-rechts", NOTITIE_RECHTS, "vast", feather=3.0),
        dfy=0.075,
    )

    # 7. De onderhoeken. Hier is de vormcorrectie het grootst: het app-schild
    #    tapst vanaf 60% hoogte, de referentie pas vanaf 84%.
    kroon_lo = plaats(
        doel,
        uitsnede("kroon-linksonder", KROON_LINKSONDER, "inkt", feather=7.0,
                 versterk=2.4),
        dfx=0.085, dfy=0.045,
    )
    druppels = plaats(
        doel,
        uitsnede("inktdruppels", INKTDRUPPELS, "inkt", feather=6.0,
                 versterk=2.4),
        dfx=-0.035, dfy=-0.02,
    )

    # 8. De twee medaillons: racketcrest boven de bovenrand, megafoon in de
    #    schildpunt.
    crest = plaats(doel, uitsnede("crest", CREST, "vast", feather=3.0))
    megafoon = plaats(doel, uitsnede("megafoon", MEGAFOON, "vast", feather=3.0),
                      dfy=0.045)

    # Voorselectie: alles wat in de referentie óver de lijst valt. Het kruis, de
    # inktstreek en het perkamentvuil staan er bewust niet in — die horen ín het
    # kaartvlak en zouden vóór de lijst juist als vuil op het frame lezen.
    voor = [
        crest, megafoon, tape_l, tape_r, splinter, notitie_l, pijlen,
        notitie_r, kroon_lo, druppels,
    ]
    # Contouren die een echt silhouet snijden krimpen in; inktgroepen niet, want
    # daar is geen snederand te verbergen.
    krimp = {
        "crest": 0.965, "megafoon": 0.965, "tape-links": 0.95,
        "tape-rechts": 0.95, "notitie-links": 0.955, "notitie-rechts": 0.955,
        "splinter-links": 0.9,
    }
    return doel, voor, krimp


def schrijf_masker(bestand: Path, delen: list[dict], krimp: dict[str, float],
                   titel: str, blur: int) -> None:
    regels = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} {CH}">',
        f"  <!-- {titel} -->",
        "  <defs>",
        '    <filter id="zacht" x="-14%" y="-14%" width="128%" height="128%">',
        f'      <feGaussianBlur stdDeviation="{blur}" />',
        "    </filter>",
        "  </defs>",
        # Geen zwarte achtergrondrect: `mask` met een SVG-*image* valt in
        # match-source terug op alpha, niet op luminance. Een dekkende zwarte
        # rect heeft alpha 1 en laat dan de héle master door — dan staat het
        # rasterpuntvuil ineens vóór de avatar. Transparant werkt in béide
        # modi: alpha 0 én luminance 0.
        '  <g fill="#fff" filter="url(#zacht)">',
    ]
    for el in delen:
        regels.append(f'    <!-- {el["naam"]} -->')
        vorm = inkrimp(naar_canvas(el), krimp.get(el["naam"], 1.0))
        regels.append(f'    <path d="{pad(vorm)}" />')
    regels += ["  </g>", "</svg>", ""]
    bestand.write_text("\n".join(regels), encoding="utf8")


def main() -> int:
    doel, voor, krimp = bouw()
    UIT.mkdir(parents=True, exist_ok=True)

    master = UIT / "wannabe-master.webp"
    doel.save(master, "WEBP", quality=KWALITEIT, method=6)

    schrijf_masker(
        UIT / "wannabe-front-mask.svg",
        voor,
        krimp,
        "Voorselectie: de onderdelen die in de referentie óver de lijst liggen "
        "— racketcrest, megafoonmedaillon, beide plakstroken, beide briefjes "
        "met hun pijlen, de afgesprongen splinter, het kroontje met "
        "krassenbundel en de inktdruipers. Elke vorm is de contour van het "
        "bijbehorende onderdeel uit scripts/wannabe-master.py, dus een "
        "maskervorm kan niet los van een voorwerp verschuiven. Er staat bewust "
        "geen zwarte achtergrondrect in: CSS mask met een SVG-image valt in "
        "match-source terug op alpha, niet op luminance, en een dekkende zwarte "
        "rect laat dan de hele master door.",
        blur=8,
    )

    print(f"{master.relative_to(WORTEL)}: {doel.size[0]}×{doel.size[1]}, "
          f"{master.stat().st_size // 1024} kB")
    print(f"kaartvak: x {CARD_X:.0f}..{CARD_X + CARD_W:.0f}, "
          f"y {CARD_Y:.0f}..{CARD_Y + CARD_H:.0f}")
    print(f"css: left {-CARD_X / CARD_W * 100:.2f}%, "
          f"top {-CARD_Y / CARD_H * 100:.2f}%, width {CW / CARD_W * 100:.2f}%")
    for naam, doos in PLAATSING.items():
        print(f"  {naam}: {doos}")

    if "--preview" in sys.argv:
        map_uit = WORTEL / "screenshots" / "wannabe"
        map_uit.mkdir(parents=True, exist_ok=True)
        plaat = Image.new("RGB", doel.size, (24, 20, 14))
        plaat.paste(doel, (0, 0), doel)
        tek = ImageDraw.Draw(plaat)
        tek.rectangle(
            [CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H],
            outline=(0, 255, 136), width=3,
        )
        plaat.save(map_uit / "master-preview.png")
        # Tweede controlebeeld: dezelfde master op wit, met de contouren erop.
        licht = Image.new("RGB", doel.size, (250, 250, 250))
        licht.paste(doel, (0, 0), doel)
        tek = ImageDraw.Draw(licht)
        tek.rectangle(
            [CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H],
            outline=(0, 170, 90), width=3,
        )
        for naam, (px0, py0, px1, py1) in PLAATSING.items():
            tek.rectangle([px0, py0, px1, py1], outline=(220, 40, 90))
            tek.text((px0 + 3, py0 + 3), naam, fill=(180, 20, 70))
        licht.save(map_uit / "master-contouren.png")
        print(f"{(map_uit / 'master-preview.png').relative_to(WORTEL)}")
        print(f"{(map_uit / 'master-contouren.png').relative_to(WORTEL)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
