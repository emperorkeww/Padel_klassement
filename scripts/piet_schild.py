#!/usr/bin/env python3
"""Leid de schildvorm van de Zwarte Piet-kaart af uit de referentie.

De referentiekaart heeft geen vlakke bovenrand maar een ogeeboog: de hoeken
lopen schuin omhoog naar een spits kruinstuk waar de gouden crest op rust. Dat
silhouet is het meest herkenbare aan de kaart, en zolang het app-schild vlak
bleef moest élke randgebonden laag in het artwork worden bijgestuurd om er niet
dwars overheen te lopen.

Dit script drukt het `d`-attribuut af voor `#fut-schild-piet` in FutKaart.tsx en
levert `schild_uv()` aan `piet-onderdelen.py`, zodat artwork en kaartclip per
constructie dezelfde contour delen.

    python3.13 scripts/piet_schild.py
    python3.13 scripts/piet_schild.py --overlay /tmp/piet-schild.png

De overlay tekent de contour over de referentie. Dat is de enige echte controle:
de gouden lijst van het bronbeeld moet er precies onder liggen.
"""

from __future__ import annotations

import sys

import numpy as np

# ── Gemeten op docs/referentie_zwarte_piet.png (1086 × 1448) ────────────────
#
# De rechte zijkanten zijn het betrouwbaarste ijkpunt: tussen y=300 en y=760
# ligt daar een ononderbroken gouden rail. Een goudmasker (R>95, R−B>28,
# luma>75) geeft daar per rij twee runs — de binnenrail op x≈910–915 en de
# buitenrail op x≈924–930, links gespiegeld op x≈148–152 en x≈165–170. De
# buitenrand van de lijst is dus x=146 en x=931.
KAART_X0, KAART_X1 = 146.0, 931.0
KAART_B = KAART_X1 - KAART_X0
KAART_H = KAART_B * 139.0 / 100.0
AS = (KAART_X0 + KAART_X1) / 2.0

# De buitenrand van de ogeeboog, linkerhelft. Deze punten zijn níet puur
# automatisch bepaald: een goudmasker vindt hierboven net zo goed de kettingen,
# de crest en de veren, en die liggen precies op de boog. De reeks is daarom met
# de hand gelegd en met `--overlay` op de referentie nageregeld tot hij overal
# net bínnen de gouden band valt — binnen, want de lijst komt uit het artwork en
# moet de kaartrand kunnen overlappen. De kruin zelf gaat schuil achter de crest
# met het Piet-silhouet en volgt uit het doortrekken van de flanken.
BOOG_LINKS = [
    (146, 302),
    (170, 284),
    (200, 265),
    (240, 239),
    (280, 216),
    (320, 197),
    (360, 180),
    (400, 166),
    (440, 153),
    (480, 143),
    (520, 137),
    (538, 135),
]
KRUIN = 133.0

# Vanaf welke hoogte de zijkanten recht naar beneden lopen: de boog is bij de
# schouder al bijna verticaal.
ZIJKANT_V = 0.60

# De onderkant. Anders dan bij het oude Piet-schild (een brede vlakke rand)
# loopt deze weer naar een punt op (0.5, 1) — het anker waar de chemielijn in de
# Opstelling op mikt. Dat kan hier ook: in de nieuwe referentie convergeert het
# paneel zelf naar een brede punt onder de badge-rij, waar de gevleugelde
# medaille overheen ligt.
#
# De punt is bewust breed en laat: het paneel blijft vol tot v≈0.80, want daar
# staan het statblok (v 0.81–0.87) en de badge-rij (v 0.90–0.98) nog in. Een
# taper vanaf 0.60, zoals de gedeelde schilden hebben, snijdt die twee aan.
ONDER_V = 0.80
ONDER = (
    f"L 1 {ONDER_V} "
    "C 1 0.9180 0.9450 0.9610 0.8600 0.9820 "
    "C 0.7300 0.9970 0.6000 1 0.5000 1 "
    "C 0.4000 1 0.2700 0.9970 0.1400 0.9820 "
    "C 0.0550 0.9610 0 0.9180 0 " + f"{ONDER_V}"
)


