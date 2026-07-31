#!/usr/bin/env python3
"""Bouwt het Glazenwasser-master-artwork uit docs/referentie_glazenwasser.png.

Net als bij de pias en de GOAT is dit script de bron van waarheid voor
`src/features/rating/components/glazenwasser/assets/`: de master én het voormasker
komen hier uit, dus bij een gewijzigde referentie of een andere uitsnede draai je
het opnieuw in plaats van de WebP met de hand bij te werken.

    python3 scripts/glazenwasser-master.py            # master + masker
    python3 scripts/glazenwasser-master.py --preview   # ook een controlebeeld

Afhankelijkheden staan bewust buiten de npm-toolchain (eenmalige assetstap, geen
build- of runtime-afhankelijkheid): Python 3 met numpy en Pillow.

Werking
-------
De referentie is één platte render: een gebogen glasschild met kaartinhoud erin,
op zwart. Er is dus niets "los" aan te leveren — per onderdeel wordt een contour
getrokken en binnen die contour een sleutel gekozen:

* `vast`   — massieve, goed te traceren voorwerpen (raamcrest, beide trekkers,
  sopemmer, schildbadge). De contour ís het masker; een paar pixels
  referentieglas langs de rand valt niet op, want het kaartvlak van de app heeft
  vrijwel dezelfde lichtwaarde.
* `glas`   — dunne of halftransparante zaken (ophangketting, schuim, zeepbellen,
  waterslierten over de lijst). Alpha komt uit de afwijking tegenover een grof
  vervaagde versie van de referentie: wat lokaal oplicht of juist donkerder is,
  is water of metaal; het gladde verloop van glas en frame verdwijnt. Dit is de
  sleutel die dun materiaal in een ruime contour aankan — `vast` zou daar de hele
  contour dichtzetten.
* `zwart`  — schuim dat over de bovenhoeken naar buiten hangt, waar de referentie
  op zwart staat: een luminantiesleutel volstaat.

Registratie
-----------
Het canvas is het gedeelde coördinatenstelsel van achter-, binnen- en voorlaag.
Het kaartvak erin volgt exact uit de drie CSS-waarden in GlazenwasserEffect.css.
Het schild van de referentie is verhoudingsgewijs veel breder dan de echte kaart
(0,88 tegen 0,72), dus x en y krijgen elk hun eigen afbeelding: `kaart_x`/`kaart_y`
zetten een referentiepunt op zijn kaartfractie, terwijl elk voorwerp op één
uniforme schaal (`S`) wordt verkleind. Zo houdt de emmer zijn ronde vorm en hangt
hij toch op dezelfde relatieve hoogte aan de flank.

Daarnaast staat de kaartinhoud van de app lager dan die van de referentie
(naamplaat op 0,66 tegen 0,51) en heeft het app-schild rechte flanken met een
kortere taps. Elk onderdeel draagt daarom een verschuiving in kaartfracties, en
waar nodig een eigen schaal of draaiing. Zonder die correcties hangt de emmer over
de avatar en loopt de onderste trekker door de divisieregel.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "fut-kaarten" / "referentie_glazenwasser.png"
UIT = WORTEL / "src/features/rating/components/glazenwasser/assets"
KWALITEIT = 84

# --- registratie -------------------------------------------------------------
# Buitenrand van het frame in de referentie (1065 × 1477): de smalste rij ligt
# bovenaan, de breedste op ~72% hoogte, de punt op y=1232.
RX0, RY0, RX1, RY1 = 44.0, 118.0, 1019.0, 1232.0
RW, RH = RX1 - RX0, RY1 - RY0            # 975 × 1114

CW, CH = 1024, 1440                      # mastercanvas
CARD_W = 880.0
CARD_H = CARD_W * 1.39                   # 1223,2 — de vaste aspect-ratio
CARD_X, CARD_Y = 72.0, 160.0

S = CARD_W / RW                          # 0,9026: uniforme voorwerpschaal
SY = CARD_H / RH                         # 1,0980: verticale kaartafbeelding


def kaart_x(x: float) -> float:
    return CARD_X + (x - RX0) * S


def kaart_y(y: float) -> float:
    return CARD_Y + (y - RY0) * SY


# --- contouren ---------------------------------------------------------------
# Alle punten in referentiecoördinaten. De contouren mogen ruim zijn waar de
# sleutel `glas` of `zwart` is; bij `vast` volgen ze het silhouet.

# Alleen de zeshoek zelf: de blauwe schouder eronder is de bovenrail van de
# referentie en zou als donkere plaat ín het kaartvlak landen.
CREST = [
    (510, 34), (556, 50), (600, 78), (602, 150), (556, 186), (526, 196),
    (498, 196), (452, 156), (448, 80), (470, 52),
]

# Blad, kop, ferrule en steel van de trekker. De steel is een dunne buis: de
# contour volgt hem aan beide zijden, want een ruime contour zou met `vast` een
# baan glas meenemen.
TREKKER_BOVEN = [
    (18, 632), (24, 610), (150, 556), (240, 526), (258, 538), (262, 570),
    (252, 600), (256, 628), (254, 650), (268, 668), (300, 716), (338, 776),
    (356, 818), (354, 836), (330, 838), (306, 812), (288, 792), (250, 736),
    (218, 690), (206, 666), (188, 662), (162, 652), (146, 634), (30, 656),
]

SCHUIM_TREKKER = [
    (244, 528), (300, 536), (334, 566), (332, 610), (312, 652), (292, 674),
    (268, 668), (250, 636), (242, 594), (236, 554),
]

OPHANGING = [
    (884, 334), (948, 338), (960, 370), (950, 402), (958, 462), (972, 492),
    (964, 518), (940, 522), (954, 562), (972, 612), (990, 658), (994, 684),
    (974, 692), (948, 638), (926, 582), (904, 522), (892, 470), (886, 400),
]

EMMER = [
    (804, 654), (812, 624), (852, 604), (856, 590), (880, 584), (932, 584),
    (946, 600), (948, 618), (982, 604), (1002, 626), (1006, 652), (1000, 692),
    (994, 762), (976, 814), (958, 826), (898, 832), (846, 820), (828, 798),
    (814, 730),
]

SCHUIM_EMMER = [
    (912, 606), (992, 604), (1006, 648), (1002, 700), (988, 760), (972, 812),
    (944, 816), (926, 770), (920, 700), (906, 652),
]

TREKKER_ONDER = [
    (382, 1094), (392, 1074), (706, 928), (748, 940), (760, 976), (446, 1164),
    (404, 1162), (378, 1132),
]

BADGE = [
    (364, 1024), (642, 1024), (648, 1080), (628, 1132), (574, 1180),
    (520, 1216), (486, 1216), (430, 1180), (378, 1132), (358, 1080),
    (356, 1040),
]

SCHUIM_BOVEN_LINKS = [
    (56, 168), (74, 138), (120, 116), (190, 106), (260, 100), (336, 102),
    (340, 148), (300, 176), (240, 186), (176, 196), (128, 214), (100, 240),
    (66, 236),
]

SCHUIM_BOVEN_RECHTS = [
    (736, 108), (812, 100), (884, 104), (944, 114), (990, 134), (1014, 168),
    (1030, 212), (1024, 250), (996, 254), (966, 216), (930, 190), (872, 172),
    (804, 156), (744, 148),
]

# Schuim, zeepbellen en waterexplosie langs de onderrand, tot even binnen de
# buitenrand van het referentieschild. De onderrand van die massa is de glazen
# rail, en na de afbeelding op het canvas loopt die rail vrijwel parallel met de
# taps van het app-schild (helling 0,63 tegen 0,62) — dáárom mag hij mee. De
# bovenrand ligt op y=1000 in plaats van vlak onder het statblok: tussen de
# divisieregel van de kaart (die eindigt op 0,84 kaarthoogte) en de punt is maar
# 0,16 vrij, en donkerblauw schuim onder inkt van #2a545e is onleesbaar. Dat is
# de prijs van het rechte app-schild — de referentie heeft onder haar statblok
# ruim twee keer zoveel ruimte.
SCHUIM_ONDER = [
    (86, 1000), (978, 1000), (972, 1004), (942, 1040), (872, 1082), (787, 1122),
    (702, 1160), (622, 1190), (562, 1204), (500, 1204), (440, 1190),
    (360, 1160), (275, 1122), (190, 1082), (120, 1040), (90, 1000),
]
# Een band die de glazen rail volgt: aan de flanken mag hij hoog beginnen, in het
# midden pas onder de divisieregel van de kaart (die staat op 0,77–0,81 van de
# kaarthoogte, en de bovenrand van de massa valt daar precies over).
SCHUIM_ONDER_VOOR = [
    (96, 996), (150, 1024), (210, 1050), (300, 1064), (420, 1090), (500, 1104),
    (560, 1104), (640, 1090), (760, 1064), (850, 1050), (910, 1024),
    (966, 996), (994, 1102), (940, 1142), (870, 1184), (786, 1224),
    (700, 1260), (620, 1290), (560, 1300), (500, 1300), (440, 1290),
    (358, 1260), (272, 1224), (188, 1184), (118, 1142), (82, 1102),
]

# --- kaartinhoud en voorwerpen van de referentie ------------------------------
# Deze zones zitten in het bronbeeld ingebakken. De natte-glastextuur laat ze
# leeg; anders staat er een spookkopie van rating, naam of statblok naast de
# echte tekst, en een tweede, verschoven aftreksel van elk voorwerp naast het
# voorwerp zelf.
INHOUD = [
    (170, 186, 552, 366),      # rating 1150
    (296, 344, 396, 424),      # subniveau II
    (544, 154, 892, 502),      # avatarcirkel met ring
    (226, 580, 834, 624),      # glaslat boven de naamplaat
    (274, 628, 826, 748),      # PAPAPADEL
    (210, 744, 854, 806),      # GLAZENWASSER II met streepjes
    (170, 826, 914, 942),      # statblok
    (436, 120, 616, 228),      # onderkant van de raamcrest
    # Het losse raampje bij de rating van de referentie komt niet als voorwerp
    # terug: de kaart zet op vrijwel dezelfde plek zelf de divisie-emoji (🪟), en
    # twee ruiten naast elkaar leest als een fout. Het blijft dus alleen een gat
    # in de textuur.
    (268, 428, 402, 584),
]


# --- gereedschap -------------------------------------------------------------
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
    """Opening: losse ruispixels weg, massa behouden."""
    return dilate(erode(mask, r), r)


class Bron:
    """De referentie plus de afgeleiden die de drie sleutels nodig hebben."""

    def __init__(self) -> None:
        beeld = Image.open(REFERENTIE).convert("RGB")
        self.rgb = np.asarray(beeld).astype(np.float32)
        self.h, self.w = self.rgb.shape[:2]
        self.luma = (
            0.299 * self.rgb[..., 0]
            + 0.587 * self.rgb[..., 1]
            + 0.114 * self.rgb[..., 2]
        )
        # Grof vervaagde versie als lokaal achtergrondmodel: het gladde verloop
        # van glas en frame zit erin, water en metaal niet.
        self.afwijking = self._afwijking(22.0)
        self.detail = self._afwijking(9.0)

    def _afwijking(self, straal: float) -> np.ndarray:
        vlak = np.stack(
            [vervaag(self.rgb[..., k] / 255.0, straal) * 255.0 for k in range(3)],
            axis=-1,
        )
        return np.abs(self.rgb - vlak).mean(-1)

    def contourmasker(self, punten, feather: float) -> np.ndarray:
        m = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in punten],
                                  fill=255)
        arr = np.asarray(m).astype(np.float32) / 255.0
        return vervaag(arr, feather) if feather > 0 else arr


BRON = Bron()


class Deel:
    """Eén vrijgesleuteld onderdeel: het beeld plus de afbeelding van
    referentiecoördinaten naar canvascoördinaten. Die afbeelding is wat het
    voormasker gebruikt, zodat een maskervorm nooit los van een voorwerp kan
    verschuiven."""

    def __init__(self, naam: str, beeld: Image.Image, punten, bron,
                 fx: float, fy: float, draai: float,
                 voor_punten=None) -> None:
        self.naam = naam
        self.beeld = beeld
        self.punten = punten
        self.voor_punten = voor_punten or punten
        self.bron = bron
        self.fx, self.fy = fx, fy
        self.draai = draai
        self.plaats: tuple[int, int] | None = None
        # Middelpunt van de uitsnede vóór en ná het draaien: een expand-rotatie
        # vergroot het doek, dus het oude midden schuift mee.
        w = (bron[2] - bron[0]) * fx
        h = (bron[3] - bron[1]) * fy
        self.oud_midden = (w / 2, h / 2)
        self.nieuw_midden = (beeld.width / 2, beeld.height / 2)

    def lokaal(self, x: float, y: float) -> tuple[float, float]:
        lx = (x - self.bron[0]) * self.fx - self.oud_midden[0]
        ly = (y - self.bron[1]) * self.fy - self.oud_midden[1]
        t = math.radians(self.draai)
        rx = math.cos(t) * lx + math.sin(t) * ly
        ry = -math.sin(t) * lx + math.cos(t) * ly
        return self.nieuw_midden[0] + rx, self.nieuw_midden[1] + ry

    def canvas(self, punten) -> list[tuple[float, float]]:
        px, py = self.plaats or (0, 0)
        return [
            (px + lx, py + ly) for lx, ly in (self.lokaal(x, y) for x, y in punten)
        ]


def uitsnede(
    naam: str,
    punten,
    sleutel: str = "vast",
    feather: float = 3.0,
    drempel: float = 14.0,
    spreiding: float = 30.0,
    opening: int = 0,
    versterk: float = 1.0,
    schaal: float = 1.0,
    draai: float = 0.0,
    voor_punten=None,
) -> Deel:
    """Sleutelt één onderdeel vrij en levert het als RGBA-uitsnede."""
    xs = [p[0] for p in punten]
    ys = [p[1] for p in punten]
    x0, y0 = int(max(0, min(xs) - 12)), int(max(0, min(ys) - 12))
    x1, y1 = int(min(BRON.w, max(xs) + 12)), int(min(BRON.h, max(ys) + 12))

    contour = BRON.contourmasker(punten, feather)[y0:y1, x0:x1]
    if sleutel == "vast":
        alpha = contour
    elif sleutel == "zwart":
        alpha = np.clip((BRON.luma[y0:y1, x0:x1] - 8.0) / 42.0, 0, 1) * contour
    elif sleutel == "glas":
        ruw = np.clip(
            (BRON.afwijking[y0:y1, x0:x1] - drempel) / spreiding, 0, 1
        )
        if opening:
            houd = ontkorrel(ruw > 0.18, opening)
            ruw = ruw * vervaag(houd.astype(np.float32), 1.1)
        alpha = ruw * contour
    else:
        raise ValueError(f"onbekende sleutel {sleutel!r}")

    alpha = np.clip(alpha * versterk, 0, 1)
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = np.clip(BRON.rgb[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)

    fx = fy = S * schaal
    beeld = Image.fromarray(rgba, "RGBA").resize(
        (max(1, round((x1 - x0) * fx)), max(1, round((y1 - y0) * fy))),
        Image.LANCZOS,
    )
    if draai:
        beeld = beeld.rotate(draai, Image.BICUBIC, expand=True)
    return Deel(naam, beeld, punten, (x0, y0, x1, y1), fx, fy, draai,
                voor_punten)


def natglas(bezet: list[Deel]) -> Deel:
    """De natte glaswand van het kaartvlak: strepen, druppels en condens als
    halftransparante textuur. Anders dan een voorwerp wordt deze uitsnede óók
    verticaal met SY opgerekt — het is textuur, geen voorwerp, en lopend water
    dat meerekt met de hogere kaart leest juist natuurlijker.

    De contour volgt de bínnenrand van het referentieframe: nam de textuur de
    frameband mee, dan tekende hij een tweede lijst binnen de echte. Die
    frameband is op de referentie ruim 110 pixels dik, dus het glas beslaat maar
    76% van de kaartbreedte. De textuur wordt daarom niet op voorwerpschaal
    geplaatst maar over het hele kaartvak uitgerekt — anders bleef er een droge
    strook van 12% langs beide flanken staan."""
    binnen = [
        (400, 180), (530, 174), (660, 180), (780, 198), (858, 224), (892, 260),
        (900, 340), (904, 470), (906, 600), (902, 730), (890, 850), (864, 940),
        (816, 1010), (738, 1080), (648, 1130), (530, 1170), (412, 1130),
        (322, 1080), (244, 1010), (196, 940), (170, 850), (158, 730),
        (154, 600), (156, 470), (160, 340), (196, 260), (262, 206), (330, 188),
    ]
    xs = [p[0] for p in binnen]
    ys = [p[1] for p in binnen]
    x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))

    # Nog eens 14 pixels naar binnen: de bínnenrand van de frameband is een harde
    # lijn en die tekende zich als tweede lijst binnen de echte af.
    vrij = vervaag(
        erode(BRON.contourmasker(binnen, 0.0) > 0.5, 14).astype(np.float32), 10.0
    )
    for (ax0, ay0, ax1, ay1) in INHOUD:
        blok = np.zeros((BRON.h, BRON.w), np.float32)
        # Marge rond de zone: glyphtoppen lopen tot aan de rand, en met alleen
        # een vervaagde doos bleef daar een leesbaar restje van staan.
        blok[max(0, ay0 - 14):ay1 + 14, max(0, ax0 - 14):ax1 + 14] = 1.0
        vrij *= 1.0 - vervaag(blok, 7.0)
    # En de voorwerpen zelf: die staan al als eigen uitsnede op het canvas, dus
    # hun aftreksel in de textuur zou er verschoven náást komen te staan. Ruim om
    # de contour heen: schaduw, bellen en spatten rond een voorwerp horen erbij.
    for deel in bezet:
        vrij *= 1.0 - BRON.contourmasker(schaalContour(deel.punten, 1.16), 10.0)

    # Drempel ruim boven de filmkorrel van de referentie: op 3 lag er een
    # gelijkmatige waas over het hele vlak in plaats van strepen en druppels.
    alpha = np.clip((BRON.detail - 10.0) / 26.0, 0, 1) * 0.46 * vrij
    rgba = np.zeros((BRON.h, BRON.w, 4), np.uint8)
    rgba[..., :3] = np.clip(BRON.rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    fx = CARD_W * 1.05 / (x1 - x0)
    fy = CARD_H * 1.03 / (y1 - y0)
    beeld = Image.fromarray(rgba, "RGBA").crop((x0, y0, x1, y1)).resize(
        (round((x1 - x0) * fx), round((y1 - y0) * fy)), Image.LANCZOS
    )
    return Deel("natglas", beeld, binnen, (x0, y0, x1, y1), fx, fy, 0.0)


# --- compositie --------------------------------------------------------------
PLAATSING: dict[str, tuple[int, int, int, int]] = {}


def plaats(doel: Image.Image, deel: Deel, dfx: float = 0.0, dfy: float = 0.0,
           midden: tuple[float, float] | None = None) -> Deel:
    """Zet een uitsnede op zijn kaartfractie, met een correctie in
    kaartbreedtes/-hoogtes. Het anker is het midden van de uitsnede; `midden`
    overschrijft dat met een absoluut canvaspunt (de natte-glastextuur wordt over
    het hele kaartvak uitgerekt en volgt dus niet de voorwerpafbeelding)."""
    x0, y0, x1, y1 = deel.bron
    mx = (midden[0] if midden else kaart_x((x0 + x1) / 2)) + dfx * CARD_W
    my = (midden[1] if midden else kaart_y((y0 + y1) / 2)) + dfy * CARD_H
    px = round(mx - deel.beeld.width / 2)
    py = round(my - deel.beeld.height / 2)
    doel.alpha_composite(deel.beeld, (px, py))
    deel.plaats = (px, py)
    ALLE.append(deel)
    PLAATSING[deel.naam] = (px, py, px + deel.beeld.width,
                            py + deel.beeld.height)
    return deel


def schaalContour(punten, factor: float):
    """Contour om zijn zwaartepunt schalen. Kleiner dan 1 voor het voormasker —
    een maskerrand die bínnen de uitsnede eindigt verbergt de rechte snederand,
    een ruimere rand toont hem. Groter dan 1 om ruim rond een voorwerp te
    kunnen wissen."""
    cx = sum(p[0] for p in punten) / len(punten)
    cy = sum(p[1] for p in punten) / len(punten)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in punten]


def pad(punten) -> str:
    kop = f"M{punten[0][0]:.0f} {punten[0][1]:.0f}"
    rest = " ".join(f"L{x:.0f} {y:.0f}" for x, y in punten[1:])
    return f"{kop} {rest} Z"


ALLE: list[Deel] = []


def bouw() -> tuple[Image.Image, list[Deel]]:
    doel = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    # Eerst alle voorwerpen sleutelen; de natte-glastextuur moet weten waar ze
    # zitten voordat hij zijn eigen alpha bepaalt.
    crest = uitsnede("crest", CREST, "zwart", feather=4.0, schaal=1.08)
    # De bovenrand van de referentie boogt omhoog naar het midden; die van het
    # app-schild is vlak. Elk hoekstuk wordt daarom rechtgedraaid, anders duikt
    # het schuim aan één kant het kaartvlak in en zweeft het aan de andere.
    schuim_bl = uitsnede("schuim-boven-links", SCHUIM_BOVEN_LINKS, "zwart",
                         feather=7.0, draai=-7.0)
    schuim_br = uitsnede("schuim-boven-rechts", SCHUIM_BOVEN_RECHTS, "zwart",
                         feather=7.0, draai=7.0)
    schuim_o = uitsnede("schuim-onder", SCHUIM_ONDER, "glas", feather=9.0,
                        drempel=9.0, spreiding=26.0, opening=1, versterk=1.15,
                        schaal=0.70, voor_punten=SCHUIM_ONDER_VOOR)
    trekker_b = uitsnede("trekker-boven", TREKKER_BOVEN, "vast", feather=2.5)
    schuim_t = uitsnede("schuim-trekker", SCHUIM_TREKKER, "glas", feather=5.0,
                        drempel=10.0, spreiding=26.0)
    ophanging = uitsnede("ophanging", OPHANGING, "glas", feather=4.0,
                         drempel=11.0, spreiding=24.0, opening=1)
    emmer = uitsnede("emmer", EMMER, "vast", feather=3.0)
    schuim_e = uitsnede("schuim-emmer", SCHUIM_EMMER, "glas", feather=5.0,
                        drempel=10.0, spreiding=26.0)
    badge = uitsnede("badge", BADGE, "vast", feather=3.0, schaal=0.95)
    # Platter en kleiner dan de referentie: de taps van het app-schild is korter,
    # dus een trekker op referentieschaal zou linksonder ver naast de punt hangen.
    trekker_o = uitsnede("trekker-onder", TREKKER_ONDER, "vast", feather=2.5,
                         schaal=0.82, draai=-10.0)

    voorwerpen = [crest, schuim_bl, schuim_br, trekker_b, schuim_t, ophanging,
                  emmer, schuim_e, badge, trekker_o]

    # 1. Natte glaswand: onderste laag, want alles ligt er in de referentie op.
    plaats(doel, natglas(voorwerpen),
           midden=(CARD_X + CARD_W / 2, CARD_Y + CARD_H / 2))

    # 2. Schuim en water over de bovenhoeken.
    plaats(doel, schuim_bl, dfy=-0.006)
    plaats(doel, schuim_br, dfy=-0.006)

    # 3. Waterexplosie, schuim en zeepbellen langs de onderrand. Kleiner dan de
    #    referentie. Schaal en verschuiving zijn samen zo gekozen
    #    dat twee dingen tegelijk kloppen: de bovenrand van de massa blijft onder
    #    de divisieregel (0,84 kaarthoogte) en de glazen rail eronder valt precies
    #    op de schildrand. Groter kan niet — de afstand tussen die twee in het
    #    artwork schaalt mee, en de sleuf van het app-schild doet dat niet.
    plaats(doel, schuim_o, dfy=0.018)

    # 5. De trekker linksboven, met het schuim aan zijn blad. Iets hoger dan de
    #    referentie, zodat de steel bóven de naamplaat eindigt.
    plaats(doel, trekker_b, dfx=-0.012, dfy=-0.022)
    plaats(doel, schuim_t, dfx=-0.012, dfy=-0.022)

    # 6. Ophanging en sopemmer aan de rechterflank. Naar buiten en naar onder:
    #    op de referentieplek zou de emmer de onderste helft van de avatar
    #    bedekken, en het is juist de breakout die hem draagt.
    for deel in (ophanging, emmer, schuim_e):
        plaats(doel, deel, dfx=0.055, dfy=0.075)

    # 7. Schildbadge en de tweede trekker in de punt, onder de divisieregel.
    plaats(doel, badge, dfy=0.012)
    plaats(doel, trekker_o, dfy=0.05)

    # 8. De raamcrest boven de bovenrand.
    plaats(doel, crest, dfy=0.004)

    voor = [crest, schuim_bl, schuim_br, trekker_b, schuim_t, ophanging, emmer,
            schuim_e, trekker_o, badge, schuim_o]
    return doel, voor


def schrijf_masker(bestand: Path, delen: list[Deel], titel: str,
                   blur: int) -> None:
    regels = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} {CH}">',
        f"  <!-- {titel} -->",
        "  <defs>",
        '    <filter id="zacht" x="-14%" y="-14%" width="128%" height="128%">',
        f'      <feGaussianBlur stdDeviation="{blur}" />',
        "    </filter>",
        "  </defs>",
        f'  <rect width="{CW}" height="{CH}" fill="#000" />',
        '  <g fill="#fff" filter="url(#zacht)">',
    ]
    for deel in delen:
        regels.append(f"    <!-- {deel.naam} -->")
        regels.append(
            f'    <path d="{pad(schaalContour(deel.canvas(deel.voor_punten), 0.955))}" />'
        )
    regels += ["  </g>", "</svg>", ""]
    bestand.write_text("\n".join(regels), encoding="utf8")


def layoutdump(delen: list[Deel]) -> None:
    """Print per onderdeel twee dingen, in het formaat dat
    `glazenwasser/glazenwasserLayout.ts` gebruikt:

    * `bron` — de uitsnede in mastercanvas-pixels. Daarmee kan een component één
      laag uit het bestaande WebP knippen zonder een nieuw bestand;
    * `doel` — waar datzelfde onderdeel in de *referentie* staat, als fractie van
      het referentiekaartvak. Dat is de compositie die de brede divisiekaart
      reconstrueert: de verschuivingen, schalen en draaiingen hierboven zijn
      correcties voor het smalle FutKaart-schild en horen daar niet in mee.
    """
    print("\n// bron: [x, y, breedte, hoogte] in mastercanvas-pixels "
          f"({CW} × {CH})")
    print("// doel: [left, top, breedte, hoogte] als fractie van het kaartvak")
    for deel in delen:
        if deel.plaats is None:
            continue
        px, py = deel.plaats
        bw, bh = deel.beeld.width, deel.beeld.height
        # Referentiemaat van de (eventueel gedraaide) uitsnede.
        rw, rh = bw / deel.fx, bh / deel.fy
        x0, y0, x1, y1 = deel.bron
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        left = (cx - rw / 2 - RX0) / RW
        top = (cy - rh / 2 - RY0) / RH
        print(f"  {deel.naam}: bron [{px}, {py}, {bw}, {bh}], "
              f"doel [{left:.4f}, {top:.4f}, {rw / RW:.4f}, {rh / RH:.4f}],")


def main() -> int:
    doel, voor = bouw()
    UIT.mkdir(parents=True, exist_ok=True)

    master = UIT / "glazenwasser-master.webp"
    doel.save(master, "WEBP", quality=KWALITEIT, method=6)

    schrijf_masker(
        UIT / "glazenwasser-front-mask.svg",
        voor,
        "Voorselectie: de onderdelen die in de referentie óver het frame liggen "
        "— raamcrest, hoekschuim, waterslierten op de lijst, beide trekkers, "
        "ophanging met sopemmer, schildbadge en de onderste helft van de "
        "waterexplosie. Elke vorm is de ingekrompen contour van het "
        "bijbehorende onderdeel uit scripts/glazenwasser-master.py, dus een "
        "maskervorm kan niet los van een voorwerp verschuiven.",
        blur=9,
    )

    print(f"{master.relative_to(WORTEL)}: {doel.size[0]}×{doel.size[1]}, "
          f"{master.stat().st_size // 1024} kB")
    print(f"kaartvak: x {CARD_X:.0f}..{CARD_X + CARD_W:.0f}, "
          f"y {CARD_Y:.0f}..{CARD_Y + CARD_H:.0f}")
    print(f"css: left {-CARD_X / CARD_W * 100:.2f}%, "
          f"top {-CARD_Y / CARD_H * 100:.2f}%, width {CW / CARD_W * 100:.2f}%")
    for naam, doos in PLAATSING.items():
        print(f"  {naam}: {doos}")

    if "--layout" in sys.argv:
        layoutdump(ALLE)

    if "--preview" in sys.argv:
        plaat = Image.new("RGB", doel.size, (12, 16, 24))
        plaat.paste(doel, (0, 0), doel)
        tek = ImageDraw.Draw(plaat)
        tek.rectangle(
            [CARD_X, CARD_Y, CARD_X + CARD_W, CARD_Y + CARD_H],
            outline=(0, 255, 136), width=3,
        )
        pad_uit = WORTEL / "screenshots" / "glazenwasser" / "master-preview.png"
        pad_uit.parent.mkdir(parents=True, exist_ok=True)
        plaat.save(pad_uit)
        print(f"{pad_uit.relative_to(WORTEL)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
