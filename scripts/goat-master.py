#!/usr/bin/env python3
"""Stelt src/features/rating/components/goat/assets/goat-master.webp samen.

De referentie is een platte render met kaart, frame en tekst erin. Per element
wordt een uitsnede gemaakt, de bijna-zwarte achtergrond via luminantie naar
alpha gesleuteld, met een organisch polygoonmasker geisoleerd en op het
mastercanvas geplaatst. Het canvas is het gedeelde coordinatenstelsel van
achter-, binnen- en voorlaag.

Referentiegeometrie (schild buitenrand): x 118..812, y 573..1490.

Gebruik:  python3 scripts/goat-master.py
Zet GOAT_WORKDIR om de tussenstappen en de preview te bewaren.
"""

import os
import subprocess
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "docs", "referentie_goat.png")
UIT = os.path.join(ROOT, "src", "features", "rating", "components", "goat",
                   "assets")
WORK = os.environ.get("GOAT_WORKDIR", tempfile.mkdtemp(prefix="goat-master-"))
TMP = os.path.join(WORK, "parts")
os.makedirs(TMP, exist_ok=True)

CW, CH = 1024, 1664                 # mastercanvas
MASTER_LEFT, MASTER_TOP, MASTER_W = 0.20, 0.53, 1.40
CARD_W = CW / MASTER_W              # 731
CARD_H = CARD_W * 1.39              # 1016
CARD_X = MASTER_LEFT * CARD_W       # 146
CARD_Y = MASTER_TOP * CARD_H        # 539
CARD_MID = CARD_X + CARD_W / 2

RX0, RY0, RX1, RY1 = 118.0, 573.0, 812.0, 1490.0
RW, RH = RX1 - RX0, RY1 - RY0       # 694 x 917
S = CARD_W / RW                     # 1.053: kaartgebonden schaal
SY = CARD_H / RH                    # 1.108: verticale kaartmapping
TOP_S = 0.95                        # het monument vult de breakout bijna 1:1

# Naamplaatlijn van de echte kaart, als fractie van de kaarthoogte. Daar
# eindigt de bergscene, net als op de referentie.
NAAMPLAAT = 0.658


def run(args):
    subprocess.run([str(a) for a in args], check=True)


def kaart_x(x):
    return CARD_X + (x - RX0) * S


def kaart_y(y):
    return CARD_Y + (y - RY0) * SY


def element(naam, box, polygoon=None, feather=12, schaal=1.0, schaal_y=None,
            level="4%,34%", boost=None, boost_feather=12):
    """Sleutelt een uitsnede vrij en levert (pad, breedte, hoogte)."""
    x, y, w, h = box
    rgb = os.path.join(TMP, f"{naam}-rgb.png")
    alpha = os.path.join(TMP, f"{naam}-alpha.png")
    uit = os.path.join(TMP, f"{naam}.png")

    run(["magick", REF, "-crop", f"{w}x{h}+{x}+{y}", "+repage", rgb])
    run(["magick", rgb, "-colorspace", "gray", "-level", level, alpha])

    if boost:
        # Donkere, volledig gevulde massa (rots, bergflank) opaak forceren:
        # luminantiesleutel alleen zou er een halftransparante vlek van maken.
        punten = " ".join(f"{px - x},{py - y}" for px, py in boost)
        b = os.path.join(TMP, f"{naam}-boost.png")
        run(["magick", "-size", f"{w}x{h}", "xc:black", "-fill", "white",
             "-stroke", "none", "-draw", f"polygon {punten}",
             "-blur", f"0x{boost_feather}", b])
        run(["magick", alpha, b, "-compose", "Lighten", "-composite", alpha])

    if polygoon:
        punten = " ".join(f"{px - x},{py - y}" for px, py in polygoon)
        masker = os.path.join(TMP, f"{naam}-mask.png")
        run(["magick", "-size", f"{w}x{h}", "xc:black", "-fill", "white",
             "-stroke", "none", "-draw", f"polygon {punten}",
             "-blur", f"0x{feather}", masker])
        run(["magick", alpha, masker, "-compose", "Multiply", "-composite",
             alpha])

    run(["magick", rgb, alpha, "-alpha", "off", "-compose", "CopyOpacity",
         "-composite", uit])
    sy = schaal if schaal_y is None else schaal_y
    if schaal != 1.0 or sy != 1.0:
        bw, bh = round(w * schaal), round(h * sy)
        run(["magick", uit, "-filter", "Lanczos", "-resize", f"{bw}x{bh}!", uit])
        return uit, bw, bh
    return uit, w, h