def _boog_punten() -> list[tuple[float, float]]:
    """De volle boog in referentiepixels, gespiegeld om de as."""
    links = list(BOOG_LINKS)
    rechts = [(2 * AS - x, y) for x, y in reversed(links[:-1])]
    return links + rechts


def schild_uv() -> tuple[list[tuple[float, float]], float]:
    """Het schild als (u, v)-punten in kaartbox-fracties, plus de kruin.

    `piet-onderdelen.py` importeert dit: het artwork moet op exact hetzelfde
    schild worden geregistreerd als de kaart zelf, anders loopt de gouden lijst
    van het bronbeeld naast de rand van de kaart.
    """
    punten = _boog_punten()
    u = (np.array([p[0] for p in punten], float) - KAART_X0) / KAART_B
    v = (np.array([p[1] for p in punten], float) - KRUIN) / KAART_H
    return list(zip(u.tolist(), v.tolist())), KRUIN


def _onder_beziers() -> list[tuple]:
    """De onderkant als vier kubische segmenten in (u, v)."""
    return [
        ((1.0, ONDER_V), (1.0, 0.918), (0.945, 0.961), (0.86, 0.982)),
        ((0.86, 0.982), (0.73, 0.997), (0.60, 1.0), (0.50, 1.0)),
        ((0.50, 1.0), (0.40, 1.0), (0.27, 0.997), (0.14, 0.982)),
        ((0.14, 0.982), (0.055, 0.961), (0.0, 0.918), (0.0, ONDER_V)),
    ]


def schild_pixels() -> list[tuple[float, float]]:
    """Het volledige schild als polygoon in referentiepixels.

    `piet-onderdelen.py` gebruikt dit om het artwork op exact dezelfde contour
    te scheiden als de kaartclip. Eén bron, dus geen tweede set getallen die uit
    de pas kan lopen.
    """
    punten, _ = schild_uv()
    uv = list(punten) + [(1.0, ZIJKANT_V)]
    for p0, p1, p2, p3 in _onder_beziers():
        for i in range(1, 21):
            t = i / 20
            m = 1 - t
            uv.append(
                (
                    m**3 * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t**3 * p3[0],
                    m**3 * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t**3 * p3[1],
                )
            )
    return [(KAART_X0 + u * KAART_B, KRUIN + v * KAART_H) for u, v in uv]


def schildpad() -> str:
    """Het `d`-attribuut voor #fut-schild-piet (objectBoundingBox)."""
    punten, _ = schild_uv()
    boog = " ".join(f"L {u:.4f} {v:.4f}" for u, v in punten[1:])
    return (
        f"M {punten[0][0]:.4f} {punten[0][1]:.4f} "
        f"{boog} "
        f"L 1 {ZIJKANT_V} "
        f"{ONDER} "
        "Z"
    )


def overlay(doel: str) -> None:
    """Teken de contour over de referentie — de visuele controle op de meting."""
    from PIL import Image, ImageDraw

    ref = "docs/referentie_zwarte_piet.png"
    im = Image.open(ref).convert("RGB")
    tekenaar = ImageDraw.Draw(im)

    def naar_pixels(u: float, v: float) -> tuple[float, float]:
        return KAART_X0 + u * KAART_B, KRUIN + v * KAART_H

    pad = schild_pixels()
    tekenaar.line(pad + [pad[0]], fill=(255, 0, 255), width=3)
    im.save(doel)
    print(f"overlay -> {doel}")


def main() -> None:
    if "--overlay" in sys.argv:
        overlay(sys.argv[sys.argv.index("--overlay") + 1])
        return
    print(
        f"kaartbox: x[{KAART_X0:.0f}, {KAART_X1:.0f}] "
        f"y[{KRUIN:.0f}, {KRUIN + KAART_H:.0f}]  "
        f"breedte {KAART_B:.0f} hoogte {KAART_H:.0f}"
    )
    print()
    print(schildpad())


if __name__ == "__main__":
    main()
