#!/usr/bin/env python3
"""Snijdt de artwork-onderdelen van de In-Form-dashboardkaart uit de referentie.

    python3.13 scripts/inform-dashboard-onderdelen.py [--preview]

Bron is `docs/dashboard/in_form_dashboard.png` zelf, niet het master-artwork van
de ⚡-FUT-kaart. Dat is een bewuste afwijking van de Big Daddy-dashboardkaart,
die haar onderdelen wél uit het blad van haar FUT-master haalt (#834). De reden
staat in docs/dashboard/in-form-dashboardkaart.md §6: het silhouet van
`storm-master.webp` past, maar de kleur niet — die master is blauwgrijs met één
gouden ontlading, de referentie is goud-dominant met een dicht vertakt web. Op
een kaart die verder alleen zwart en champagnegoud draagt is dat het verschil
tussen een storm en een blauwe wolk.

De referentie staat op vrijwel zwart (#0d0d10), dus dit is het luminantieregime
van pias-master.py en piet-master.py: alfa volgt de helderheid, en de kleur wordt
teruggerekend uit de compositie over zwart (unpremultiply). Wat daaruit komt is
per constructie identiek aan de referentie zodra het wéér op zwart landt — en dat
is precies waar het naartoe gaat, want het kaartvlak van deze kaart ís #0d0d10.

Twee dingen die de uitsnede sturen:

  * De kaartinhoud staat óók op dat zwart en heeft dezelfde luminantie als de
    storm. Een key alleen is dus niet genoeg: chips, coachcapsule en knoppen
    worden met een expliciete, uitgeveerde knockout weggehaald. De uitsnede is
    zo gekozen dat die knockouts in de zone vallen waar het onderdeel tóch naar
    transparant uitdooft — links, waar de tekstkolom begint.
  * Het racketsilhouet blijft er bewust ín, als gat. Het racket is donkerder dan
    de storm, dus de key maakt het transparant; op het zwarte kaartvlak leest dat
    gat als het silhouet uit de referentie. Eén onderdeel minder, en het kan per
    constructie niet uit registratie lopen met de wolk eromheen.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs" / "dashboard" / "in_form_dashboard.png"
UIT = WORTEL / "src/features/dashboard/components/inform/assets"
MANIFEST = WORTEL / "src/features/dashboard/components/inform/onderdelen.json"

# Het kaartvlak in de referentie: de kaartbox ligt op x 47…1733 en y 57…842, en
# daar gaan rail (9), band (6) en keyline (4) nog vanaf. Geen enkele uitsnede
# mag hier buiten komen — anders zit er een stuk gouden lijst in het artwork en
# staat er in de app een tweede rand middenin de kaart.
VLAK = (66, 76, 1714, 823)

# Luminantiekey. De ondergrens ligt net boven het kaartvlak (#0d0d10, luminantie
# ≈ 14) plus de diagonale groeven die de referentie er al overheen legt; de
# bovengrens is waar wolkrand in wolk overgaat. Lager en het onderdeel krijgt een
# rechthoekige waas mee, hoger en de rookranden worden hard.
KEY_LAAG = 17.0
KEY_HOOG = 46.0

# Bewust laag: het gewicht van dit onderdeel zit niet in de kleur maar in de
# fijne wolkstructuur en het alfakanaal. Van 82/92 naar 78/80 scheelt 50 kB en is
# op het kaartvlak niet te zien; resolutie is hier de echte knop (760 → 680 px
# scheelt nog eens 50). De bundel staat met de Big Daddy-onderdelen al op
# 10,3 MB van de 11 uit assetBudget.test.ts.
KWALITEIT = 78
ALFA_KWALITEIT = 80


def luminantie(rgb: np.ndarray) -> np.ndarray:
    return (
        0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    )


def soepel(t: np.ndarray) -> np.ndarray:
    """Vloeiende 0→1-overgang; smoothstep houdt de keyrand vrij van een bandje."""
    k = np.clip(t, 0.0, 1.0)
    return k * k * (3.0 - 2.0 * k)


def alfa_vak(alfa: np.ndarray, drempel: int = 6) -> tuple[int, int, int, int]:
    """Kleinste rechthoek waarin de alfa nog meetelt.

    De drempel ligt bewust boven nul: de uitgeveerde rand loopt naar 0 en een
    bbox op `> 0` zou de hele snee teruggeven, inclusief de lucht die we net
    hebben weggeveerd.
    """
    rijen = np.where(alfa.max(axis=1) >= drempel)[0]
    kolommen = np.where(alfa.max(axis=0) >= drempel)[0]
    if not len(rijen) or not len(kolommen):
        raise SystemExit("onderdeel is volledig transparant")
    return int(kolommen[0]), int(rijen[0]), int(kolommen[-1]) + 1, int(rijen[-1]) + 1


def knockout(vorm: tuple[int, int], vakken, vlakken, waas: float) -> np.ndarray:
    """Uitgeveerd masker dat de opgegeven rechthoeken en veelhoeken op 0 zet."""
    masker = Image.new("L", (vorm[1], vorm[0]), 255)
    tekenaar = ImageDraw.Draw(masker)
    for x0, y0, x1, y1 in vakken:
        tekenaar.rounded_rectangle([x0, y0, x1, y1], radius=24, fill=0)
    for punten in vlakken:
        tekenaar.polygon(punten, fill=0)
    # Klein houden: een blur die groter is dan de helft van het weggehaalde
    # vak haalt de kern nooit tot nul, en dan blijft er een spookaftekening
    # van de kaartinhoud in het artwork staan — bij 26 px op een capsule van
    # 92 px hoog kwam het midden niet verder dan 0,07.
    masker = masker.filter(ImageFilter.GaussianBlur(waas))
    return np.asarray(masker, dtype=np.float32) / 255.0


def veer(vorm: tuple[int, int], links=0, boven=0, rechts=0, onder=0) -> np.ndarray:
    """Randen die naar transparant uitdoven, in pixels van de uitsnede."""
    h, b = vorm
    x = np.arange(b, dtype=np.float32)
    y = np.arange(h, dtype=np.float32)[:, None]
    f = np.ones((h, b), dtype=np.float32)
    if links:
        f = np.minimum(f, soepel(x / links)[None, :])
    if rechts:
        f = np.minimum(f, soepel((b - 1 - x) / rechts)[None, :])
    if boven:
        f = np.minimum(f, soepel(y / boven))
    if onder:
        f = np.minimum(f, soepel((h - 1 - y) / onder))
    return f


# Per onderdeel:
#   snee     [x0, y0, x1, y1] in referentiepixels, binnen VLAK
#   breedte  doelbreedte in pixels — twee keer de grootste maat waarop de CSS het
#            onderdeel ooit toont (de `clamp()`-bovengrens), zodat het op een
#            retina-scherm scherp blijft en geen byte zwaarder is dan dat
#   veer     uitdoving per rand, in sneepixels
#   weg      rechthoeken met kaartinhoud die uit de snee moeten
#   weg_vlak veelhoeken idem — de chamfer van de keyline is geen rechthoek
ONDERDELEN = [
    {
        "naam": "storm",
        # De stormkolom van de rechterflank: van de bovenrand tot net boven de
        # scheidingslijn. Bewust níét dóór tot de onderrand — daar staat in de
        # referentie de knop "Vrije banen" middenop de wolk, en een knockout op
        # die plek zou een rechthoekig gat in de massa slaan in plaats van in de
        # uitdoofzone. De kolom is 72% van de kaarthoogte en wordt in de CSS op
        # de volle hoogte gezet; wolkschaal is geen vaste maat.
        # De linkergrens ligt rechts van de badgerij (eindigt op x 1227): alles
        # wat verder naar links staat is kaartinhoud, en die uit een snee
        # wegpoetsen laat spookranden achter waar de wolk juist het dunst is.
        "snee": [1240, 90, 1698, 650],
        "breedte": 680,
        # Links diep uitgeveerd: dáár begint de tekstkolom, en wit op een
        # bliksemkern haalt 3,1:1. De veer is de harde grens uit §5, niet smaak.
        "veer": {"links": 170, "boven": 22, "rechts": 12, "onder": 80},
        # Wat er in die uitdoofzone nog aan kaartinhoud staat: de rechterpunt van
        # de editie-chip, van de Kampioen-chip en van de coachcapsule.
        "weg": [
            (1200, 190, 1306, 282),
            (1200, 331, 1370, 429),
            (1200, 523, 1418, 623),
        ],
        # De chamfer van de rechterbovenhoek: dáár snijdt de gouden keyline
        # diagonaal door de rechthoekige snee heen.
        "weg_vlak": [[(1650, 82), (1704, 82), (1704, 140)]],
    },
    {
        "naam": "ember",
        # De vonkensleep in de linkeronderhoek: een handvol vonken en één dunne
        # vertakking. In de referentie is dit het enige dat de storm aan de
        # overkant van de kaart beantwoordt, en het houdt de compositie ervan af
        # helemaal naar rechts te kantelen. De snee ligt klem tussen de vormrij
        # (eindigt op y 745) en de chamfer van de linkeronderhoek (begint rond
        # x 105 op y 805) — vandaar dat hij smal is en niet tot in de hoek loopt.
        "snee": [78, 742, 300, 806],
        "breedte": 460,
        "veer": {"links": 16, "boven": 16, "rechts": 90, "onder": 14},
    },
]


def bouw(bron: Image.Image, o: dict) -> dict:
    x0, y0, x1, y1 = o["snee"]
    if x0 < VLAK[0] or y0 < VLAK[1] or x1 > VLAK[2] or y1 > VLAK[3]:
        raise SystemExit(f"snee van {o['naam']} valt buiten het kaartvlak")

    rgb = np.asarray(bron.crop((x0, y0, x1, y1)), dtype=np.float32)
    h, b = rgb.shape[:2]

    alfa = soepel((luminantie(rgb) - KEY_LAAG) / (KEY_HOOG - KEY_LAAG))
    if o.get("weg") or o.get("weg_vlak"):
        vakken = [(a - x0, c - y0, d - x0, e - y0) for a, c, d, e in o.get("weg", [])]
        vlakken = [
            [(px - x0, py - y0) for px, py in punten]
            for punten in o.get("weg_vlak", [])
        ]
        alfa *= knockout((h, b), vakken, vlakken, waas=10.0)
    alfa *= veer((h, b), **o.get("veer", {}))

    # Terugrekenen uit de compositie over zwart: het onderdeel landt straks weer
    # op #0d0d10, dus zonder deze stap zou elke halftransparante wolkrand een
    # tweede keer met zijn eigen alfa worden vermenigvuldigd en grijs wegzakken.
    #
    # De vloer van 0,15 is geen epsilon maar het hele verschil tussen een schone
    # snee en een spookbeeld. Deel je door de kale alfa, dan krijgt een pixel die
    # de knockout net heeft weggehaald — kaartinhoud, dus hélder — een kleur van
    # 255 mee. Onzichtbaar zolang die alfa 0 blijft, maar de LANCZOS-schaling
    # hieronder middelt straight-alpha RGBA en trekt dat wit zo de half-
    # doorzichtige buren in: de coachcapsule kwam daardoor als lichte tekst terug
    # in een wolk waar hij allang uit gesneden was.
    veilig = np.maximum(alfa, 0.15)[..., None]
    kleur = np.clip(rgb / veilig, 0, 255)

    a8 = np.clip(alfa * 255.0, 0, 255).astype(np.uint8)
    vak = alfa_vak(a8)

    # Schalen gebeurt premultiplied en pas daarna terug: het gemiddelde van twee
    # buren is alleen zinnig als de kleur al met zijn dekking is gewogen.
    prem = np.dstack([kleur * alfa[..., None], alfa * 255.0]).astype(np.uint8)
    doel_b = o["breedte"]
    doel_h = max(1, round(doel_b * (vak[3] - vak[1]) / (vak[2] - vak[0])))
    klein = np.asarray(
        Image.fromarray(prem, "RGBA").crop(vak).resize((doel_b, doel_h), Image.LANCZOS),
        dtype=np.float32,
    )
    ka = np.maximum(klein[..., 3:4] / 255.0, 1e-4)
    deel = Image.fromarray(
        np.dstack(
            [np.clip(klein[..., :3] / ka, 0, 255), klein[..., 3]]
        ).astype(np.uint8),
        "RGBA",
    )
    pad = UIT / f"if-{o['naam']}.webp"
    deel.save(pad, "WEBP", quality=KWALITEIT, alpha_quality=ALFA_KWALITEIT, method=6)
    return {
        "naam": o["naam"],
        "bestand": pad.name,
        "breedte": o["breedte"],
        "hoogte": doel_h,
        "kb": round(pad.stat().st_size / 1024, 1),
    }


UIT.mkdir(parents=True, exist_ok=True)
bron = Image.open(REFERENTIE).convert("RGB")
manifest = [bouw(bron, o) for o in ONDERDELEN]

MANIFEST.write_text(
    json.dumps(
        {
            "_": "Gegenereerd door scripts/inform-dashboard-onderdelen.py — niet met de hand bijwerken.",
            "onderdelen": [
                {k: v for k, v in m.items() if k != "kb"} for m in manifest
            ],
        },
        indent=2,
        ensure_ascii=False,
    )
    + "\n"
)

for m in manifest:
    print(f"{m['bestand']:<20} {m['breedte']}×{m['hoogte']}  {m['kb']} kB")
print(f"totaal {sum(m['kb'] for m in manifest):.1f} kB")

if "--preview" in sys.argv:
    # Keurplaat op het échte kaartvlak: een onderdeel dat op zwart wordt
    # beoordeeld maar op grijs wordt gekeurd, lijkt altijd te donker.
    hoogte = 620
    delen = [Image.open(UIT / m["bestand"]) for m in manifest]
    geschaald = [d.resize((round(d.width * hoogte / d.height), hoogte)) for d in delen]
    plaat = Image.new("RGB", (sum(d.width for d in geschaald) + 60, hoogte + 40), "#0d0d10")
    x = 20
    for d in geschaald:
        plaat.paste(d, (x, 20), d)
        x += d.width + 20
    uit = Path(sys.argv[sys.argv.index("--preview") + 1]) if len(sys.argv) > sys.argv.index("--preview") + 1 else WORTEL / "if-preview.png"
    plaat.save(uit)
    print(uit)
