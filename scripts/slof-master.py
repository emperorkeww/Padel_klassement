#!/usr/bin/env python3
"""Snijdt de losse artwork-onderdelen van de slof-kaart uit de referentie.

De divisiekaart "Sletje van de baan" gebruikt geen samengesteld master-artwork
maar elf losse WebP's, elk met een eigen positie, schaal, rotatie en laag in
`slofLayout.ts`. Dit script is de reproduceerbare bron van waarheid voor die
onderdelen: bij een gewijzigde referentie of een andere uitsnede draai je het
opnieuw in plaats van een WebP met de hand bij te werken. Het schrijft ook
`slof-onderdelen.json` met per onderdeel zijn natuurlijke plek als fractie van de
kaartbox; de layoutconfiguratie gebruikt dat als vertrekpunt.

    python3 scripts/slof-master.py            # schrijft de onderdelen
    python3 scripts/slof-master.py --preview  # schrijft ook controlebeelden

Afhankelijkheden staan bewust buiten de npm-toolchain (dit is een eenmalige
assetstap, geen build- of runtime-afhankelijkheid): Python 3 met numpy, scipy en
Pillow.

Werking:

  1. Twee keyings, zoals bij de Zwarte Piet. Buiten het perkament staat de
     referentie op zwart, dus daar levert een luminantiesleutel de alfa. Bínnen
     het perkament wordt een kleinste-kwadratenveld van orde 3 op het echte
     perkament gefit, plus een grof uitgesmeerde restterm voor de vignettering.
     De alfa is het *absolute* verschil met dat veld: deze kaart draagt naast
     scheuren en vuil (donkerder) ook spinrag, krassen en kalkstof (lichter).

  2. Het kaartoppervlak wordt dekkend overgenomen en niet additief. Additief
     blijft de lichte gradient van de app eronder zichtbaar en lees je een schone
     kaart met wat vuil. De tekst, de profielfoto en de frameband van de
     referentie worden geïnpaint met het gefitte perkamentveld, net als alles
     binnen het app-schild dat buiten het referentievlak valt.

  3. De frameband van de referentie gaat eruit en wordt opnieuw gelegd op het
     afstandsveld van het écht gebruikte schild (`#fut-schild-vlak`), als
     téxtuur: diepte vanaf de rand × booglengte langs de rand.

  4. De boog met crest, de stenen ring om de avatar en de vijf voorwerpen worden
     apart uitgesneden. De ring wordt daarbij radiaal om de portretzone van de
     layout heen geschaald, zodat hij zonder kier om de foto past.

"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import cKDTree

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "referentie_sletje_van_de_baan.png"
UIT = WORTEL / "src/features/rating/components/slof/assets"
SCRATCH = os.environ.get("SLOF_WORKDIR")

# --------------------------------------------------------------- coordinaten --
# Mastercanvas en de kaartbox daarin. De drie percentages hieronder staan
# identiek in SlofEffect.css; SlofEffect.test.tsx vergelijkt ze. Wijzigt er een,
# dan moet het canvas opnieuw worden opgebouwd.
CW, CH = 1112, 1470
MASTER_LEFT, MASTER_TOP, MASTER_W = 0.18, 0.16, 1.36
KAART_B = CW / MASTER_W                  # 817,6
KAART_H = KAART_B * 1.39                 # 1136,5
KAART_X = MASTER_LEFT * KAART_B          # 147,2
KAART_Y = MASTER_TOP * KAART_H           # 136,4
KAART_MID = KAART_X + KAART_B / 2

# Dezelfde kaartbox in referentiecoordinaten. De referentiekaart meet 818 × 1137
# pixels en heeft dus exact de 100:139 van de app — de afbeelding van referentie
# naar canvas is daardoor een zuivere verschuiving met schaal ~1.
REF_X0, REF_B = 103.0, 818.0
REF_Y0, REF_H = 111.0, 1137.0
S = KAART_B / REF_B

# #fut-schild-slof uit FutKaart.tsx, in kaartfracties. Deze contour hóórt bij
# deze kaart: de gedeelde vlakke vorm loopt vanaf 60% hoogte naar een punt, en
# daar passen het statblok en de bodemprops van de referentie niet in. Hier
# blijven de zijkanten recht tot 80% en buigen ze dan naar een brede basis. De
# steenlijst wordt op precies deze lijn uitgerold, dus de twee mogen nooit uit
# elkaar lopen.
SCHILD_VLAK = [
    ("M", (0.04, 0.0)),
    ("L", (0.96, 0.0)),
    ("L", (1.0, 0.045)),
    ("L", (1.0, 0.80)),
    ("C", (1.0, 0.856), (0.974, 0.884), (0.933, 0.906)),
    ("L", (0.796, 0.947)),
    ("C", (0.717, 0.970), (0.617, 0.982), (0.5, 0.982)),
    ("C", (0.383, 0.982), (0.283, 0.970), (0.204, 0.947)),
    ("L", (0.067, 0.906)),
    ("C", (0.026, 0.884), (0.0, 0.856), (0.0, 0.80)),
    ("L", (0.0, 0.045)),
]

# --------------------------------------------------------------- referentie ---
# Binnenrand van de stenen boog: hierboven ligt geen perkament meer. Gemeten per
# kolom op de referentie.
BOOG = [
    (88, 250), (150, 215), (220, 188), (300, 163), (380, 146), (460, 136),
    (512, 132), (570, 136), (650, 146), (730, 164), (810, 190), (880, 216),
    (936, 250),
]
# De frameband van de referentie is overal even dik. Het perkament volgt dus uit
# een afstandsveld op de kaartcontour hieronder en niet uit een tweede
# handgetekende polygoon — die zou langs de taps toelopende onderkant onvermijdelijk
# van de echte rand af lopen en daar een strook perkament als "buiten de kaart"
# bestempelen. Zo'n strook krijgt de zwartsleutel en wordt dekkend: een lichte
# boog dwars over het kaartvlak.
BAND_D = 60.0
# De buitenrand van de referentiekaart: boog met crest, rechte zijkanten, taps
# toelopende onderkant. Alles hiertussen en het perkament is frameband.
REF_KAART = [
    (103, 200), (140, 168), (190, 150), (240, 128), (300, 102), (370, 76),
    (410, 62), (446, 58), (462, 40), (560, 40), (576, 58), (616, 64),
    (680, 78), (740, 98), (800, 124), (850, 150), (890, 168), (921, 200),
    (921, 1035), (900, 1090), (860, 1140), (800, 1180), (700, 1218),
    (600, 1240), (527, 1248), (450, 1240), (360, 1216), (280, 1184),
    (210, 1146), (160, 1100), (120, 1058), (103, 1010),
]

# Wat de referentie zelf al aan tekst en foto draagt. Blijft daar iets van
# staan, dan leest het als spookkopie naast de echte inhoud van de kaart.
REF_TEKST = [
    (172, 192, 490, 358),     # rating "350"
    (270, 350, 348, 416),     # divisiecijfer
    (146, 402, 368, 534),     # vormemoji — hij loopt verder naar links door dan hij lijkt
    (172, 574, 856, 674),     # naamregel
    (172, 674, 860, 1018),    # statblok met waarden
    (120, 1252, 940, 1536),   # de ratingbalk onder de kaart
]
# De profielfoto van de referentie met zijn stenen ring. Radiaal gemeten: het
# gat loopt tot r 150, de stenen ring van 150 tot 218. De app zet daar zijn
# eigen, iets grotere avatar neer; de ring wordt verderop om die positie heen
# geschaald en gaat hier in zijn geheel weg.
# De straal is die van de fóto, niet van de ring: op 226 werd de complete
# stenen ring mee weggegumd en zat de avatar zonder omlijsting op het perkament.
# Nu blijft de ring (r 150..218) in de plaat staan, ingebed met zijn eigen
# afschuining en slagschaduw.
REF_AVATAR = (682.0, 345.0, 150.0)
RING_BINNEN, RING_BUITEN = 150.0, 218.0

# De vijf voorwerpen die naar de punt van de kaart verhuizen. Elke contour mag
# ruim zijn — binnen de contour bepaalt de keying wat voorwerp is en wat
# perkament. `doel` is (middenX, bovenY) als fractie van de kaartbox, zodat een
# andere registratie de compositie niet uit elkaar trekt.
VOORWERPEN = [
    # De weggegooide bidon leunt tegen de linkerflank, met zijn onderhelft naast
    # de kaart. Blijft links van de divisieregel (die begint rond x 282).
    ("fles",
     [(88, 862), (140, 852), (196, 866), (208, 930), (202, 1000), (192, 1062),
      (162, 1102), (118, 1106), (92, 1064), (84, 980), (84, 906)],
     0.90, (0.086, 0.712)),
    # Verfrommeld papier en bladafval: valt links van de punt naar buiten.
    ("papier",
     [(190, 1000), (250, 986), (320, 1000), (400, 1024), (466, 1052),
      (470, 1096), (420, 1126), (330, 1132), (250, 1124), (198, 1088)],
     0.70, (0.298, 0.828)),
    # Het gebroken racket leunt met zijn kop tegen de rechterflank van de punt.
    ("racket",
     [(414, 862), (470, 856), (560, 858), (642, 874), (692, 908), (718, 968),
      (716, 1040), (692, 1096), (642, 1130), (560, 1146), (490, 1130),
      (440, 1090), (410, 1030), (404, 946)],
     0.80, (0.468, 0.818)),
    # De doorgesleten sok hangt over de rechterflank naar buiten.
    ("sok",
     [(672, 912), (740, 896), (832, 910), (892, 950), (912, 1010),
      (908, 1082), (882, 1142), (832, 1192), (770, 1214), (708, 1198),
      (674, 1150), (660, 1068), (658, 978)],
     0.72, (0.796, 0.818)),
    # De onderste crest hoort in de schildpunt, net als op de referentie.
    ("crest",
     [(444, 1102), (512, 1094), (580, 1102), (584, 1158), (568, 1202),
      (512, 1236), (456, 1202), (440, 1158)],
     0.80, (0.518, 0.878)),
]

# Zones waar het artwork bij uitzondering búiten het app-schild mag hangen:
# het spinrag in de rechterbovenhoek en de twee stukken ducttape op de
# rechterflank. Zonder deze uitzondering knipt het schild ze recht af.
BUITEN_OK = [
    (742, 130, 1000, 320),    # spinrag
    (846, 176, 1000, 268),    # ducttape boven
    (846, 506, 1000, 596),    # ducttape midden
]

# De portretzone van de slof-layout, in kaartfracties. Dit is niet meer de plek
# van de generieke FUT-avatar maar die van `slofLayout.ts`: de referentie zet de
# foto hoger en kleiner. De ring wordt op exact deze straal geschaald, zodat er
# geen kier tussen foto en steen valt.
AVATAR_APP = (0.708, 0.206, 0.18337)

# Waar de kaart zélf zet, in kaartfracties (dezelfde meting). Hier wordt de
# verwering gedempt in plaats van weggehaald: het vlak van de slof staat op
# verweerd beton en de inkt moet ook ná het vuil zijn AA-contrast houden, maar
# een schoongeveegde rechthoek onder de naamplaat leest als een sticker. De
# contrastberekening in slof.css rekent met deze demping.
APP_TEKST = [
    (0.075, 0.070, 0.475, 0.345),   # ratinggroep: rating, subniveau, emoji
    (0.095, 0.410, 0.905, 0.482),   # divisietitel
    (0.095, 0.488, 0.905, 0.802),   # statblok
]
# Hoeveel van de verwering blijft staan in de zones waar de kaart zelf zet.
# Laag genoeg en er verschijnt een lichter paneel met een harde rand midden op
# de kaart — precies de "grote witte content-overlay" die de compositie plat
# maakt. Hoog genoeg en de inkt verliest zijn contrast. 0,80 met een ruime
# vervaging houdt de textuur door en licht de ondergrond net genoeg op.
APP_TEKST_DEMPING = 0.80

LIJST_D = 62          # dikte van de referentielijst, in referentiepixels
APP_RAND = 34.0       # frame + liner + keyline van .fut-kaart--slof, in canvaspx


# ------------------------------------------------------------- gereedschap ----
def stempel(shape, polys=(), ellipses=(), rects=()):
    m = Image.new("L", (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon([tuple(q) for q in p], fill=255)
    for cx, cy, rx, ry in ellipses:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    for x0, y0, x1, y1 in rects:
        d.rectangle([x0, y0, x1, y1], fill=255)
    return np.asarray(m).astype(np.float32) / 255.0


def blur(arr, sigma):
    if sigma <= 0:
        return arr
    if arr.ndim == 2:
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        return np.asarray(
            img.filter(ImageFilter.GaussianBlur(sigma))
        ).astype(np.float32)
    return np.dstack([blur(arr[:, :, c], sigma) for c in range(arr.shape[2])])


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def bezierpunten(pad, box):
    """Een pad in fracties naar pixels binnen `box` = (x0, y0, b, h)."""
    x0, y0, b, h = box

    def naar_px(p):
        return (x0 + p[0] * b, y0 + p[1] * h)

    pts, huidig = [], None
    for seg in pad:
        if seg[0] in ("M", "L"):
            huidig = seg[1]
            pts.append(naar_px(huidig))
        else:
            p0, (c1, c2, p3) = huidig, seg[1:]
            for i in range(1, 25):
                t = i / 24.0
                m = 1.0 - t
                x = (m ** 3 * p0[0] + 3 * m * m * t * c1[0]
                     + 3 * m * t * t * c2[0] + t ** 3 * p3[0])
                y = (m ** 3 * p0[1] + 3 * m * m * t * c1[1]
                     + 3 * m * t * t * c2[1] + t ** 3 * p3[1])
                pts.append(naar_px((x, y)))
            huidig = p3
    return pts


def over(onder_p, onder_a, boven_p, boven_a):
    """Over-operator op voorvermenigvuldigde kleur."""
    return (boven_p + onder_p * (1.0 - boven_a)[:, :, None],
            boven_a + onder_a * (1.0 - boven_a))


# ------------------------------------------------------------------- bouw -----
ref = Image.open(REFERENTIE).convert("RGB")
RW, RH = ref.size
img = np.asarray(ref).astype(np.float32)
grijs = img @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float32)

refkaart = stempel((RH, RW), polys=[REF_KAART]) > 0.5
diep = ndimage.distance_transform_edt(refkaart)
perkament = diep > BAND_D
band_ref = refkaart & ~perkament

# 1a. perkamentveld -----------------------------------------------------------
# Een kleinste-kwadratenfit van orde 3 over de schone perkamentpixels, plus een
# grof uitgesmeerde restterm. De fit alleen is niet genoeg: dit perkament heeft
# een zware vignettering met een donkerder onderpaneel, en wat de fit daarvan
# mist leest als een brede grijze waas in plaats van als scheuren. Een lokaal
# filter alléén werkt evenmin — onder de rating en het statblok vindt dat geen
# perkament en valt het te donker uit, wat na un-premultiply roestbruine vlekken
# oplevert. De combinatie doet allebei: de fit draagt de tekstzones, de restterm
# de vignettering.
schoon = perkament & (grijs > 96) & ((img.max(2) - img.min(2)) < 96)
u = (xx - REF_X0) / REF_B
v = (yy - REF_Y0) / REF_H
termen = [np.ones_like(u), u, v, u * u, u * v, v * v,
          u ** 3, u * u * v, u * v * v, v ** 3]
A = np.stack([t[schoon] for t in termen], axis=1)
BG = np.zeros((RH, RW, 3), np.float32)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, img[:, :, c][schoon], rcond=None)
    BG[:, :, c] = sum(k * t for k, t in zip(coef, termen))
gewicht = blur(schoon.astype(np.float32) * 255, 34.0) / 255.0
rest = blur((img - BG) * schoon[:, :, None], 34.0) / np.maximum(gewicht, 1e-3)[:, :, None]
BG = np.clip(BG + rest * np.clip(gewicht * 3.0, 0.0, 1.0)[:, :, None], 40.0, 255.0)
BGl = BG @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

# 1b. alfa binnen het perkament -----------------------------------------------
# Absoluut verschil: scheuren en vuil zijn donkerder dan het perkament, spinrag,
# krassen en stof juist lichter. Alleen het donkere nemen kost het halve
# karakter van deze kaart.
afwijking = np.abs(BGl - grijs) / np.maximum(BGl, 1.0)
a_in = smoothstep(afwijking, 0.04, 0.28) * np.clip(afwijking * 2.3, 0.0, 1.0)

# 1c. alfa buiten het perkament -----------------------------------------------
# De pedestal knipt de ruisvloer van de zwarte achtergrond weg; zonder die
# drempel houdt bijna elke pixel alfa ~0,08 en wordt het WebP twee keer zo groot
# zonder dat er iets zichtbaar is. De solid-boost zet massieve voorwerpen (sok,
# racket, ducttape) dicht die anders halftransparant zouden blijven.
# De pedestal ligt op 24: de zwarte achtergrond van deze referentie heeft een
# mediaan van 13 tot 18 luma en is dus veel lichter dan die van de Zwarte Piet.
# Op een lagere drempel houdt elke achtergrondpixel alfa ~0,3, blaast de
# un-premultiply zijn kleur op naar lichtgrijs en hangt er een grijze doek om de
# kaart.
a_lum = np.clip((grijs - 24.0) / 46.0, 0.0, 1.0) ** 0.72
detail = np.abs(grijs - blur(grijs, 5.0))
solid = smoothstep(detail, 5.0, 20.0)
solid = np.asarray(
    Image.fromarray((solid * 255).astype(np.uint8))
    .filter(ImageFilter.MaxFilter(9))
    .filter(ImageFilter.MinFilter(5))
).astype(np.float32) / 255.0
solid = ndimage.binary_closing(solid > 0.35, np.ones((21, 21))).astype(np.float32)
solid = blur(solid * 255, 3.0) / 255.0
# De poort staat ruim boven de achtergrond (mediaan luma 13–18). Lager en de
# ruisvloer van het zwart valt zelf binnen de boost, waarna `binary_closing` er
# dekkende grijze blokken van maakt rond spinrag en ducttape.
poort = np.clip((grijs - 26.0) / 16.0, 0.0, 1.0)
a_uit = np.clip(a_lum + 0.85 * solid * poort, 0.0, 1.0)

# 2. de frameband van de referentie eruit -------------------------------------
# Drie regimes: perkament additief, frameband weg (stap "randlijst" tekent hem
# opnieuw op het app-schild) en buiten de kaart de zwartsleutel.
alpha = np.where(perkament, a_in, np.where(refkaart, 0.0, a_uit))
# Waar een compleet voorwerp de band kruist blijft hij staan: dat voorwerp dekt
# hem daar toch af, en wegsnijden zou fles, sok en ducttape doormidden knippen.
houd = stempel(
    (RH, RW),
    polys=[p for _n, p, _s, _d in VOORWERPEN],
    rects=[(846, 176, 960, 268), (846, 506, 960, 596)],
) > 0.5
alpha = np.where(houd & band_ref, a_uit, alpha)
band_zacht = blur((band_ref & ~houd).astype(np.float32) * 255, 3.0) / 255.0

# 3. kleur (un-premultiply) ---------------------------------------------------
av = np.maximum(alpha, 0.03)[:, :, None]
kleur = np.where(
    perkament[:, :, None],
    (img - (1.0 - av) * BG) / av,
    img / np.maximum(alpha, 0.07)[:, :, None],
)
kleur = np.clip(kleur, 0, 255)

# 4. de stenen ring om de avatar ----------------------------------------------
# De ring is een van de sterkste kenmerken van de referentie, maar de avatar van
# de app staat lager en is iets groter. De ring wordt daarom radiaal om de échte
# avatarpositie heen geschaald — een bewerking in de asset, niet in CSS: de drie
# lagen blijven één bron met één register. Dit gebeurt vóór de killzone, anders
# is de bron al weg.
AV_REF_APP = (REF_X0 + AVATAR_APP[0] * REF_B,
              REF_Y0 + AVATAR_APP[1] * REF_H,
              AVATAR_APP[2] * REF_B)
# De bron is precies de gemeten ringband [150, 218] en het doel precies de band
# die om de échte avatar past. Rekt het doel verder door dan de bron reikt, dan
# wordt naast de ring ook het perkament eromheen meegekopieerd en staat er een
# tweede boog boven de foto.
DOEL_BINNEN = AV_REF_APP[2] + 2.0
DOEL_BUITEN = DOEL_BINNEN + (RING_BUITEN - RING_BINNEN) * 1.06
hoek = np.arctan2(yy - AV_REF_APP[1], xx - AV_REF_APP[0])
r_app = np.hypot(xx - AV_REF_APP[0], yy - AV_REF_APP[1])
rek = (RING_BUITEN - RING_BINNEN) / (DOEL_BUITEN - DOEL_BINNEN)
r_bron = RING_BINNEN + (r_app - DOEL_BINNEN) * rek
bron_x = np.clip(np.rint(REF_AVATAR[0] + r_bron * np.cos(hoek)), 0, RW - 1).astype(np.int32)
bron_y = np.clip(np.rint(REF_AVATAR[1] + r_bron * np.sin(hoek)), 0, RH - 1).astype(np.int32)
ringvorm = (
    smoothstep(r_app, DOEL_BINNEN - 5.0, DOEL_BINNEN + 5.0)
    * (1.0 - smoothstep(r_app, DOEL_BUITEN - 16.0, DOEL_BUITEN))
)
# De ring is een massief stenen object en krijgt dus de vorm als alfa, niet de
# additieve sleutel van het perkament. Met die sleutel viel de bovenkant van de
# ring weg: daar ligt licht steen op licht perkament, dus |BG − grijs| is klein
# en de ring stond er als halve maan omheen.
ring_a = ringvorm
ring_k = img[bron_y, bron_x]

# 5. killzones ----------------------------------------------------------------
# Niet de hele tekstrechthoek weghalen maar alleen de letters. Een rechthoek
# neemt hier de halve kaart mee: rating, naamregel en statblok beslaan samen
# tweederde van het perkament, en juist dáár zit de verwering die de kaart moet
# dragen. De letters zijn bijna zwart op perkament; scheuren halen die drempel
# niet. Wat in dezelfde zone tóch zo donker is, mag mee weg — een scheur minder
# weegt niet op tegen een spookkopie van "350" naast de echte rating.
tekstzone = stempel((RH, RW), rects=REF_TEKST) > 0.5
# Tegen de lókale omgeving meten, niet tegen het gefitte perkamentveld. Dat veld
# is glad; het statpaneel van de referentie is als geheel donkerder dan de fit,
# dus een drempel op `BGl - grijs` verklaarde het hele paneel tot letter. Na de
# inpaint stond er dan een vlakke, schone rechthoek met harde randen midden op de
# kaart — dezelfde lichte overlay die de compositie plat maakte, nu ingebakken in
# het artwork. Een letter is per definitie donkerder dan wat er direct omheen
# ligt; een paneel is dat niet.
# Absoluut, niet lokaal. De letters van de referentie zijn bijna zwart (luma
# 14–28) op perkament dat rond 148 ligt; dat scheidt veel harder dan een lokale
# contrastdrempel, die op deze zwaar getextureerde plaat ook scheuren en vlekken
# oppikt en er dan hele blokken uit haalt. De waarden staan in lakrood: donkerder
# dan het perkament maar niet zwart, dus die krijgen een eigen tak op kleur.
zwart = grijs < 72.0
rood = (img[..., 0] - img[..., 1] > 45.0) & (grijs < 125.0)
donker = zwart | rood

# Voorwerpen zijn ook donker. Het gebroken racket ligt met zijn kop midden in de
# statblokzone, en zonder deze uitzondering gumde de letterdetectie precies dat
# stuk weg — de kaart kreeg een kaarsrechte horizontale snede dwars door de
# racketkop. Een voorwerp is te herkennen aan twee dingen die een letter nooit
# heeft: het loopt de tekstzone uit naar onderen, of het is simpelweg veel
# groter dan een letterstreek. De grootste letter is de rating (~25 000 px), dus
# 40 000 zit daar ruim boven en ruim onder het racket.
# Alleen op het zwarte kanaal labelen. Zou het rood meedoen, dan raakt de
# "-100" van de referentie het racket aan, valt hij in hetzelfde component en
# wordt hij als voorwerp beschermd — waarna hij als spookwaarde naast de echte
# waarde blijft staan.
etiketten, aantal = ndimage.label(zwart)
if aantal:
    index = np.arange(1, aantal + 1)
    laagste = ndimage.maximum(yy, etiketten, index)
    omvang = ndimage.sum(zwart, etiketten, index)
    voorwerp_ids = index[(laagste > 1020.0) | (omvang > 40000.0)]
    voorwerpen = np.isin(etiketten, voorwerp_ids)
else:
    voorwerpen = np.zeros_like(zwart)

letters = tekstzone & ((zwart & ~voorwerpen) | rood)
letters = ndimage.binary_opening(letters, np.ones((3, 3)))
# Gaten dichten: de detectie vindt de rand van een dikke letter wel maar zijn
# binnenkant niet — daar lijkt de omgeving ook op de letter. Zonder dit blijft de
# vulling van een "0" staan en reist die als rode veeg mee met de sok.
letters = ndimage.binary_fill_holes(letters)
letters = ndimage.binary_dilation(letters, np.ones((9, 9)))
# Snel naar 1: bij een zachte kill blijft er een fractie van de oorspronkelijke
# letter staan, en juist de antialias-rand maakt een verwijderde regel weer
# leesbaar.
kill = blur(letters.astype(np.float32) * 255, 2.4) / 255.0
kill = np.clip(kill * 2.4, 0.0, 1.0)
# Drie dingen gaan wél in hun geheel weg: de profielfoto (een dekkende foto,
# geen tekst), de vormemoji (lichter dan het perkament, dus onvindbaar voor de
# letterdrempel) en de ratingbalk onder de kaart.
hard = stempel((RH, RW), ellipses=[REF_AVATAR + (REF_AVATAR[2],)],
               rects=[REF_TEKST[2], REF_TEKST[-1]])
kill = np.maximum(kill, blur(hard * 255, 6.0) / 255.0)
kill = np.maximum(kill, band_zacht)
alpha = alpha * (1.0 - kill)

# En de zones waar de kaart zelf zet: dempen, niet wissen. Ruim vervaagd, zodat
# er geen rechthoekige naad in de verwering komt te staan.
zones = stempel((RH, RW), rects=[
    (REF_X0 + x0 * REF_B, REF_Y0 + y0 * REF_H,
     REF_X0 + x1 * REF_B, REF_Y0 + y1 * REF_H)
    for x0, y0, x1, y1 in APP_TEKST
])
zones = blur(zones * 255, 34.0) / 255.0
# Bewust nét niet op `alpha` toegepast: die demping hoort alleen bij het
# kaartoppervlak, en dat wordt verderop dekkend opgebouwd met `naar_bg`. Deed hij
# het hier wel, dan werden ook de voorwerpen erdoor geraakt — racket en sok
# vallen precies in de statblokzone en stonden er half doorzichtig overheen.

premul = kleur * alpha[:, :, None]
premul, alpha = over(premul, alpha, ring_k * ring_a[:, :, None], ring_a)
kleur = np.clip(premul / np.maximum(alpha, 0.02)[:, :, None], 0, 255)

# De vijf voorwerpen worden apart geplaatst; hier gaan ze uit het vlak.
voorwerp_masker = blur(
    stempel((RH, RW), polys=[p for _n, p, _s, _d in VOORWERPEN]) * 255, 4.0
) / 255.0
alpha_vlak = alpha * (1.0 - voorwerp_masker)

# 6. de boog met crest dekkend ------------------------------------------------
# Binnen het app-schild krijgt de bovenzone alfa 1: de stenen boog én de donkere
# nis eromheen. Additieve extractie zou daar een lichtgrijze waas over het
# perkament geven in plaats van de nis van de referentie.
schild_ref = stempel(
    (RH, RW), polys=[bezierpunten(SCHILD_VLAK, (REF_X0, REF_Y0, REF_B, REF_H))]
) > 0.5
boogzone = stempel(
    (RH, RW),
    polys=[[(88, 0), (936, 0)] + list(reversed(BOOG))],
) > 0.5
# Onder de boog, binnen het schild: dekkend. Buiten het schild blijft de
# luminantiesleutel staan, anders hangt er een zwarte koepel boven de kaart.
boog_dekkend = boogzone & schild_ref
alpha_vlak = np.where(boog_dekkend, 1.0, alpha_vlak)
kleur = np.where(boog_dekkend[:, :, None], img, kleur)
# Boven de kaartrand blijft alleen wat de sleutel doorlaat: boog en crest. De
# stofwolk om de boog wordt daar gehalveerd — massief steen houdt zijn alfa via
# `solid`, maar een zwarte wolk boven de kaart leest op een lichte pagina als
# een vlek en draagt niets.
boog_boven = boogzone & ~schild_ref
a_boven = a_uit * (0.35 + 0.65 * solid)
alpha_vlak = np.where(boog_boven, np.maximum(alpha_vlak, a_boven), alpha_vlak)

# Buiten het schild houdt alleen de bovenzone en de drie uitzonderingen stand;
# de rest zou als los gruis naast de kaart zweven.
buiten_ok = stempel((RH, RW), rects=BUITEN_OK) > 0.5
weg = ~schild_ref & ~boogzone & ~buiten_ok
alpha_vlak = np.where(weg, 0.0, alpha_vlak)

premul_vlak = kleur * alpha_vlak[:, :, None]


# =================================================== drie verbatim onderdelen
# De eerdere versie bouwde het frame opnieuw op uit een uitgerolde textuur en
# zette de voorwerpen los terug. Dat levert een herkenbare maar duidelijk
# armere kaart: een uitgerolde band heeft geen afschuiningen, geen afgebrokkelde
# hoeken, geen roestaanslag en geen ingelegde crest, en losgezette voorwerpen
# verliezen de schaduwen waarmee ze op de referentie in elkaar grijpen.
#
# Daarom worden hier drie samenhangende delen letterlijk uit de referentie
# gesneden, op hun eigen plek en met hun eigen licht:
#
#   plaat       het perkament binnen de lijst, mét al zijn scheuren, vlekken en
#               het complete stilleven onderin (racket, fles, sok, papier, gruis
#               en hun onderlinge schaduwen);
#   omlijsting  de volledige metalen lijst met beide crests en de boog;
#   buiten      alles wat naast het silhouet hangt: spinrag, ducttape en afval.
#
# Het silhouet komt uit het beeld zelf (drempel → grootste component → gaten
# dichten) en niet uit een handgetekende polygoon. Daardoor volgt de kaartvorm
# de referentie pixel voor pixel, inclusief de schouders en de onderrand.
ONDERDELEN: dict[str, dict[str, float]] = {}

silhouet = ndimage.binary_closing(grijs > 38.0, np.ones((11, 11)))
etiket, _ = ndimage.label(silhouet)
silhouet = ndimage.binary_fill_holes(etiket == etiket[600, 512])
diep_sil = ndimage.distance_transform_edt(silhouet)
# De lijst is langs de rechte zijkanten ~62 px dik; 58 houdt het perkament heel
# en laat de afschuining bij de lijst horen.
perkament_vast = diep_sil > 58.0


def zacht(masker, straal=1.6):
    return blur(masker.astype(np.float32) * 255, straal) / 255.0


def schrijf(naam, kleuren, alfa, kwaliteit=80):
    """Schrijft één onderdeel op het volledige referentieraster.

    Alle drie de delen delen dus één coordinatenstelsel; ze schuiven bij het
    plaatsen nooit t.o.v. elkaar. Het manifest krijgt de bijgesneden doos terug
    als fractie van de kaartbox.
    """
    ys, xs = np.where(alfa > 0.02)
    if ys.size == 0:
        raise SystemExit(f"onderdeel {naam} is leeg")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    a = alfa[y0:y1, x0:x1]
    k = np.clip(kleuren[y0:y1, x0:x1], 0, 255)
    k = np.where((a > 0.04)[:, :, None], k, 0.0)
    rgba = np.clip(np.dstack([k, a * 255.0]), 0, 255).astype(np.uint8)
    pad = UIT / f"slof-{naam}.webp"
    Image.fromarray(rgba, "RGBA").save(pad, format="WEBP", quality=kwaliteit,
                                       method=6)
    ONDERDELEN[naam] = {
        "links": round((x0 - REF_X0) / REF_B, 5),
        "boven": round((y0 - REF_Y0) / REF_H, 5),
        "breedte": round((x1 - x0) / REF_B, 5),
        "hoogte": round((y1 - y0) / REF_H, 5),
        "px": [x1 - x0, y1 - y0],
        "kb": round(pad.stat().st_size / 1024),
    }


# --- 1. de plaat -------------------------------------------------------------
# Verbatim perkament. Alleen wat de kaart zélf zet gaat eruit: de lettervormen
# van de referentie en haar profielfoto. Niet de omgeving daarvan — juist daar
# zit het vuil dat de kaart moet dragen.
#
# De inpaint is niet het gladde perkamentveld: dat laat gepolijste vlekken achter
# op de plekken waar de referentie haar rating, titel en statblok had, en juist
# die vlekken maken de kaart schoner dan hij hoort te zijn. In plaats daarvan
# wordt elke weggehaalde pixel gevuld met het gewogen gemiddelde van het
# perkament er direct ómheen — een genormaliseerde convolutie over alles wat
# níet is weggehaald. Voor letterstreken, die dun zijn, levert dat de toon en de
# grove textuur van de plaat eromheen in plaats van een gladde plek.
#
# (Een getegelde korrelpatch uit de referentie zelf is hier geprobeerd en werkt
# niet: elke strook die breed genoeg is bevat óók de vormemoji of een stuk
# avatarring, en dat verschijnt dan overal terug.)
def vul_uit_perkament(bron, weg, schoon, veld):
    """Vult weggehaalde pixels met échte perkamenttextuur van elders.

    Per kandidaatverschuiving wordt gekeken of de bronpixel daar schoon perkament
    is; zo ja, dan wordt van díe plek alleen het *residu* overgenomen (bron min
    het gefitte veld) en op het lokale veld gezet. Daardoor klopt de plaatselijke
    toon en verhuist alleen de korrel — een verschoven kopie zou anders als
    lichter of donkerder blok in het vlak staan.

    Een genormaliseerde convolutie (het gemiddelde van de omgeving) is hier
    geprobeerd en werkt niet: die is glad, en tegen een zwaar getextureerde plaat
    tekent elke gladde plek zich af als spookvorm van de weggehaalde letter.
    """
    kandidaten = [(0, -150), (0, 150), (-200, 0), (200, 0), (0, -300), (0, 300),
                  (-320, 0), (320, 0), (-170, -170), (170, 170), (0, -430),
                  (0, 430), (-260, -120), (260, 120), (-120, 260), (120, -260),
                  (0, -560), (0, 560), (-430, 0), (430, 0)]
    residu = bron - veld
    nog = weg > 0.02
    # Vangnet: het gewogen gemiddelde van de níet-weggehaalde buren, niet de
    # bron. Viel dit terug op `bron`, dan kwam elke pixel zonder schone kandidaat
    # gewoon weer als originele letter tevoorschijn; viel het terug op het kale
    # perkamentveld, dan kreeg een rode waarde die op de sok stond een lichte
    # perkamentvlek. Een lokaal gemiddelde houdt daar de toon van de sok.
    houd = (weg <= 0.02).astype(np.float32)
    teller = blur(bron * houd[:, :, None], 9.0)
    noemer = np.maximum(blur(houd * 255.0, 9.0) / 255.0, 1e-3)
    vul = teller / noemer[:, :, None]
    for dx, dy in kandidaten:
        if not nog.any():
            break
        bron_ok = np.roll(np.roll(schoon, dy, axis=0), dx, axis=1)
        neem = nog & bron_ok
        if not neem.any():
            continue
        verschoven = np.roll(np.roll(residu, dy, axis=0), dx, axis=1)
        vul = np.where(neem[:, :, None], veld + verschoven, vul)
        nog &= ~neem
    return np.clip(vul, 0, 255)


# Bruikbaar als textuurbron is: perkament, niet weggehaald, en niet te ver van
# het gefitte veld. Die laatste eis is de belangrijke — zonder haar telt het
# stilleven onderin (racket, fles, sok) ook als "schoon perkament", en dan wordt
# een halve racket als textuur in het statblok geplakt. En boven de propzone,
# want daar ligt het rustigste perkament van de kaart.
afstand_tot_veld = np.abs(img - BG).sum(-1)
schoon_perkament = (
    perkament_vast
    & (kill < 0.02)
    & (afstand_tot_veld < 150.0)
    & (yy < 880.0)
)
plaat_kleur = img * (1.0 - kill)[:, :, None] + vul_uit_perkament(
    img, kill, schoon_perkament, BG
) * kill[:, :, None]
plaat_a = zacht(perkament_vast, 1.4)
# Het gat voor de profielfoto: de app zet daar zijn eigen avatar met exact deze
# straal, dus de stenen ring eromheen sluit zonder naad aan.
gat = np.hypot(xx - REF_AVATAR[0], yy - REF_AVATAR[1])
# Het gat blijft iets kleiner dan de avatar die erin komt: zo dekt de foto de
# rand van het gat af en is er nergens een sikkel achtergrond te zien.
plaat_a *= smoothstep(gat, RING_BINNEN - 15.0, RING_BINNEN - 9.0)
# De kaart wordt hooguit ~560 CSS px breed getoond; op deze kwaliteit is er
# geen zichtbaar verschil met 88, en het scheelt de helft in bundelgewicht.
schrijf("plaat", plaat_kleur, plaat_a, kwaliteit=80)

# --- 2. de omlijsting --------------------------------------------------------
# De lijst met beide crests en de boog, in één stuk. Zo blijven de afschuiningen,
# de afgebrokkelde hoeken en de roest op hun plek t.o.v. elkaar, en groeit de
# ondercrest uit de rand in plaats van erop geplakt te zijn.
lijst_a = zacht(silhouet & ~ndimage.binary_dilation(perkament_vast, np.ones((5, 5))), 1.4)
schrijf("omlijsting", img, lijst_a, kwaliteit=82)

# --- 3. wat er naast hangt ---------------------------------------------------
# Spinrag, ducttape en losgeraakt afval buiten het silhouet. De zwartsleutel
# geeft ze zachte randen; de solid-boost houdt de tape en het afval dicht.
buiten_a = np.clip(a_uit, 0.0, 1.0) * (1.0 - zacht(silhouet, 2.0))
# De ratingbalk onder de referentiekaart hoort niet bij de kaart.
buiten_a[1252:, :] = 0.0
schrijf("buiten", img, buiten_a, kwaliteit=78)

manifest = UIT / "slof-onderdelen.json"
manifest.write_text(json.dumps(ONDERDELEN, indent=2, sort_keys=True) + "\n",
                    encoding="utf8")

totaal = sum(v["kb"] for v in ONDERDELEN.values())
print(f"{len(ONDERDELEN)} onderdelen, samen {totaal} kB")
for naam in sorted(ONDERDELEN):
    v = ONDERDELEN[naam]
    print(f"  {naam:12s} links {v['links']:+.4f} boven {v['boven']:+.4f} "
          f"breedte {v['breedte']:.4f} hoogte {v['hoogte']:.4f} "
          f"({v['px'][0]}×{v['px'][1]}px, {v['kb']} kB)")

if "--preview" in sys.argv or SCRATCH:
    doel = Path(SCRATCH) if SCRATCH else WORTEL / "screenshots" / "slof"
    doel.mkdir(parents=True, exist_ok=True)
    for bg, naam in (((18, 17, 15), "onderdelen-donker.png"),
                     ((214, 200, 172), "onderdelen-licht.png")):
        plaat = Image.new("RGB", (RW, RH), bg)
        for n in ("buiten", "plaat", "omlijsting"):
            v = ONDERDELEN[n]
            deel = Image.open(UIT / f"slof-{n}.webp")
            plaat.paste(deel, (int(round(REF_X0 + v["links"] * REF_B)),
                               int(round(REF_Y0 + v["boven"] * REF_H))), deel)
        d = ImageDraw.Draw(plaat)
        d.rectangle([REF_X0, REF_Y0, REF_X0 + REF_B, REF_Y0 + REF_H],
                    outline=(0, 255, 136), width=3)
        plaat.save(doel / naam)
    print("controlebeelden in", doel)