# --- elementen ---------------------------------------------------------------
# 1. Geitmonument op de rots. De polygoon snijdt de rechterspiraal weg; de
#    boost houdt de donkere rots opaak.
goat = element(
    "goat", (318, 16, 392, 552),
    polygoon=[(345, 575), (338, 470), (350, 330), (382, 190), (420, 70),
              (470, 22), (545, 32), (612, 70), (668, 112), (692, 168),
              (676, 220), (630, 250), (604, 330), (614, 400), (652, 455),
              (684, 520), (692, 566)],
    boost=[(352, 564), (366, 500), (404, 452), (444, 424), (500, 414),
           (560, 428), (622, 456), (668, 502), (688, 564)],
    boost_feather=9, feather=16, schaal=TOP_S,
)

# 2/3. De twee spiraalhoorns los, zodat ze verder naar buiten kunnen dan de
#      compactere topschaal alleen zou toestaan.
hoorn_l = element(
    "hoorn-links", (8, 196, 332, 460),
    polygoon=[(10, 200), (338, 200), (338, 564), (150, 566), (120, 566),
              (108, 650), (30, 652), (8, 596)],
    feather=16, schaal=TOP_S,
)
hoorn_r = element(
    "hoorn-rechts", (608, 196, 330, 460),
    polygoon=[(700, 200), (934, 200), (936, 600), (930, 652), (848, 654),
              (812, 566), (770, 564), (700, 560), (650, 486), (620, 404),
              (626, 318), (658, 238)],
    feather=16, schaal=TOP_S,
)

# 4/5. Kristalclusters langs de flanken. Boven de kaart mag de uitsnede breed
#      zijn; langs het schild loopt de rand net buiten het frame, met twee
#      wiggen die de kristalpunten over het frame heen vrijhouden.
kristal_l = element(
    "kristal-links", (2, 400, 190, 830),
    polygoon=[(2, 402), (190, 402), (190, 534), (150, 552), (116, 566),
              (110, 600), (110, 900), (152, 936), (155, 986), (140, 1012),
              (147, 1042), (140, 1082), (118, 1104), (110, 1228), (2, 1228)],
    feather=8, schaal=S,
)
kristal_r = element(
    "kristal-rechts", (740, 400, 199, 830),
    polygoon=[(937, 402), (742, 402), (742, 530), (784, 550), (814, 566),
              (820, 600), (820, 884), (782, 1008), (778, 1060), (802, 1092),
              (818, 1108), (820, 1228), (937, 1228)],
    feather=8, schaal=S,
)

# 6. Bergscene voor het kaartvlak: de polygoon volgt de bergrug, zodat de
#    nevel rond rating en avatar buiten het artwork blijft.
berg = element(
    "berg", (168, 828, 598, 260),
    polygoon=[(168, 1086), (168, 1050), (200, 1040), (250, 1014), (300, 984),
              (350, 944), (390, 896), (432, 838), (470, 892), (506, 932),
              (546, 968), (586, 996), (626, 1006), (666, 1016), (706, 1026),
              (760, 1036), (764, 1040), (764, 1086)],
    boost=[(182, 1082), (200, 1044), (300, 990), (390, 902), (432, 852),
           (500, 930), (600, 1000), (700, 1030), (756, 1042), (756, 1082)],
    boost_feather=10, feather=7, schaal=S * 1.10, schaal_y=S * 1.30,
)

