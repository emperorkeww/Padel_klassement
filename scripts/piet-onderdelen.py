#!/usr/bin/env python3
"""Bouw de Zwarte Piet-artworklagen uit docs/referentie_zwarte_piet.png.

De referentie is een afgewerkte kaart op zwart: een gewatteerd donker paneel met
een dubbele gouden lijst, en daaromheen rook, goudstof, kettingen, kolen, een
sterrenzak, een cadeau, een staf met strik en veren. Alles staat additief op
zwart, dus één zwartkey volstaat — anders dan bij de vorige, perkamentkleurige
referentie, die twee extractieregimes nodig had.

Er komen drie bronnen uit, alle drie in het coördinatenstelsel van de referentie
(1086 × 1448) zodat ze één registratie delen:

* ``piet-vlak.webp``    — naadloze tegel van het gewatteerde paneel;
* ``piet-master.webp``  — de gouden lijst plus alles buiten de kaart, mínus de
                          voorwerpen die de lijst kruisen;
* ``piet-front.webp``   — uitsluitend die kruisende voorwerpen.

Draaien (de standaard-python3 mist numpy/Pillow/scipy):

    python3.13 scripts/piet-onderdelen.py --preview
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from piet_schild import (  # noqa: E402
    KAART_B,
    KAART_H,
    KAART_X0,
    KRUIN,
    schild_pixels,
)

WORTEL = Path(__file__).resolve().parent.parent
REF = WORTEL / "docs/referentie_zwarte_piet.png"
UIT = WORTEL / "src/features/rating/components/piet/assets"
PREVIEW = WORTEL / "screenshots/piet/onderdelen.png"

# Uitvoermaten. De master draagt de scherpe gouden lijst en gaat daarom het
# minst ver terug; de voorlaag ligt altijd bovenop een al scherpe master en mag
# een slag kleiner. Samen blijven ze onder de 544 kB die het vorige,
# ongesplitste piet-master.webp innam — het assetbudget (#732) groeit dus niet.
MASTER_DOEK = (782, 1042)
FRONT_DOEK = (597, 796)

# De breedte van de gouden lijst in referentiepixels, gemeten op de rechte
# zijkanten: buitenrail x 924–930, binnenrail x 910–915, met daarbinnen nog een
# donkere keyline. Alles binnen die ring is kaartvlak en komt uit de tegel.
LIJST = 44.0
# Hoe ver de voorlaag van de kaartrand af mag reiken. Ruimer dan de lijst, want
# een ketting of een staf die de lijst kruist hoort in zijn geheel mee; smaller
# dan de halve kaart, want dieper in het vlak komt geen voorwerp.
VOOR_BAND = 78.0


def blur(arr: np.ndarray, sigma: float) -> np.ndarray:
    beeld = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return np.asarray(beeld.filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32)


def smoothstep(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def stempel(shape, polys=(), ellipses=()) -> np.ndarray:
    m = Image.new("L", (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    for cx, cy, rx, ry in ellipses:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    return np.asarray(m).astype(np.float32) / 255.0


def rgba(kleur: np.ndarray, alpha: np.ndarray) -> Image.Image:
    uit = np.zeros((*alpha.shape, 4), np.uint8)
    uit[..., :3] = np.clip(kleur, 0, 255).astype(np.uint8)
    uit[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(uit, "RGBA")


def meet(pad: Path, beeld: Image.Image) -> dict:
    a = np.asarray(beeld.getchannel("A")).astype(np.float32) / 255
    return {
        "pixels": [beeld.width, beeld.height],
        "alfa": round(float(a.mean()), 4),
        "dekking": round(float((a >= 0.5).mean()), 4),
        "kB": pad.stat().st_size // 1024,
    }


# De ruit van het paneel, gemeten met autocorrelatie op een hoogdoorlaatversie
# van een schone strook (y 380–640, x 200–520): 103 px horizontaal, 94 px
# verticaal. De tegel is exact één periode, dus de overvloeiing verbindt twee
# stukken ruit die al identiek zijn en verschuift het patroon niet.
TEGEL_XY = (400, 560)
TEGEL_WH = (103, 94)


def quilttegel(img: np.ndarray) -> Image.Image:
    """Een naadloze tegel van het gewatteerde paneel.

    De uitsnede is het rustigste venster van het hele paneel — gezocht op de
    laagste piekluminantie binnen het kaartvlak, links van de portretring en
    tussen vormicoon en kroon. Ook daar liggen nog losse goudspikkels, en die
    zouden in een tegel bij élke herhaling terugkomen: ze worden daarom naar een
    mediaanversie toegetrokken. De ruit zelf is breder dan zo'n spikkel en
    overleeft die filter.
    """
    x, y = TEGEL_XY
    tw, th = TEGEL_WH
    tegel = img[y : y + th, x : x + tw].astype(np.float32).copy()
    zacht = ndimage.median_filter(tegel, size=(7, 7, 1))
    afwijking = np.abs(tegel - zacht).mean(axis=2)
    uitschieter = smoothstep(afwijking, 7.0, 20.0)[..., None]
    tegel = tegel * (1 - uitschieter) + zacht * uitschieter

    overlap = 12
    helling = np.linspace(0, 1, overlap, dtype=np.float32)
    tegel[:, :overlap] = (
        tegel[:, :overlap] * helling[None, :, None]
        + tegel[:, -overlap:] * (1 - helling[None, :, None])
    )
    tegel[:overlap] = (
        tegel[:overlap] * helling[:, None, None]
        + tegel[-overlap:] * (1 - helling[:, None, None])
    )
    return Image.fromarray(np.clip(tegel, 0, 255).astype(np.uint8), "RGB")


def bouw() -> dict[str, dict]:
    UIT.mkdir(parents=True, exist_ok=True)
    ref = Image.open(REF).convert("RGB")
    w, h = ref.size
    if (w, h) != (1086, 1448):
        raise SystemExit(f"verwacht referentie 1086x1448, kreeg {w}x{h}")
    img = np.asarray(ref).astype(np.float32)
    gray = img @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

    # ── 1. het schild, en daaruit lijst, vlak en voorgrondband ──────────────
    schild = stempel((h, w), polys=[schild_pixels()]) > 0.5
    dist_in = ndimage.distance_transform_edt(schild)
    dist_uit = ndimage.distance_transform_edt(~schild)
    # Het kaartvlak: alles meer dan een lijstbreedte binnen het schild. Dat gaat
    # in zijn geheel uit het artwork — rating, portret, naam, statblok en
    # badge-rij van de referentie zitten daarin, en de kaart tekent ze zelf. Eén
    # snede in plaats van een dozijn killzones, en per constructie geen
    # spookkopie naast de echte tekst.
    vlak = smoothstep(dist_in, LIJST, LIJST + 10.0)
    # De band waarin de voorlaag mag leven: van VOOR_BAND buiten tot VOOR_BAND
    # binnen de kaartrand.
    band = np.clip(1.0 - smoothstep(np.maximum(dist_in, dist_uit), VOOR_BAND, VOOR_BAND + 26.0), 0, 1)

    # ── 2. zwartkey ────────────────────────────────────────────────────────
    # De achtergrond is zwart, dus P = a·C en de alfa volgt uit de luminantie.
    # De pedestal van 8,5 knipt de ruisvloer weg; zonder die drempel houdt bijna
    # elke pixel wat alfa over en wordt het goudstof een gelijkmatige waas in
    # plaats van de trossen met lege gaten ertussen die de referentie heeft.
    a_lum = np.clip((gray - 8.5) / 52.0, 0.0, 1.0) ** 0.68
    # Massieve voorwerpen volgen hun eigen silhouet: kettingen, kolen, staf en
    # cadeau hebben veel lokaal contrast, rook heeft dat niet. Zonder deze boost
    # blijven de donkere flanken van een schakel half doorzichtig en kijk je
    # dwars door de ketting heen.
    detail = np.abs(gray - blur(gray, 5.0))
    solide = smoothstep(detail, 6.0, 22.0)
    solide = np.asarray(
        Image.fromarray((solide * 255).astype(np.uint8))
        .filter(ImageFilter.MaxFilter(9))
        .filter(ImageFilter.MinFilter(5))
    ).astype(np.float32) / 255.0
    solide = ndimage.binary_closing(solide > 0.35, np.ones((23, 23))).astype(np.float32)
    solide = blur(solide * 255, 3.0) / 255.0
    poort = np.clip((gray - 7.0) / 8.0, 0.0, 1.0)
    alpha = np.clip(a_lum + 0.85 * solide * poort, 0.0, 1.0)

    # ── 3. killzones: de ingebakken kaartinhoud van de referentie ──────────
    # Het meeste hiervan verdwijnt al met het kaartvlak uit stap 1. Toch staan
    # ze hier allemaal, om twee redenen. Ten eerste raken de blokken bij de
    # schuine bovenhoeken en langs de onderrand binnen een lijstbreedte van de
    # kaartrand — daar liet stap 1 een sliver van de "550" en de hele badge-rij
    # staan, en een halve letter naast de échte rating valt harder op dan een
    # hele. Ten tweede valt de chipstrip helemaal búiten de kaart, waar het
    # kaartvlak niets wegneemt en de app zijn eigen vormchips zet.
    # Binnen het vlak kost wissen niets: daar is het artwork toch al leeg.
    #
    # De begrenzing van de badge-rij stopt bewust op y=1194 — dáár begint de
    # gevleugelde medaille, en die hoort te blijven.
    killzones = np.maximum(
        stempel(
            (h, w),
            polys=[
                [(215, 270), (455, 270), (455, 400), (215, 400)],     # rating
                [(260, 400), (390, 400), (390, 475), (260, 475)],     # divisiecijfer
                [(280, 470), (360, 470), (360, 560), (280, 560)],     # vormemoji
                [(250, 630), (860, 630), (860, 810), (250, 810)],     # kroon + naam
                [(300, 815), (790, 815), (790, 885), (300, 885)],     # ondertitel
                [(300, 885), (790, 885), (790, 950), (300, 950)],     # spreuk
                [(270, 950), (830, 950), (830, 985), (270, 985)],     # scheidingslijn
                [(240, 985), (860, 985), (860, 1080), (240, 1080)],   # statblok
                [(370, 1070), (725, 1070), (725, 1194), (370, 1194)],  # badge-rij
                [(260, 1320), (830, 1320), (830, 1440), (260, 1440)],  # chipstrip
            ],
        ),
        # De portretcirkel met zijn gouden ring; de kaart zet zijn eigen avatar
        # met zijn eigen ring op die plek.
        stempel((h, w), ellipses=[(712, 457, 192, 192)]),
    )
    alpha *= 1.0 - blur(killzones * 255, 6.0) / 255.0

    # ── 4. kleur ───────────────────────────────────────────────────────────
    # Un-premultiply. De ondergrens houdt de kleur van bijna-transparante rook
    # eindig; zonder die vloer knalt hij naar wit en krijgt elke rooklob een
    # lichte franje op de kaart.
    kleur = np.clip(img / np.maximum(alpha, 0.07)[:, :, None], 0, 255)

    # ── 5. de voorwerpen die de lijst kruisen ──────────────────────────────
    # Crest en medaille horen in hun geheel naar voren: ze liggen in de
    # referentie óp de lijst en zouden door de kaartrand doormidden worden
    # geknipt. De rest van de voorgrond volgt uit de band × het silhouet — zo
    # gaan staf, cadeau, zak, kolen en kettingen mee waar ze de rand raken, maar
    # blijft de rook eromheen in de master staan.
    crest = stempel(
        (h, w),
        polys=[[(404, 18), (700, 18), (712, 190), (628, 306), (466, 306), (392, 190)]],
    )
    medaille = stempel(
        (h, w),
        polys=[[(322, 1194), (764, 1194), (764, 1272), (612, 1352), (476, 1352), (322, 1272)]],
    )
    # De gouden lijst zelf blijft in de master, en dat is geen detail. Hij is
    # net zo massief als de voorwerpen, dus band × silhouet pakt hem anders
    # gewoon mee — en dan wordt het frame vóór de kaartinhoud getekend en loopt
    # de boog dwars door de rating. In de master landt hij via de binnenlaag
    # juist ónder de tekst, waar hij hoort.
    #
    # Waar een voorwerp de lijst kruist gaat dat stukje voorwerp mee de master
    # in. Dat blijft kloppen: master en voorlaag delen één registratie, dus de
    # ketting loopt zichtbaar door — alleen die paar pixels liggen een laag
    # dieper, en daar ligt niets bovenop behalve de lijst waar ze toch al
    # overheen gingen. Crest en medaille zijn uitgezonderd: die liggen in de
    # referentie in hun geheel óp de lijst.
    lijstring = np.clip(1.0 - smoothstep(dist_in, LIJST * 0.6, LIJST + 10.0), 0, 1)
    lijstring = np.where(schild, lijstring, 0.0)
    voor_masker = np.clip(
        np.maximum.reduce([crest, medaille, band * solide * (1.0 - lijstring)]), 0, 1
    )
    voor_masker = blur(voor_masker * 255, 2.5) / 255.0

    voor_alpha = alpha * voor_masker
    master_alpha = alpha * (1.0 - voor_masker) * (1.0 - vlak)

    master = rgba(kleur, master_alpha)
    voor = rgba(kleur, voor_alpha)
    tegel = quilttegel(img)

    paden = {
        "master": UIT / "piet-master.webp",
        "front": UIT / "piet-front.webp",
        "vlak": UIT / "piet-vlak.webp",
    }
    master_web = master.resize(MASTER_DOEK, Image.Resampling.LANCZOS)
    voor_web = voor.resize(FRONT_DOEK, Image.Resampling.LANCZOS)
    master_web.save(paden["master"], "WEBP", quality=72, method=6)
    voor_web.save(paden["front"], "WEBP", quality=70, method=6)
    tegel.save(paden["vlak"], "WEBP", quality=88, method=6)

    # Twee metingen die niet uit de bestanden zelf af te lezen zijn en waar de
    # kaart het hardst op valt. De eerste: staat er nog artwork op het kaartvlak?
    # Dan komt de ingebakken tekst van de referentie als spookkopie naast de
    # échte tekst te staan. De tweede: reikt de voorlaag dieper de kaart in dan
    # de band waarvoor hij bedoeld is? Dan gaat een ketting over de rating.
    # Crest en medaille zijn uitgezonderd van de tweede meting: die twee liggen
    # per ontwerp diep in de kaart (boven- en onderrand) en zijn geen strooisel.
    diep_in_vlak = dist_in > LIJST + 20.0
    diep_voor_band = (dist_in > VOOR_BAND + 30.0) & (crest < 0.5) & (medaille < 0.5)
    rest_vlak = float(master_alpha[diep_in_vlak].mean())
    rest_voor = float(voor_alpha[diep_voor_band].mean())

    delen = {
        "master": {**meet(paden["master"], master_web), "restVlak": round(rest_vlak, 5)},
        "front": {**meet(paden["front"], voor_web), "restVlak": round(rest_voor, 5)},
        "vlak": {
            "pixels": [tegel.width, tegel.height],
            "bytes": paden["vlak"].stat().st_size,
            "tegel": True,
        },
        # De registratie hoort bij de assets, niet bij de CSS: PietEffect.css en
        # kaartMasters.ts spiegelen deze drie getallen.
        "registratie": {
            "links": round(-KAART_X0 / KAART_B, 4),
            "boven": round(-KRUIN / KAART_H, 4),
            "breedte": round(w / KAART_B, 4),
        },
    }
    (UIT / "piet-onderdelen.json").write_text(
        json.dumps(delen, indent=2) + "\n", encoding="utf8"
    )

    print(f"referentie {w}x{h}; kaartbox x0={KAART_X0:.0f} y0={KRUIN:.0f} "
          f"b={KAART_B:.0f} h={KAART_H:.0f}")
    for naam in ("master", "front", "vlak"):
        d = delen[naam]
        alfa = f"alfa {d['alfa']:.3f}  rest {d['restVlak']:.4f}  " if "alfa" in d else ""
        maat = f"{d['kB']} kB" if "kB" in d else f"{d['bytes']} B"
        print(f"  {naam:7s} {d['pixels'][0]}x{d['pixels'][1]}  {alfa}{maat}")
    print(f"  registratie {delen['registratie']}")

    if "--preview" in sys.argv:
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        # Op zwart, zoals de kaart hem toont: eerst het vlak (de tegel binnen het
        # schild), dan de master met zijn lijst, dan de voorgrond.
        doek = Image.new("RGBA", (w, h), (6, 5, 4, 255))
        vlakbeeld = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        tegel_rgba = tegel.convert("RGBA")
        for ty in range(0, h, tegel.height):
            for tx in range(0, w, tegel.width):
                vlakbeeld.alpha_composite(tegel_rgba, (tx, ty))
        vlakbeeld.putalpha(
            Image.fromarray((schild * 255).astype(np.uint8), "L")
        )
        doek.alpha_composite(vlakbeeld)
        doek.alpha_composite(master)
        doek.alpha_composite(voor)
        doek.convert("RGB").save(PREVIEW)
        print(PREVIEW.relative_to(WORTEL))
    return delen


def main() -> int:
    bouw()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
