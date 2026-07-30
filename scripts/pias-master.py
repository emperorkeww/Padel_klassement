#!/usr/bin/env python3
"""Bouwt het pias-master-artwork uit docs/referentie_pias.png.

Anders dan de andere breakout-masters is dit artwork volledig afgeleid van een
bestand dat in de repo staat: de referentie zelf. Dit script is dus de bron van
waarheid voor `src/features/rating/components/pias/assets/pias-master.webp` —
bij een gewijzigde referentie of een andere uitsnede draai je het opnieuw
in plaats van het WebP met de hand bij te werken.

    python3 scripts/pias-master.py            # schrijft het WebP
    python3 scripts/pias-master.py --preview  # schrijft ook een controlebeeld

Afhankelijkheden staan bewust buiten de npm-toolchain (dit is een eenmalige
assetstap, geen build- of runtime-afhankelijkheid): Python 3 met numpy en
Pillow.

Werking, in twee keyings:

  * Buiten de kaart staat de referentie op zwart. Een luminantiekey levert daar
    zachte randen voor rook, stof en confetti; donkere massieve objecten
    (klaverteken, schaakpion, kolen) zouden door diezelfde key doorzichtig
    worden, dus die krijgen een floodfill: wat binnen hun ROI niet vanaf de
    ROI-rand via bijna-zwart bereikbaar is, hoort bij het object.
  * Binnen de kaart moeten juist perkament, frame en kaartinhoud weg, maar
    moeten de objecten die er in de referentie overheen liggen (kroon, rozet,
    lint, narrenkop, bagel, speelkaarten, pion, klaver) compleet blijven. Per
    handgetekende contour wordt daarom een lokaal perkamentmodel gefit op de
    ring rond de contour; wat daar ver genoeg vanaf ligt is object.

De kaartuitsnede (POLY) volgt de buitenrand van het frame in de referentie. Het
resultaat is een transparante ornamentring van 1024 × 1365 met een leeg midden;
de registratie ervan staat in PiasEffect.css.

Daarna volgt de stap die de props aan de kaart vastzet. De referentiekaart houdt
rechte flanken tot ~88% hoogte en knijpt pas daaronder naar zijn punt; het
app-schild (`#fut-schild-notch`) loopt al vanaf 60% hoogte naar binnen. Alles wat
in de referentie de kaartrand markeert — narrenkop, speelkaarten, de twee
lintbogen — staat daardoor in de app náást de kaart in de lucht in plaats van
tegen de rand aan. De onderste helft van de ring wordt daarom horizontaal
meegetrokken met de schuine rand van het écht gebruikte schild (§"Vormverschil
tussen referentie en app-schild" in docs/special-card-visual-effects-architecture.md).
Dezelfde schuif bepaalt het frontmasker, dat dit script daarom meeschrijft: mask
en master kunnen niet los van elkaar verlopen.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "referentie_pias.png"
ASSETS = WORTEL / "src/features/rating/components/pias/assets"
DOEL = ASSETS / "pias-master.webp"
MASKER = ASSETS / "pias-front-mask.svg"
# Werkcanvas: hierin staan FRONT_GROEPEN en de viewBox van het frontmasker. Het
# masker is vector, dus deze maat kost niets en blijft de leesbare rekenruimte.
BREEDTE = 1024
# Uitvoermaat van het WebP. Bewust kleiner dan het werkcanvas: het ingecheckte
# artwork stond al op 768 en de bundel zit met ~9,8 MB dicht tegen de grens van
# 10 MB uit assetBudget.test.ts. Het register is percentagegebaseerd, dus alleen
# de scherpte hangt hieraan — de compositie niet. Dat het script tot nu toe 1024
# schreef terwijl er 768 was ingecheckt, was een stille afwijking; die staat hier
# nu expliciet.
RASTER_BREEDTE = 768
KWALITEIT = 86

# De kaartbox van de app in referentiecoördinaten. Dit is geen smaakinstelling
# maar de terugrekening van de drie registratiewaarden in PiasEffect.css: het
# kaartvak ligt in het master-canvas (1024 × 1365) op x 116…908 en y 109…1210, en
# 1086/1024 zet die terug in referentiepixels. De hoogte volgt daarmee de
# 100 × 139-verhouding van het schild (840 × 1,39 = 1167,6) en niet de iets
# langere kaart van de referentie zelf.
KAART_X0, KAART_B = 123.0, 840.0
KAART_Y0, KAART_H = 115.6, 1167.6

# #fut-schild-notch uit FutKaart.tsx, in objectBoundingBox-eenheden. De pias
# draagt de default-schildvorm; dit pad is dus letterlijk de rand waar de props
# tegenaan moeten liggen.
NOTCH = [
    ("M", (0.085, 0.0)),
    ("L", (0.40, 0.0)),
    ("C", (0.44, 0.0), (0.46, 0.022), (0.5, 0.022)),
    ("C", (0.54, 0.022), (0.56, 0.0), (0.60, 0.0)),
    ("L", (0.915, 0.0)),
    ("C", (0.962, 0.0), (1.0, 0.028), (1.0, 0.062)),
    ("L", (1.0, 0.60)),
    ("C", (1.0, 0.74), (0.955, 0.795), (0.865, 0.838)),
    ("L", (0.565, 0.972)),
    ("C", (0.545, 0.982), (0.523, 1.0), (0.5, 1.0)),
    ("C", (0.477, 1.0), (0.455, 0.982), (0.435, 0.972)),
    ("L", (0.135, 0.838)),
    ("C", (0.045, 0.795), (0.0, 0.74), (0.0, 0.60)),
    ("L", (0.0, 0.062)),
    ("C", (0.0, 0.028), (0.038, 0.0), (0.085, 0.0)),
]

# Hoever een rij maximaal mee mag schuiven. De volle afstand tot de schildrand
# loopt onderaan op tot ~145 px; over de verticale ramp geeft dat een helling van
# ~0,8 en dan smeren de lintlussen uit tot vegen. Op 120 kantelen ze mee zonder
# hun vorm te verliezen — dezelfde grens als bij de kettingen van de Piet.
SCHUIF_MAX = 120.0
# Verticaal venster van de schuif, in referentiepixels. Het staat opzettelijk
# ruim bóven de hoogte waar de schuif inzet (y ≈ 955): de zachte aanloop komt al
# uit de meetkunde, want daar lopen schild en referentierand nog samen. Een ramp
# die pas dáár opent, telt zijn eigen helling bij de meetkundige op — de schuif
# klom dan 1,2 px per rij en dat scheert de lintlussen zichtbaar schuin. Zo blijft
# de helling die van de kaartvorm zelf, ~0,6.
RAMP0, RAMP1 = 820.0, 1000.0
# Het centrale medaillon met zijn rozet schuift niet mee: het hoort op de
# onderas van de kaart te blijven staan. Deze zone dekt bovendien de plek waar de
# schuif van teken wisselt, zodat de doorlopende lintboog daar geen naad krijgt.
ROZET_ZONE = (543.0, 1288.0, 232.0, 140.0)
# Ruim: de zone gaat van volle schuif naar nul, en over 18 px knikt de gouden bies
# van het lint zichtbaar. Over ~140 px leest dezelfde overgang als de natuurlijke
# torsie van een lint dat om het medaillon draait.
ROZET_ZACHT = 48.0
# De rozet van de referentie staat 5 px rechts van de kaartas; op de kaart leest
# dat als een medaillon dat niet in het midden hangt. Binnen de rozetzone — waar
# de rand-schuif juist nul is — schuift het medaillon die 5 px terug naar de as.
# Het verschil is klein genoeg om over de zachte zonerand te verlopen zonder de
# aansluitende lintboog te vervormen.
ROZET_AS = 5.0
# Na de schuif komt materiaal dat búiten de referentiekaart lag binnen het schild
# terecht. Voor de props is dat precies de bedoeling; voor los kolengruis niet —
# de sliert onder de narrenkop kwam zo tot ~200 px in het kaartvlak en eindigde
# tegen de editieregel. Het assetcontract houdt gruis binnen 132 px van de
# kaartrand; deze grens handhaaft dat ná de schuif. Alleen onderaan, want daar is
# de schuif actief. Hij meet horizontaal: dat is de richting waarin de schuif
# werkt, en de schildpunt is daar zo smal dat het medaillon er niet onder valt.
VUIL_DIEPTE = 132.0
VUIL_Y0 = 960.0

# De negen objectgroepen die vóór het kaartframe mogen komen. Voorheen stonden
# deze ellipsen met de hand in pias-front-mask.svg; sinds de props met de
# schildrand meeschuiven kan dat niet meer — een mask dat blijft staan laat de
# verschoven prop half achter het frame vallen. De coördinaten zijn
# master-pixels (1024 × 1365); het script legt de schuif er zelf op.
FRONT_GROEPEN = [
    ("kroon", 514, 150, 196, 128, 0),
    ("klaver", 890, 200, 108, 98, 0),
    ("pion", 952, 552, 92, 140, 0),
    ("kaarten", 906, 872, 128, 142, 0),
    # Krapper dan de andere groepen, en dat is bewust: onder de narrenkop loopt
    # een sliert kolengruis door tot in de schildpunt. Dat is geen object maar
    # vuil, en sinds de kop met de rand mee naar binnen schuift, valt die sliert
    # binnen het kaartvlak — met een ruimer venster kwam hij vóór het frame en
    # dus óver de editieregel te liggen. Het venster dekt nu kap, bellen en
    # plooikraag, en stopt boven het gruis.
    ("nar", 104, 866, 124, 150, 0),
    ("bagel", 110, 566, 122, 120, 0),
    ("rozet", 516, 1192, 172, 96, 0),
    ("lint-links", 262, 1172, 152, 86, -14),
    ("lint-rechts", 782, 1172, 152, 86, 14),
]

# Buitenrand van het kaartframe in de referentie (1086 × 1448).
KAART = [
    (543, 116), (640, 120), (730, 138), (820, 170), (893, 212), (940, 262),
    (960, 320), (963, 640), (958, 880), (944, 1040), (900, 1140), (800, 1215),
    (680, 1272), (543, 1302), (406, 1272), (286, 1215), (186, 1140), (142, 1040),
    (128, 880), (123, 640), (126, 320), (146, 262), (193, 212), (266, 170),
    (356, 138), (446, 120),
]

# Objecten die in de referentie óver de kaart liggen. De contour mag ruim zijn:
# de kleurkey binnen de contour houdt het perkament eruit. De derde waarde is de
# drempel (som van de RGB-afwijking) waarboven een pixel object heet.
KROON = [
    (543, 44), (585, 36), (640, 28), (681, 44), (701, 74), (692, 110), (664, 130),
    (700, 148), (690, 176), (655, 187), (649, 200), (646, 233), (628, 248),
    (543, 252), (458, 248), (440, 233), (437, 200), (431, 187), (396, 176),
    (386, 148), (422, 130), (394, 110), (385, 74), (405, 44), (446, 28), (501, 36),
]
NAR = [
    (0, 792), (58, 770), (120, 760), (176, 770), (214, 788), (234, 812), (231, 846),
    (213, 864), (206, 884), (214, 918), (211, 962), (199, 1002), (217, 1022),
    (223, 1052), (210, 1086), (180, 1110), (120, 1122), (50, 1114), (10, 1092),
    (0, 1062),
]
BAGEL = [
    (18, 518), (60, 496), (110, 490), (161, 504), (201, 530), (223, 570), (229, 611),
    (222, 652), (200, 680), (160, 700), (110, 705), (60, 692), (24, 660), (6, 610),
    (6, 558),
]
KAARTEN = [
    (852, 862), (880, 830), (930, 816), (985, 798), (1022, 790), (1044, 800),
    (1058, 880), (1071, 990), (1052, 1030), (1000, 1048), (950, 1052), (918, 1032),
    (888, 1002), (864, 960), (850, 900),
]
PION = [
    (958, 470), (990, 452), (1024, 452), (1052, 474), (1058, 508), (1040, 534),
    (1060, 566), (1072, 610), (1080, 660), (1074, 700), (1040, 716), (1000, 706),
    (972, 676), (958, 630), (952, 574), (944, 528), (940, 496),
]
KLAVER = [
    (905, 138), (950, 128), (988, 146), (1000, 182), (1030, 186), (1046, 214),
    (1034, 248), (1000, 258), (982, 286), (950, 300), (920, 288), (906, 260),
    (874, 254), (856, 226), (866, 192), (896, 180),
]
ROZET = [
    (392, 1256), (406, 1222), (440, 1204), (470, 1212), (486, 1196), (516, 1184),
    (548, 1180), (580, 1186), (604, 1200), (628, 1210), (658, 1206), (690, 1224),
    (704, 1256), (694, 1292), (660, 1316), (612, 1330), (548, 1342), (486, 1330),
    (438, 1316), (404, 1292),
]
LINT = [
    (78, 1108), (140, 1086), (206, 1104), (268, 1146), (330, 1186), (400, 1218),
    (470, 1240), (543, 1248), (616, 1240), (686, 1218), (756, 1186), (818, 1146),
    (880, 1104), (946, 1086), (1008, 1108), (1020, 1180), (990, 1240), (940, 1284),
    (880, 1300), (820, 1290), (760, 1306), (680, 1326), (600, 1338), (543, 1340),
    (486, 1338), (406, 1326), (326, 1306), (266, 1290), (206, 1300), (146, 1284),
    (96, 1240), (66, 1180),
]
OBJECTEN = [
    ("kroon", KROON, 46), ("nar", NAR, 44), ("bagel", BAGEL, 52),
    ("kaarten", KAARTEN, 44), ("pion", PION, 40), ("klaver", KLAVER, 40),
    ("rozet", ROZET, 44), ("lint", LINT, 46),
]

# ROI's waarin donkere massieve objecten met een floodfill worden dichtgezet.
DONKERE_ROI = [
    (828, 118, 1050, 322), (900, 430, 1086, 770), (820, 756, 1086, 1200),
    (0, 760, 300, 1180), (0, 440, 280, 790), (60, 1060, 1050, 1345),
    (330, 10, 760, 280),
]

# Kaartinhoud die nooit in het ornament mag belanden.
INHOUD = [
    (336, 1096, 716, 1206),  # badgerij onder de statistiek
    # Stukken referentieframe die tussen objecten door zichtbaar blijven en
    # anders als tweede gouden rand naast het echte frame zouden verschijnen.
    (922, 762, 972, 1104),   # tussen de twee speelkaarten
    (138, 742, 188, 864),    # tussen de twee horens van de narrenkap
]

# Zones waar het gruis wegblijft: daar zou dezelfde detectie de kaarttekst zelf
# oppikken.
TEKST = [
    (150, 240, 600, 470), (560, 240, 968, 680), (150, 640, 940, 1000),
    (150, 1000, 940, 1215),
]


def dilate(mask: np.ndarray, r: int = 1) -> np.ndarray:
    out = mask
    for _ in range(r):
        p = np.pad(out, 1, constant_values=False)
        out = (
            p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
            | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
        )
    return out


def erode(mask: np.ndarray, r: int = 1) -> np.ndarray:
    return ~dilate(~mask, r)


def _flood(mask: np.ndarray, seeds, max_iter: int = 4000) -> np.ndarray:
    cur = np.zeros_like(mask)
    for (x, y) in seeds:
        cur[y, x] = True
    cur &= mask
    for _ in range(max_iter):
        nxt = dilate(cur, 1) & mask
        if nxt.sum() == cur.sum():
            return cur
        cur = nxt
    return cur


def flood(mask: np.ndarray, seeds, factor: int = 4) -> np.ndarray:
    """Verbonden component: eerst grof op een verkleining, daarna afwerken."""
    h, w = mask.shape
    hh, ww = h // factor, w // factor
    klein = mask[: hh * factor, : ww * factor].reshape(hh, factor, ww, factor)
    klein = klein.mean(axis=(1, 3)) > 0.5
    grof = [
        (min(x // factor, ww - 1), min(y // factor, hh - 1)) for (x, y) in seeds
    ]
    grof = [s for s in grof if klein[s[1], s[0]]]
    cur = np.zeros((h, w), bool)
    if grof:
        gegroeid = _flood(klein, grof)
        cur[: hh * factor, : ww * factor] = np.repeat(
            np.repeat(gegroeid, factor, 0), factor, 1
        )
        cur &= mask
    for (x, y) in seeds:
        cur[y, x] = mask[y, x]
    for _ in range(factor * 6):
        nxt = dilate(cur, 1) & mask
        if nxt.sum() == cur.sum():
            break
        cur = nxt
    return cur


def vul_gaten(mask: np.ndarray) -> np.ndarray:
    inv = ~mask
    h, w = inv.shape
    seeds = [(x, y) for x in range(0, w, 8) for y in (0, h - 1) if inv[y, x]]
    seeds += [(x, y) for y in range(0, h, 8) for x in (0, w - 1) if inv[y, x]]
    return ~flood(inv, seeds)


def randseeds(sub: np.ndarray):
    hh, ww = sub.shape
    seeds = [(x, y) for x in range(0, ww, 3) for y in (0, hh - 1) if sub[y, x]]
    seeds += [(x, y) for y in range(0, hh, 3) for x in (0, ww - 1) if sub[y, x]]
    return seeds


def vervaag(mask: np.ndarray, straal: float) -> np.ndarray:
    img = Image.fromarray((mask * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(straal)
    )
    return np.asarray(img).astype(np.float32) / 255.0


def ontkorrel(mask: np.ndarray, r: int = 2) -> np.ndarray:
    return dilate(erode(mask, r), r)


def smoothstep(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def schildpunten() -> list[tuple[float, float]]:
    """Het app-schild als polygoon in referentiepixels."""

    def naar_ref(p):
        return (KAART_X0 + p[0] * KAART_B, KAART_Y0 + p[1] * KAART_H)

    punten: list[tuple[float, float]] = []
    huidig = None
    for seg in NOTCH:
        if seg[0] in ("M", "L"):
            huidig = seg[1]
            punten.append(naar_ref(huidig))
            continue
        p0, (c1, c2, p3) = huidig, seg[1:]
        for i in range(1, 25):
            t = i / 24.0
            m = 1.0 - t
            x = (m ** 3 * p0[0] + 3 * m * m * t * c1[0]
                 + 3 * m * t * t * c2[0] + t ** 3 * p3[0])
            y = (m ** 3 * p0[1] + 3 * m * m * t * c1[1]
                 + 3 * m * t * t * c2[1] + t ** 3 * p3[1])
            punten.append(naar_ref((x, y)))
        huidig = p3
    return punten


def randen(masker: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Linker- en rechterrand per rij; NaN op rijen zonder masker."""
    H = masker.shape[0]
    links = np.full(H, np.nan, np.float32)
    rechts = np.full(H, np.nan, np.float32)
    for y in range(H):
        kol = np.nonzero(masker[y])[0]
        if len(kol):
            links[y] = kol[0]
            rechts[y] = kol[-1]
    return links, rechts


