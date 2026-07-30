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
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "referentie_pias.png"
DOEL = (
    WORTEL
    / "src/features/rating/components/pias/assets/pias-master.webp"
)
BREEDTE = 768
KWALITEIT = 78

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


def bouw() -> Image.Image:
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

    kaart = dilate(contour(KAART), 14)

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

    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = np.clip(a, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    beeld = Image.fromarray(rgba, "RGBA")
    return beeld.resize((BREEDTE, round(H * BREEDTE / W)), Image.LANCZOS)


def main() -> int:
    beeld = bouw()
    DOEL.parent.mkdir(parents=True, exist_ok=True)
    beeld.save(DOEL, "WEBP", quality=KWALITEIT, method=6)
    print(f"{DOEL.relative_to(WORTEL)}: {beeld.size[0]}×{beeld.size[1]}, "
          f"{DOEL.stat().st_size // 1024} kB")
    if "--preview" in sys.argv:
        plaat = Image.new("RGB", beeld.size, (26, 28, 34))
        plaat.paste(beeld, (0, 0), beeld)
        pad = WORTEL / "screenshots" / "pias" / "master-preview.png"
        pad.parent.mkdir(parents=True, exist_ok=True)
        plaat.save(pad)
        print(f"{pad.relative_to(WORTEL)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