# 7. Kristalchevron met edelsteen in de schildpunt.
gem = element(
    "gem", (326, 1276, 282, 232),
    polygoon=[(340, 1288), (430, 1282), (466, 1298), (500, 1282), (596, 1290),
              (600, 1348), (516, 1408), (502, 1450), (484, 1508), (450, 1508),
              (432, 1450), (418, 1408), (336, 1350)],
    feather=6, schaal=S * 0.80,
)


PLAATSING = {}


def plaats(el, mid_x, top_y, naam=None):
    pad, w, h = el
    x0, y0 = round(mid_x - w / 2), round(top_y)
    PLAATSING[naam or pad] = (x0, y0, x0 + w, y0 + h)
    return ["(", pad, ")", "-geometry", f"+{x0}+{y0}", "-composite"]


# --- compositie --------------------------------------------------------------
cmd = ["magick", "-size", f"{CW}x{CH}", "xc:none"]

# Hoorns eerst; de geit staat ervoor. De onderkant van elke coil duikt net
# onder de bovenrand van de kaart, zodat hij achter het frame verdwijnt.
def top_y(crop_y0):
    """Verticale plaatsing van een topelement: de referentierelatie tot de
    bovenrand van de kaart, op de compactere topschaal."""
    return CARD_Y - (573 - crop_y0) * TOP_S


# De geit ankert de topgroep; beide hoorns sluiten aan op zijn nevel en
# steken even ver buiten de flanken uit.
GOAT_X0 = CARD_MID + 50 - goat[1] / 2          # linkerrand van de geituitsnede
cmd += plaats(hoorn_l, GOAT_X0 - 4 - hoorn_l[1] / 2, top_y(196) + 10,
              'hoorn_l')
cmd += plaats(hoorn_r,
              GOAT_X0 + (608 - 318) * TOP_S + hoorn_r[1] / 2, top_y(196) + 10,
              'hoorn_r')
cmd += plaats(goat, CARD_MID + 50, top_y(16) + 46, 'goat')

# Bergscene: basis op de naamplaatlijn.
cmd += plaats(berg, CARD_MID + 8, CARD_Y + NAAMPLAAT * CARD_H - berg[2],
              'berg')

# Kristallen: de binnenrand valt onder het echte frame.
cmd += plaats(kristal_l, kaart_x(2) + kristal_l[1] / 2, kaart_y(400),
              'kristal_l')
cmd += plaats(kristal_r, kaart_x(740) + kristal_r[1] / 2, kaart_y(400),
              'kristal_r')

# Edelsteen: punt tegen de schildpunt.
cmd += plaats(gem, CARD_MID, CARD_Y + CARD_H - gem[2] + 8, 'gem')

uit_png = os.path.join(WORK, "goat-master.png")
cmd += [uit_png]
run(cmd)

run(["magick", uit_png, "-strip", "-define", "webp:method=6",
     "-define", "webp:alpha-quality=60", "-quality", "76",
     os.path.join(UIT, "goat-master.webp")])

preview = os.path.join(WORK, "master-preview.png")
run(["magick", "-size", f"{CW}x{CH}", "xc:#141014", uit_png, "-composite",
     "-fill", "none", "-stroke", "#00ff88", "-strokewidth", "3",
     "-draw", (f"rectangle {round(CARD_X)},{round(CARD_Y)} "
               f"{round(CARD_X + CARD_W)},{round(CARD_Y + CARD_H)}"),
     "-resize", "560x", preview])
for k, v in PLAATSING.items():
    print(f"  {k}: {v}")
print("card box:", round(CARD_X), round(CARD_Y), round(CARD_W), round(CARD_H))
print(subprocess.run(["identify", os.path.join(UIT, "goat-master.webp")],
                     capture_output=True, text=True).stdout.strip())