def houd_vast(reeks: np.ndarray) -> np.ndarray:
    """Gaten in een rijtabel dichten door de laatste bekende waarde vast te houden.

    Nodig onder de kaartpunt: daar bestaat geen schildrand meer, terwijl de
    lintstaarten van de referentie nog 40 px doorlopen. Zonder vasthouden valt de
    schuif daar in één rij naar nul terug en knakt het lint precies op de punt.
    """
    uit = reeks.copy()
    laatst = 0.0
    for i in range(len(uit)):
        if np.isfinite(uit[i]):
            laatst = float(uit[i])
        else:
            uit[i] = laatst
    return uit


def schuifveld(kaart_rand: np.ndarray, app_schild: np.ndarray) -> np.ndarray:
    """Horizontale verschuiving per pixel die de props op de schildrand zet.

    De verschuiving mag alléén van y afhangen. Loopt ze ook met x mee, dan rékt
    ze de lintlussen en de plooikraag van de narrenkop uit tot vegen; een schuif
    die enkel van y afhangt kantelt ze, en kantelen is precies wat een prop langs
    een schuine rand doet.

    Anders dan bij de kettingen van de Piet mag de schuif hier *niet* op de
    schildrand worden uitgezet. De pias-props liggen met opzet half óver de kaart
    — de speelkaarten rechts en de plooikraag linksonder steken allebei het
    kaartvlak in — dus een schuif die binnen het schild op nul valt, scheurt zo'n
    prop precies op die rand in twee. Het kaartvlak is in de master toch
    transparant, dus binnen het schild valt er niets te beschermen: elke prop
    schuift als één geheel.
    """
    H, W = app_schild.shape
    ref_l, ref_r = randen(kaart_rand)
    app_l, app_r = randen(app_schild)
    schuif_l = houd_vast(np.clip(app_l - ref_l, 0.0, SCHUIF_MAX))
    schuif_r = houd_vast(np.clip(ref_r - app_r, 0.0, SCHUIF_MAX))

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ramp = smoothstep(yy, RAMP0, RAMP1)
    cx, cy, rx, ry = ROZET_ZONE
    rozet = Image.new("L", (W, H), 0)
    ImageDraw.Draw(rozet).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    rozet = np.asarray(
        rozet.filter(ImageFilter.GaussianBlur(ROZET_ZACHT))
    ).astype(np.float32) / 255.0

    gewicht = ramp * (1.0 - rozet)
    as_x = KAART_X0 + KAART_B / 2.0
    rand = np.where(xx < as_x, schuif_l[:, None], -schuif_r[:, None]) * gewicht
    return rand - ROZET_AS * rozet


