#!/usr/bin/env python3
"""Bouw piet-master.webp uit docs/referentie_zwarte_piet.png.

De referentie is een gerenderde kaart op zwart. Dit script maakt daar één
transparant master-artwork van in het referentie-coordinatenstelsel
(1086 x 1448): de ornamentring (rook, goudstof, speelkaarten, veren,
geschenken, kettingen, gevleugelde crest, rozet) plus de binnenrook en de
stadssilhouet uit het kaartvlak.

Twee extractieregimes, gescheiden door het kaartvlak van de referentie:
  - buiten het vlak: additief over zwart   ->  P = a*C
  - binnen het vlak: over perkament        ->  P = a*C + (1-a)*BG

Killzones halen weg wat de app zelf tekent: rating, tekst, statblok, de
avatarfoto met zijn ring, en de frameband van de referentie.

Registratie in de kaart (zie PietEffect.css):
  kaartbox in referentiecoordinaten = x[152, 936], y[155, 1245]
  -> left  = -152/784   = -19.4%
     top   = -155/1090  = -14.2%
     width = 1086/784   = 138.5%
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from piet_schild import schild_uv  # noqa: E402

REF = "docs/referentie_zwarte_piet.png"
OUT = "src/features/rating/components/piet/assets/piet-master.webp"
SCRATCH = os.environ.get("PIET_CHECK_DIR")

# De bovenrand (ogeeboog) van het referentievlak, gemeten per kolom en
# gespiegeld om het vlakmidden x=549.5.
ARCH_LINKS = [
    (191, 238), (200, 230), (220, 226), (240, 219), (260, 209), (280, 200),
    (300, 188), (320, 177), (340, 165), (360, 152), (380, 141), (400, 132),
    (420, 128), (440, 126), (470, 125), (500, 124), (549, 124),
]
VLAK_L, VLAK_R, VLAK_B = 191, 908, 1219

# De kaartbox van de app in referentiecoordinaten, plus het schildpad
# (#fut-schild-notch uit FutKaart.tsx) in dezelfde eenheden. Alles wat binnen
# dit schild valt maar buiten het referentievlak, ligt in de app op perkament:
# daar moet het artwork dekkend zijn, anders leest de rook als bleke waas.
KAART_X0, KAART_B = 152.0, 784.0
# De kruin van de ogeeboog; komt uit piet-schild.py, dat hem uit de referentie
# meet. y=0 van de kaartbox ligt daar, niet meer op de vlakke bovenrand die het
# oude schild had.
KAART_H = KAART_B * 139.0 / 100.0



# De brede onderrand, zelfde getallen als piet_schild.py.
HOEK_U = 0.17
HOEK_V = HOEK_U * 100.0 / 139.0
K = 0.45
ONDER_BEZIER = [
    ((1.0, 0.60), (1.0, 1.0 - HOEK_V), (1.0, 1.0 - HOEK_V), (1.0, 1.0 - HOEK_V)),
    ((1.0, 1.0 - HOEK_V), (1.0, 1.0 - HOEK_V * K), (1.0 - HOEK_U * K, 1.0),
     (1.0 - HOEK_U, 1.0)),
    ((1.0 - HOEK_U, 1.0), (1.0 - HOEK_U, 1.0), (HOEK_U, 1.0), (HOEK_U, 1.0)),
    ((HOEK_U, 1.0), (HOEK_U * K, 1.0), (0.0, 1.0 - HOEK_V * K),
     (0.0, 1.0 - HOEK_V)),
    ((0.0, 1.0 - HOEK_V), (0.0, 0.60), (0.0, 0.60), (0.0, 0.60)),
]


_BOOG_UV, kruin_ref = schild_uv()


def schildpunten():
    """Het app-schild als polygoon in referentiepixels.

    De bovenboog komt uit piet-schild.py — hetzelfde pad dat FutKaart.tsx als
    clip-path gebruikt. Registratie van artwork en kaart loopt zo over één bron.
    """
    def naar_ref(p):
        return (KAART_X0 + p[0] * KAART_B, kruin_ref + p[1] * KAART_H)

    pts = [naar_ref(p) for p in _BOOG_UV]
    for p0, c1, c2, p3 in ONDER_BEZIER:
        for i in range(1, 21):
            t = i / 20.0
            m = 1.0 - t
            x = (m ** 3 * p0[0] + 3 * m * m * t * c1[0]
                 + 3 * m * t * t * c2[0] + t ** 3 * p3[0])
            y = (m ** 3 * p0[1] + 3 * m * m * t * c1[1]
                 + 3 * m * t * t * c2[1] + t ** 3 * p3[1])
            pts.append(naar_ref((x, y)))
    return pts


def blur(arr, sigma):
    if arr.ndim == 2:
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        return np.asarray(img.filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32)
    return np.dstack([blur(arr[:, :, c], sigma) for c in range(arr.shape[2])])


def smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def stempel(shape, polys=(), ellipses=()):
    m = Image.new("L", (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    for cx, cy, rx, ry in ellipses:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    return np.asarray(m).astype(np.float32) / 255.0


ref = Image.open(REF).convert("RGB")
W, H = ref.size
img = np.asarray(ref).astype(np.float32)
gray = img @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

# ------------------------------------------------ 1. kaartvlak van de referentie
boog = ARCH_LINKS + [(1099 - x, y) for x, y in reversed(ARCH_LINKS[:-1])]
vlak_poly = boog + [(VLAK_R, VLAK_B), (VLAK_L, VLAK_B)]
vlak = stempel((H, W), polys=[vlak_poly]) > 0.5

# ------------------------------------------------ 2. perkamentveld
# Het perkament heeft een vloeiend verloop met een donkerder onderpaneel. Een
# kleinste-kwadratenfit van orde 3 over de echte perkamentpixels geeft daarom
# een veld dat óók onder grote tekstvlakken en de rookkolom betrouwbaar blijft
# — een lokale filter zou daar geen perkament vinden en te donker uitvallen.
schoon = vlak & (gray > 128) & ((img.max(2) - img.min(2)) < 88)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u = (xx - VLAK_L) / (VLAK_R - VLAK_L)
v = (yy - 124.0) / (VLAK_B - 124.0)
termen = [np.ones_like(u), u, v, u * u, u * v, v * v,
          u ** 3, u * u * v, u * v * v, v ** 3]
A = np.stack([t[schoon] for t in termen], axis=1)
BG = np.zeros((H, W, 3), np.float32)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, img[:, :, c][schoon], rcond=None)
    BG[:, :, c] = sum(k * t for k, t in zip(coef, termen))
BG = np.clip(BG, 120.0, 255.0)
BGl = BG @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

# ------------------------------------------------ 3. alfa binnen het vlak
# Het vlak van de app is lichter dan het verouderde perkament van de referentie.
# Zonder een kleine versterking zouden rook en stadssilhouet daar bleker
# uitvallen dan in het bronbeeld.
ROOK_L = 10.0
d = np.clip((BGl - gray) / np.maximum(BGl - ROOK_L, 1.0), 0.0, 1.0)
a_in = smoothstep(d, 0.04, 0.26) * np.clip(d * 1.62, 0.0, 1.0)

# ------------------------------------------------ 4. de frameband van de referentie
# Een ring rond het kaartvlak van de referentie. Hij kan niet blijven staan: de
# referentie heeft een ogeeboog boven en een vlakke onderrand, terwijl het
# app-schild een vlakke bovenrand heeft en vanaf 60% hoogte naar een punt loopt.
# Waar die vormen uiteenlopen — vooral onderaan — blijft zo'n meegeërfde rand
# rechtdoor gaan terwijl de kaart schuin naar binnen loopt. De band gaat er dus
# uit; sectie 9 tekent hem opnieuw, maar dan op het afstandsveld van het
# app-schild, zodat hij de kaart overal volgt.
dist_uit = ndimage.distance_transform_edt(~vlak)
dist_in = ndimage.distance_transform_edt(vlak)
band = np.where(
    vlak,
    (dist_in <= 7).astype(np.float32),
    1.0 - smoothstep(dist_uit, 30.0, 50.0),
)
# Waar een compleet ornament de band kruist blijft hij staan: het ornament dekt
# hem daar toch af, en wegsnijden zou de kettingen, geschenken en de rozet zelf
# doormidden knippen. Onder 1000 px geen uitzonderingen meer — daar loopt het
# app-schild al taps toe en hoort er niets recht doorheen.
houd = stempel(
    (H, W),
    polys=[
        [(60, 300), (300, 300), (300, 800), (60, 800)],      # veren, kaarten, geschenk links
        [(800, 320), (1020, 320), (1020, 790), (800, 790)],  # veren, kaarten, geschenk rechts
        [(140, 790), (300, 790), (300, 1000), (140, 1000)],  # bovenste kettingpartij links
        [(800, 780), (960, 780), (960, 1000), (800, 1000)],  # bovenste kettingpartij rechts
    ],
    ellipses=[
        (549, 115, 168, 100),   # gevleugelde bovencrest
        (549, 1300, 235, 135),  # onderste rozet
    ],
) > 0.5
band = np.where(houd, 0.0, band)

# ------------------------------------------------ 5. alfa buiten het vlak
# De pedestal van 7 knipt de ruisvloer van de zwarte achtergrond weg. Zonder
# die drempel houdt bijna elke pixel een alfa van ~0,08 en wordt het WebP
# twee keer zo groot zonder dat er iets zichtbaar is.
# De pedestal bepaalt hoe het goudstof leest. Te laag (5,5) en élke ruispixel
# houdt een beetje alfa: dan wordt het stof een gelijkmatige waas rond de kaart
# in plaats van de clusters met lege gaten ertussen die de referentie heeft.
# Op 8,5 vallen de zwakste korrels weg en blijven de trossen en de losse felle
# vonken over — vanzelf onregelmatig, want zo staan ze in het bronbeeld.
a_lum = np.clip((gray - 8.5) / 52.0, 0.0, 1.0) ** 0.68
detail = np.abs(gray - blur(gray, 5.0))
solid = smoothstep(detail, 5.0, 20.0)
solid = np.asarray(
    Image.fromarray((solid * 255).astype(np.uint8))
    .filter(ImageFilter.MaxFilter(9))
    .filter(ImageFilter.MinFilter(5))
).astype(np.float32) / 255.0
solid = ndimage.binary_closing(solid > 0.35, np.ones((23, 23))).astype(np.float32)
solid = blur(solid * 255, 3.0) / 255.0
gate = np.clip((gray - 7.0) / 8.0, 0.0, 1.0)
# In de band geen massief-boost: het frame moet juist dun en doorschijnend
# blijven, anders krijgt de kaart er een tweede dekkende rand bij.
a_out = np.clip(a_lum + 0.85 * solid * gate * (1.0 - band), 0.0, 1.0)

alpha = np.where(vlak, a_in, a_out)

# ------------------------------------------------ 6. de ring binnen het app-schild
# Twee wiggen in de bovenhoeken (tussen de vlakke bovenrand van het app-schild
# en de ogeeboog van de referentie) en een smalle strook langs beide zijkanten.
# Die stukken vallen in de app óp het perkament. Additieve extractie zou daar
# een lichtgrijze waas geven; ze worden daarom dekkend overgenomen. Zo leest de
# geboogde bovenrand van de referentie — rook, donkere band én gouden haarlijn —
# als artwork bovenop een kaart die zelf een vlakke bovenrand heeft.
app_schild = stempel((H, W), polys=[schildpunten()]) > 0.5
ring = app_schild & ~vlak
a_dekkend = np.clip((gray - 6.0) / 16.0, 0.0, 1.0)
alpha = np.where(ring, np.maximum(alpha, a_dekkend), alpha)

# ------------------------------------------------ 7. kleur (un-premultiply)
av = np.maximum(alpha, 0.03)[:, :, None]
kleur = np.where(
    vlak[:, :, None],
    (img - (1.0 - av) * BG) / av,
    img / np.maximum(alpha, 0.07)[:, :, None],
)
kleur = np.clip(kleur, 0, 255)

# ------------------------------------------------ 8. killzones
# a. Twee soorten tekstzones, en ze zijn allebei nodig:
#      - die van de referentie, want dat beeld heeft rating, naam en statblok
#        ingebakken; blijft daar iets van staan, dan leest het als een spookkopie
#        naast de echte tekst van de kaart;
#      - die van de app zelf (gemeten op /dev/piet, --fut-kw: 450px), want die
#        zet rating, naam en editieregel lager dan de referentie.
#    De rechthoeken hieronder zijn de vereniging van beide. Daardoor is de master
#    zelf content-veilig en hebben de lagen geen apart veiligheidsmasker nodig.
#    Ze worden apart begrensd, en dat is geen detail. De zones van de referentie
#    liggen per definitie op zijn kaartvlak, dus ze worden op dat vlak geclipt —
#    daar is de master toch al transparant, dus wissen kost daar niets. De zones
#    van de app worden op het app-schild geclipt: buiten de kaart hóórt daar rook
#    te staan, en een rechthoek die dóórloopt tot buiten de taps toelopende punt
#    slaat een zichtbaar recht gat in die rook.
#    In het bovenblok gaat het niet als rechthoek maar als lettervorm: alleen de
#    ínkt van de referentie sneuvelt, plus een randje. Een blok van 320 x 140 px
#    haalt daar ook alle rook tussen en om de cijfers weg, en juist die rook hoort
#    in de referentie vanaf de avatar naar de rating toe te waaieren.
#    Binnen die drie kaders is een simpele donkerdrempel genoeg: het enige wat er
#    écht zwart is, is de ingebakken tekst. Een omgevingstest werkt hier juist
#    níet — een blur die groot genoeg is voor een letterstam van 25 px middelt
#    binnen het tekstblok zelf naar ~140 en valt dan onder elke drempel, waardoor
#    de letters onaangeroerd blijven en sectie 11 ze mee naar de avatar warpt.
boven_blok = stempel(
    (H, W),
    polys=[
        [(206, 212), (552, 212), (552, 374), (206, 374)],      # rating
        [(310, 362), (402, 362), (402, 470), (310, 470)],      # divisiecijfer
        [(278, 460), (432, 460), (432, 590), (278, 590)],      # vormemoji
        [(206, 800), (900, 800), (900, 1196), (206, 1196)],    # naam t/m statblok
    ],
)
ink = (gray < 100) & vlak & (boven_blok > 0.5)
ink = ndimage.binary_fill_holes(ink)
ink = ndimage.binary_closing(ink, np.ones((9, 9)))
ink = ndimage.binary_dilation(ink, np.ones((3, 3)), iterations=9).astype(np.float32)
#    Ook het onderblok gaat als lettervorm, niet als rechthoek. Een blok is daar
#    extra schadelijk: het schild loopt onderaan taps toe, dus de hoeken van zo'n
#    rechthoek vallen búiten de kaart en staan dan als recht gat in de rook.
ref_zones = ink * boven_blok * vlak
ref_zones = blur(ref_zones * 255, 5.0) / 255.0
#    De zones van de app dempen alleen: onder rating, divisiecijfer en emoji mag
#    rook staan, hij mag er alleen niet zóveel staan dat de inkt eronder wegvalt.
#    Op 65% demping haalt #201d16 op het resterende vlak nog 5,4:1 — ruim AA. Het
#    naamblok gaat wél volledig weg; dat heeft zijn eigen plaat.
app_demp = stempel(
    (H, W),
    polys=[
        [(222, 258), (615, 258), (615, 390), (222, 390)],      # rating
        [(388, 412), (458, 412), (458, 490), (388, 490)],      # divisiecijfer
        [(348, 498), (478, 498), (478, 608), (348, 608)],      # vormemoji
    ],
) * app_schild * 0.65
app_zones = np.maximum(
    app_demp,
    stempel(
        (H, W),
        polys=[[(226, 790), (872, 790), (872, 1100), (226, 1100)]],
    ) * app_schild,
)
#    Uitvloeien: een harde rechthoekrand in de demping tekent zich in de dichte
#    rook af als een lichte hoek — je ziet dan het kader in plaats van de rook.
app_zones = blur(app_zones * 255, 11.0) / 255.0
#    En de avatarfoto van de referentie met zijn gouden ring: de app zet daar
#    zijn eigen, kleinere avatar met een driedelige materiaalrand. Exact op de
#    buitenrand van die ring, zodat geen rookpixel sneuvelt die hem raakt.
kill = np.maximum(
    np.maximum(ref_zones, app_zones),
    stempel((H, W), ellipses=[(744, 426, 192, 192)]),
)

# b. De frameband van de referentie (zie sectie 4).
kill = np.maximum(kill, band)

kill = blur(kill * 255, 2.6) / 255.0
alpha = alpha * (1.0 - kill)
premul = kleur * alpha[:, :, None]

# c. De weggehaalde referentieletters laten rookvrije gaten in de vorm van "1050"
#    achter. Op zichzelf onzichtbaar — de app zet daar zijn eigen rating — maar de
#    warp in sectie 11 plukt zijn bron uit precies dit gebied en kopieert die
#    lettergaten dan als spookvorm naar de rand van de avatar. Ze worden daarom
#    dichtgetrokken met de rook eromheen.
#    Twee passages, grof en dan fijn. De cijfers zijn ~100 px hoog met stammen van
#    ~25 px; met een kleine kern vult de convolutie alleen de randen en blijft er
#    een leesbare afdruk staan die de warp vervolgens netjes meekopieert.
gat = blur(ink * boven_blok * 255, 4.0) / 255.0
for sigma in (34.0, 12.0):
    w = 1.0 - gat
    noem = np.maximum(blur(w * 255, sigma) / 255.0, 1e-3)
    vul_a = blur(alpha * w * 255, sigma) / 255.0 / noem
    vul_p = np.dstack([blur(premul[:, :, c] * w, sigma) / noem for c in range(3)])
    alpha = alpha * (1.0 - gat) + vul_a * gat
    premul = premul * (1.0 - gat)[:, :, None] + vul_p * gat[:, :, None]


def herbemonster(a, p, sx, sy):
    """Alfa en voorgemultipliceerde kleur op (sx, sy) — bilineair."""
    x0 = np.clip(np.floor(sx), 0, W - 2).astype(np.int32)
    y0 = np.clip(np.floor(sy), 0, H - 2).astype(np.int32)
    fx = np.clip(sx - x0, 0.0, 1.0)[:, :, None]
    fy = np.clip(sy - y0, 0.0, 1.0)[:, :, None]
    x1, y1 = x0 + 1, y0 + 1

    def mix(v):
        boven = v[y0, x0] * (1 - fx) + v[y0, x1] * fx
        onder = v[y1, x0] * (1 - fx) + v[y1, x1] * fx
        return boven * (1 - fy) + onder * fy

    return mix(a[:, :, None])[:, :, 0], mix(p)


# ------------------------------------------- 9. de onderste compositie
# Hier stond een correctie: de kettingen werden naar binnen getrokken met de
# taps van het schild mee, omdat ze anders naast een kaart hingen die er onder
# de 60% niet meer was. Met de brede onderrand van #fut-schild-piet is dat niet
# meer nodig — de kaart loopt nu tot onderaan door, dus de kettingen hangen er
# gewoon langs zoals in de referentie. De schuif is weg; wat overblijft is één
# verplaatsing.
#
# De rozet moet namelijk nog wél omhoog. In de referentie duiken de bovenste
# plooien 29 px achter de onderrand van de kaart, en die rand ligt daar op y
# 1258; onze kaartbox houdt de vaste verhouding 100/139 en eindigt dus op 1175.
# Zonder deze lift blijft de rozet daaronder hangen in plaats van erachter weg
# te vallen. De kettingeinden gaan mee: ze komen in de rozet uit en horen
# daarom als één groep te bewegen.
LIFT = 44.0
lift = LIFT * smoothstep(yy, 1010.0, 1150.0)
alpha, premul = herbemonster(alpha, premul, xx, yy + lift)

# ------------------------------------------------ 10. de randlijst op het app-schild
# De referentie heeft een zware lijst: donker frame met een gouden haarlijn en
# een donkere keyline tegen het perkament. Die lijst is niet meegeërfd (sectie 4)
# maar opnieuw getekend op het afstandsveld van het écht gebruikte schild. Zo
# volgt hij de vlakke bovenrand, de rechte zijkanten én de taps toelopende
# onderkant met de punt — waar de meegeërfde rand rechtdoor bleef gaan.
#
# Het profiel is gemeten, niet verzonnen: het wordt uit de referentie zelf
# gehaald, langs de rechte zijkanten waar de lijst schoon vrij ligt.
LIJST_D = 46          # dikte van de referentielijst, in referentiepixels
profiel = np.zeros((LIJST_D + 1, 3), np.float32)
for d in range(LIJST_D + 1):
    stalen = [img[y, VLAK_L - 1 - d] for y in (896, 900, 904, 1096, 1100, 1104)]
    stalen += [img[y, VLAK_R + 1 + d] for y in (896, 900, 904, 1096, 1100, 1104)]
    profiel[d] = np.median(np.stack(stalen), axis=0)

# De app tekent zelf al frame + liner + keyline over de buitenste ~14 px van de
# kaart. Het profiel wordt daarom in de strook daarbinnen geperst, van buiten
# (donker frame) naar binnen (gouden haarlijn, keyline, perkament).
# Het hele profiel, niet alleen de binnenste haarlijn. De referentie heeft daar
# een zware lijst: een dikke bijna-zwarte moulure met een bevel, dan een brede
# warme goudband, dan pas perkament. Dat is wat de ornamenten iets geeft om
# tegenaan te staan.
#
# Eerder stond hier alleen het binnenste stuk, omdat de bone liner van de kaart
# anders als felle witte streep tussen twee donkere balken kwam te liggen. Die
# liner is nu zelf donker (PietEffect.css), dus de volle lijst kan erin — en
# zonder die lichte scheiding tussen ring en kaart horen de ornamenten er pas
# echt bij.
LIJST_BINNEN = 13.0     # net binnen frame + liner + keyline van de kaart
LIJST_BREED = 28.0      # de volle moulure plus goudband
PROFIEL_D = 39          # de gemeten lijstdikte van de referentie
d_schild = ndimage.distance_transform_edt(app_schild)
t = np.clip((d_schild - LIJST_BINNEN) / LIJST_BREED, 0.0, 1.0)
ref_d = np.clip((1.0 - t) * PROFIEL_D, 0, LIJST_D)
lo = np.floor(ref_d).astype(np.int32)
frac = (ref_d - lo)[:, :, None]
lijst_kleur = profiel[lo] * (1.0 - frac) + profiel[np.minimum(lo + 1, LIJST_D)] * frac
lijst_a = (
    smoothstep(d_schild, LIJST_BINNEN - 3.0, LIJST_BINNEN + 1.0)
    * (1.0 - smoothstep(d_schild, LIJST_BINNEN + LIJST_BREED - 4.0,
                        LIJST_BINNEN + LIJST_BREED + 1.0))
    * app_schild
)

# De lijst hoort ónder het artwork: kettingen, geschenken en de rozet lopen er
# overheen, niet omgekeerd.
premul = premul + lijst_kleur * (lijst_a * (1.0 - alpha))[:, :, None]
alpha = alpha + lijst_a * (1.0 - alpha)

# Contactschaduw waar de onderste ornamenten de kaart raken. Eerder stond hier
# een brede rookschaduw langs de hele onderste helft; die is weg. Hij moest het
# gat maskeren tussen de vlakke onderrand van de referentie en onze punt, maar
# las als een losse donkere plaat óńder de kaart — precies het "zwevende"
# gevoel dat weg moest. Wat overblijft is wat een contactschaduw hoort te zijn:
# kort, donker en strak om de plek waar twee dingen elkaar raken.
d_buiten = ndimage.distance_transform_edt(~app_schild)
contact = (
    (1.0 - app_schild)
    * (1.0 - smoothstep(d_buiten, 4.0, 34.0))
    * smoothstep(yy, 700.0, 820.0)
)
# Plus een compacte kern rond de punt, waar lint en kettingeinden samenkomen.
punt_x, punt_y = KAART_X0 + 0.5 * KAART_B, kruin_ref + KAART_H
contact = np.maximum(
    contact,
    (1.0 - app_schild)
    * (1.0 - smoothstep(np.hypot(xx - punt_x, yy - punt_y), 40.0, 190.0)),
)
contact = blur(contact * 255, 7.0) / 255.0
ROET = np.array([16.0, 13.0, 10.0], np.float32)
contact_a = 0.55 * contact
premul = premul + ROET * (contact_a * (1.0 - alpha))[:, :, None]
alpha = alpha + contact_a * (1.0 - alpha)

# ------------------------------------------- 11. de rook om de avatar
# Niets. En dat is het punt van deze ronde.
#
# Zolang het app-schild een vlakke bovenrand had, lag de kaartbox 70 px lager in
# de referentie en stond de profielfoto van de kaart dus ergens anders dan die
# van het bronbeeld. De rook eromheen moest daarom worden verplaatst: eerst met
# een gelijkvormige warp, toen met een boog in poolcoördinaten, en telkens kwam
# er een correctie bij — poorten op de bron, een S-curve op de alfa, demping die
# ná de warp moest, lettergaten dichttrekken omdat de warp ze anders meekopieerde.
#
# Met #fut-schild-piet valt de kaartbox samen met die van de referentie, en staat
# de avatar (PietEffect.css) op exact het middelpunt en de straal van de
# portretring uit het bronbeeld. De rook zit dan al goed. Geen warp, geen poorten,
# geen curve: de rook om het portret is gewoon de rook uit de referentie.

kleur = np.clip(premul / np.maximum(alpha, 0.02)[:, :, None], 0, 255)

# ------------------------------------------------ 12. afwerken
alpha = blur(alpha * 255, 0.7) / 255.0
alpha = np.where(alpha < 0.035, 0.0, alpha)

# In gebieden met lage alfa zit de vorm in het alfakanaal, niet in de kleur —
# maar de un-premultiply blaast daar de ruis juist 10x op. Die ruis is onzichtbaar
# en kost een kwart van het bestand. Kleur dus vervlakken waar alfa laag is en
# volledig nul zetten waar alfa nul is.
# De vervlakking gebeurt op de voorgemultipliceerde kleur en wordt daarna weer
# gedeeld door de gefilterde alfa. Een gewone blur op de un-premultiplied kleur
# trekt de perkamentkleur van de volledig transparante buurpixels naar binnen —
# dat gaf een witte gloed rond elke rooklob zodra hij op het vlak lag.
scherp = smoothstep(alpha, 0.10, 0.38)[:, :, None]
zacht_p = blur(kleur * alpha[:, :, None], 2.6)
zacht_a = np.maximum(blur(alpha * 255.0, 2.6) / 255.0, 1e-3)[:, :, None]
kleur = (zacht_p / zacht_a) * (1.0 - scherp) + kleur * scherp
kleur = np.where((alpha > 0.05)[:, :, None], kleur, 0.0)

rgba = np.clip(np.dstack([kleur, alpha * 255.0]), 0, 255).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(OUT, format="WEBP", quality=78, method=6)
print("geschreven", OUT, (W, H))

# Twee controlebeelden: op de donkere pagina-achtergrond en op perkament. De
# tweede is de belangrijke — daar valt op of rook of frame als bleke waas leest.
if SCRATCH:
    for naam, bg in (("check-donker.png", (14, 12, 10)),
                     ("check-licht.png", (232, 222, 198))):
        canvas = Image.new("RGB", (W, H), bg)
        src = Image.fromarray(rgba, "RGBA")
        canvas.paste(src, (0, 0), src)
        canvas.save(f"{SCRATCH}/{naam}")
    print("controlebeelden in", SCRATCH)
