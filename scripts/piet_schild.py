#!/usr/bin/env python3
"""Leid de schildvorm van de Zwarte Piet-kaart af uit de referentie.

De referentiekaart heeft geen vlakke bovenrand maar een ogeeboog: de hoeken
lopen schuin omhoog naar een breed, licht gebogen kruinstuk waar de gevleugelde
crest op rust. Dat silhouet is het meest herkenbare aan de kaart, en zolang het
app-schild vlak bleef moest élke randgebonden laag in het artwork worden
bijgestuurd om er niet dwars overheen te lopen.

Dit script drukt het `d`-attribuut af voor `#fut-schild-piet` in FutKaart.tsx.
De bovenrand komt uit de gemeten boog van de referentie; de onderkant is
onveranderd die van de andere schilden — de punt op 50%/100% is het anker waar
de chemielijn in de Opstelling op mikt en blijft dus staan.

    python3 scripts/piet_schild.py
"""

import numpy as np

# De binnenrand van de boog: per kolom de eerste perkamentrij in
# docs/referentie_zwarte_piet.png, gemeten op de linkerhelft en
# gespiegeld om het vlakmidden x=549,5.
BOOG_BINNEN = [
    (191, 238), (200, 230), (220, 226), (240, 219), (260, 209), (280, 200),
    (300, 188), (320, 177), (340, 165), (360, 152), (380, 141), (400, 132),
    (420, 128), (440, 126), (470, 125), (500, 124), (549, 124),
]
# Dikte van de referentielijst, gemeten op de rechte zijkanten: perkament op
# x=191, donkere buitenrand op x=152.
LIJST = 39.0
# De kaartbox in referentiepixels. Links/rechts de buitenrand van de lijst; de
# hoogte volgt uit de vaste kaartverhouding, niet uit de referentie, want de
# onderkant van het schild blijft die van de app.
KAART_X0, KAART_X1 = 152.0, 936.0
KAART_B = KAART_X1 - KAART_X0
KAART_H = KAART_B * 139.0 / 100.0

# De onderkant. Anders dan bij de andere schilden géén punt op (0.5, 1) maar de
# brede, ruim afgeronde onderrand van de referentie.
#
# Dat is geen cosmetische keuze. Onder de kaart hangt in de referentie één
# doorlopend bouwsel — kettingen die langs de zijkanten naar beneden lopen, een
# lint, een medaille — en dat houdt elkaar vast omdát alles op één brede
# onderrand aankomt. Op een punt is er geen rand om op aan te komen: de
# kettingen hangen dan naast een kaart die er niet meer is en de rozet zweeft
# eronder. Elke correctie daarvoor (kettingen naar binnen trekken, de groep
# omhoog schuiven, een schaduw onder het gat) bestreed het symptoom.
#
# De hoekstraal is 0,17 × kaartbreedte: ruim genoeg om als de zachte hoek van de
# referentie te lezen, en smal genoeg dat het rechte stuk (u 0,17–0,83) de rozet
# draagt, die van 0,19 tot 0,83 loopt.
HOEK_U = 0.17
HOEK_V = HOEK_U * 100.0 / 139.0
# Bolling van de hoek; 0,45 geeft een ronde kwartcirkel zonder zichtbare knik.
K = 0.45
ONDER = (
    f"L 1 {1 - HOEK_V:.4f} "
    f"C 1 {1 - HOEK_V * K:.4f} {1 - HOEK_U * K:.4f} 1 {1 - HOEK_U:.4f} 1 "
    f"L {HOEK_U:.4f} 1 "
    f"C {HOEK_U * K:.4f} 1 0 {1 - HOEK_V * K:.4f} 0 {1 - HOEK_V:.4f}"
)
# Vanaf welke hoogte de zijkanten recht naar beneden lopen.
ZIJKANT = 0.60


def buitenboog():
    """De binnenboog naar buiten verschoven over de lijstdikte."""
    pts = BOOG_BINNEN + [(1099 - x, y) for x, y in reversed(BOOG_BINNEN[:-1])]
    xs = np.array([p[0] for p in pts], float)
    ys = np.array([p[1] for p in pts], float)
    # Normaal uit de lokale helling; de boog is een functie y(x), dus de naar
    # buiten wijzende normaal is (-y', -1) genormaliseerd.
    dy = np.gradient(ys, xs)
    n = np.hypot(dy, 1.0)
    return xs - LIJST * dy / n, ys - LIJST / n


def schild_uv():
    """Het schild als (u, v)-punten in kaartbox-fracties, plus de kruin.

    piet-master.py importeert dit: het artwork moet op exact hetzelfde schild
    worden geregistreerd als de kaart zelf, anders loopt de rand van het
    bronbeeld weer naast de rand van de kaart.
    """
    bx, by = buitenboog()
    kruin = float(by.min())
    # y=0 van de kaartbox ligt op de kruin van de buitenboog.
    u = (bx - KAART_X0) / KAART_B
    v = (by - kruin) / KAART_H

    # De boog wordt aan beide kanten doorgetrokken tot de zijrand (u=0 en u=1),
    # zodat hij daar op de rechte zijkant aansluit.
    def verleng(u0, v0, u1, v1, doel):
        h = (doel - u0) / (u1 - u0)
        return v0 + (v1 - v0) * h

    # De schouder: de boog loopt daar bijna verticaal, dus doortrekken tot de
    # zijrand geeft een steile maar reële hoek. Links en rechts worden daarna
    # gespiegeld — de referentie is symmetrisch, de meting niet helemaal, en een
    # kaart met een scheve kruin leest onmiddellijk als een fout.
    v_schouder = verleng(u[0], v[0], u[1], v[1], 0.0)

    half = [(0.0, v_schouder)] + [(a, b) for a, b in zip(u, v) if a <= 0.5]
    punten = half + [(1.0 - a, b) for a, b in reversed(half)]
    return punten, kruin


def main():
    punten, kruin = schild_uv()
    boog = " ".join(f"L {p[0]:.4f} {p[1]:.4f}" for p in punten[1:])
    d = (
        f"M {punten[0][0]:.4f} {punten[0][1]:.4f} "
        f"{boog} "
        f"L 1 {ZIJKANT} "
        f"{ONDER} "
        f"Z"
    )
    print(f"kruin op referentie-y {kruin:.1f}; schouders op v={punten[0][1]:.4f}")
    print(f"kaartbox: x[{KAART_X0:.0f}, {KAART_X1:.0f}] y[{kruin:.1f}, "
          f"{kruin + KAART_H:.1f}]")
    print()
    print(d)


if __name__ == "__main__":
    main()