def herbemonster(alpha: np.ndarray, premul: np.ndarray, sx: np.ndarray,
                 sy: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Alfa en voorgemultipliceerde kleur op (sx, sy) — bilineair."""
    H, W = alpha.shape
    x0 = np.clip(np.floor(sx), 0, W - 2).astype(np.int32)
    y0 = np.clip(np.floor(sy), 0, H - 2).astype(np.int32)
    fx = np.clip(sx - x0, 0.0, 1.0)[:, :, None]
    fy = np.clip(sy - y0, 0.0, 1.0)[:, :, None]
    x1, y1 = x0 + 1, y0 + 1

    def mix(v):
        boven = v[y0, x0] * (1 - fx) + v[y0, x1] * fx
        onder = v[y1, x0] * (1 - fx) + v[y1, x1] * fx
        return boven * (1 - fy) + onder * fy

    return mix(alpha[:, :, None])[:, :, 0], mix(premul)


def bouw() -> tuple[Image.Image, np.ndarray]:
    bron = Image.open(REFERENTIE).convert("RGB")
    a = np.asarray(bron).astype(np.int16)
    H, W = a.shape[:2]
    A = a.astype(np.float32)
    luma = 0.299 * A[..., 0] + 0.587 * A[..., 1] + 0.114 * A[..., 2]

    def contour(punten) -> np.ndarray:
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon(punten, fill=255)
        return np.asarray(m) > 127

    def vak(x0, y0, x1, y1) -> np.ndarray:
        m = np.zeros((H, W), bool)
        m[y0:y1, x0:x1] = True
        return m

    kaartvorm = contour(KAART)
    kaart = dilate(kaartvorm, 14)

    # --- buiten de kaart: zwartkey plus dichtgezette donkere objecten
    alpha = np.clip((luma - 6) / 34.0, 0, 1)
    donker = luma < 26
    for (x0, y0, x1, y1) in DONKERE_ROI:
        sub = donker[y0:y1, x0:x1]
        seeds = randseeds(sub)
        if not seeds:
            continue
        achtergrond = flood(sub, seeds, factor=2)
        solide = ontkorrel(~achtergrond & sub, 3)
        zacht = np.asarray(
            Image.fromarray((solide * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(1.2)
            )
        ).astype(np.float32) / 255.0
        alpha[y0:y1, x0:x1] = np.maximum(alpha[y0:y1, x0:x1], zacht)

    # --- binnen de kaart: alles weg, daarna de objecten per contour terug
    alpha[kaart] = 0

    verboden = erode(kaart, 115)
    for (x0, y0, x1, y1) in INHOUD:
        verboden |= vak(x0, y0, x1, y1)

    ys, xs = np.mgrid[0:H, 0:W]
    u = (xs.astype(np.float32) - W / 2) / (W / 2)
    v = (ys.astype(np.float32) - H / 2) / (H / 2)
    lineair = np.stack([np.ones_like(u), u, v], -1)
    R_, G_, B_ = A[..., 0], A[..., 1], A[..., 2]
    perkamentachtig = (
        (R_ > 150) & (R_ - B_ > 45) & (R_ - B_ < 145) & (G_ - B_ > 18) & (luma > 105)
    )

    binnen = np.zeros((H, W), np.float32)
    for _naam, punten, tol in OBJECTEN:
        vorm = contour(punten) & kaart & ~verboden
        if not vorm.any():
            continue
        ring = (dilate(vorm, 26) & ~vorm) & erode(kaart, 18) & perkamentachtig
        if ring.sum() < 400:
            ring = erode(kaart, 18) & perkamentachtig & dilate(vorm, 70) & ~vorm
        coef = np.linalg.lstsq(lineair[ring], A[ring], rcond=None)[0]
        for _ in range(3):
            rest = np.abs(A - lineair @ coef).sum(-1)
            houd = ring & (rest < max(60, np.percentile(rest[ring], 70)))
            coef = np.linalg.lstsq(lineair[houd], A[houd], rcond=None)[0]
        rest = np.abs(A - lineair @ coef).sum(-1)
        ruw = vul_gaten(ontkorrel((rest > tol) & vorm, 2)) & vorm
        binnen = np.maximum(binnen, vervaag(ruw, 1.3) * vorm)
    alpha = np.maximum(alpha, binnen)

    # --- kolengruis, gouddeeltjes en confetti vlak langs de rand van de kaart
    med = np.asarray(
        Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.MedianFilter(9))
    ).astype(np.float32)
    korrel = np.abs(A - med).sum(-1)
    band = erode(kaart, 26) & ~erode(kaart, 132)
    for (x0, y0, x1, y1) in TEKST:
        band &= ~vak(x0, y0, x1, y1)
    gruis = dilate(ontkorrel((korrel > 96) & band, 1), 1)
    alpha = np.maximum(alpha, vervaag(gruis, 0.9) * band)

    # De ratingbalk onder de referentiekaart hoort niet bij het ornament.
    alpha[vak(200, 1348, 900, H)] = 0

    # --- de props op de rand van het écht gebruikte schild zetten
    # Tot hier volgt alles de kaartrand van de referentie. Die rand houdt rechte
    # flanken tot ~88% hoogte; het app-schild knijpt al vanaf 60%. Narrenkop,
    # speelkaarten en de twee lintbogen staan daardoor onderaan náást de kaart in
    # plaats van tegen de rand. De schuif trekt ze mee naar binnen, per rij, en
    # laat het centrale medaillon op de onderas staan.
    app_schild = contour(schildpunten())
    schuif = schuifveld(kaartvorm, app_schild)
    ys2, xs2 = np.mgrid[0:H, 0:W].astype(np.float32)
    premul = np.clip(A, 0.0, 255.0) * alpha[:, :, None]
    alpha, premul = herbemonster(alpha, premul, xs2 - schuif, ys2)
    kleur = np.where(
        alpha[:, :, None] > 1.0 / 255.0,
        premul / np.maximum(alpha, 1.0 / 255.0)[:, :, None],
        0.0,
    )

    # Gruis dat door de schuif te diep het kaartvlak in is gekomen, weer weg. Ná
    # het terugdelen van de kleur: de poort verlaagt alleen de alfa en mag de
    # tint van wat overblijft niet oplichten.
    links = houd_vast(randen(app_schild)[0])[:, None]
    rechts = houd_vast(randen(app_schild)[1])[:, None]
    diepte = np.minimum(xs2 - links, rechts - xs2)
    alpha = alpha * (
        1.0
        - smoothstep(diepte, VUIL_DIEPTE - 12.0, VUIL_DIEPTE + 38.0)
        * smoothstep(ys2, VUIL_Y0, VUIL_Y0 + 80.0)
    )

    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = np.clip(kleur, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    beeld = Image.fromarray(rgba, "RGBA")
    beeld = beeld.resize(
        (RASTER_BREEDTE, round(H * RASTER_BREEDTE / W)), Image.LANCZOS
    )
    return beeld, schuif


def schrijf_masker(schuif: np.ndarray) -> None:
    """Frontmasker met dezelfde schuif als de master.

    Het masker selecteert de objectgroepen die vóór het kaartframe mogen komen.
    Zodra een groep met de schildrand meeschuift, moet zijn venster mee: een
    masker dat blijft staan laat de verschoven prop half achter het frame vallen
    en snijdt hem op de framerand af. Daarom staat het hier en niet met de hand in
    de SVG.
    """
    H, W = schuif.shape
    naar_master = BREEDTE / W          # referentiepixels → masterpixels
    vormen = []
    for naam, cx, cy, rx, ry, rot in FRONT_GROEPEN:
        y_ref = min(int(round(cy / naar_master)), H - 1)
        x_ref = min(int(round(cx / naar_master)), W - 1)
        dx = float(schuif[y_ref, x_ref]) * naar_master
        cx_nieuw = round(cx + dx, 1)
        draai = (f' transform="rotate({rot} {cx_nieuw} {cy})"' if rot else "")
        vormen.append(
            f'    <ellipse cx="{cx_nieuw}" cy="{cy}" rx="{rx}" ry="{ry}"'
            f'{draai} />  <!-- {naam} -->'
        )
    hoogte = round(H * naar_master)
    MASKER.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BREEDTE} {hoogte}">\n'
        "  <!-- GEGENEREERD door scripts/pias-master.py — niet met de hand\n"
        "       bijwerken. Selecteert de complete objectgroepen die in de\n"
        "       referentie vóór het kaartframe liggen: kroon, klaver, pion,\n"
        "       speelkaarten, narrenkop, bagel, rozet en de twee lintbogen.\n"
        "       De onderste groepen dragen dezelfde horizontale schuif als de\n"
        "       master, zodat mask en artwork niet uit elkaar lopen. Tussen de\n"
        "       groepen blijft het frame zichtbaar; de blur houdt de randen\n"
        "       organisch. -->\n"
        '  <filter id="pias-front-blur" x="-20%" y="-20%" width="140%" height="140%">\n'
        '    <feGaussianBlur stdDeviation="16" />\n'
        "  </filter>\n"
        f'  <rect width="{BREEDTE}" height="{hoogte}" fill="#000" />\n'
        '  <g fill="#fff" filter="url(#pias-front-blur)">\n'
        + "\n".join(vormen)
        + "\n  </g>\n</svg>\n",
        encoding="utf-8",
    )
    print(f"{MASKER.relative_to(WORTEL)}: {len(FRONT_GROEPEN)} groepen")


def main() -> int:
    beeld, schuif = bouw()
    DOEL.parent.mkdir(parents=True, exist_ok=True)
    beeld.save(DOEL, "WEBP", quality=KWALITEIT, method=6)
    print(f"{DOEL.relative_to(WORTEL)}: {beeld.size[0]}×{beeld.size[1]}, "
          f"{DOEL.stat().st_size // 1024} kB")
    schrijf_masker(schuif)
    if "--preview" in sys.argv:
        uit = WORTEL / "screenshots" / "pias"
        uit.mkdir(parents=True, exist_ok=True)
        plaat = Image.new("RGB", beeld.size, (26, 28, 34))
        plaat.paste(beeld, (0, 0), beeld)
        plaat.save(uit / "master-preview.png")
        print(f"{(uit / 'master-preview.png').relative_to(WORTEL)}")
        # Dezelfde plaat met de rand van het app-schild erover: dít is het beeld
        # waarop te controleren valt of de props de kaartvorm echt raken in plaats
        # van die van de referentie.
        schaal = beeld.size[0] / 1086.0
        rand = [(x * schaal, y * schaal) for x, y in schildpunten()]
        ImageDraw.Draw(plaat).line(rand + [rand[0]], fill=(80, 220, 150), width=2)
        plaat.save(uit / "master-contouren.png")
        print(f"{(uit / 'master-contouren.png').relative_to(WORTEL)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
