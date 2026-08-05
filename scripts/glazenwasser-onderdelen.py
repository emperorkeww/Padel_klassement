#!/usr/bin/env python3
"""Bouw de Glazenwasser-artworklagen uit de actuele visuele referentie.

De bron is een afgewerkte 1024x1536 compositie op zwart. We nemen de render niet
als kaartachtergrond over (daarin staan vaste spelersdata), maar scheiden hem in:

* ``gw-water-back.webp``: bellen en waterspatten achter het schild;
* ``gw-frame.webp``: metalen frame en geïntegreerde boven-/onderbadge;
* ``gw-front-props.webp``: trekker, emmer, doek, spray, spons en voorste schuim;
* ``gw-glas.webp``: een rustige, naadloze natglastegel voor het kaartvlak;
* ``glazenwasser-master.webp`` en ``glazenwasser-front.webp`` voor de
  bestaande achter/binnen/voor-montagepunten van de compacte FutKaart.

Alle productiebeelden gebruiken dezelfde 100:139 kaartstage. De referentie wordt
hiervoor horizontaal transparant opgevuld; er wordt niets uitgerekt.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WORTEL = Path(__file__).resolve().parent.parent
REFERENTIE = WORTEL / "docs/fut-kaarten/referentie_glazenwasser.png"
LAAGFIX = WORTEL / "docs/fut-kaarten/referentie_glazenwasser-laagfix.webp"
UIT = WORTEL / "src/features/rating/components/glazenwasser/assets"
PREVIEW = WORTEL / "screenshots/glazenwasser/onderdelen.png"

KAART_RATIO = 139 / 100
MASTER_DOEK = (1024, 1440)
MASTER_VAK = (72, 160, 880, 1223)
LAGEN_DOEK = (553, 768)
FRONT_DOEK = (512, 720)


def vervaag(masker: np.ndarray, straal: float) -> np.ndarray:
    beeld = Image.fromarray(np.clip(masker * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(beeld.filter(ImageFilter.GaussianBlur(straal))).astype(np.float32) / 255


def polygoon(maat: tuple[int, int], punten, feather: float = 0) -> np.ndarray:
    beeld = Image.new("L", maat, 0)
    ImageDraw.Draw(beeld).polygon(punten, fill=255)
    masker = np.asarray(beeld).astype(np.float32) / 255
    return vervaag(masker, feather) if feather else masker


def ellips(maat: tuple[int, int], doos, feather: float = 0) -> np.ndarray:
    beeld = Image.new("L", maat, 0)
    ImageDraw.Draw(beeld).ellipse(doos, fill=255)
    masker = np.asarray(beeld).astype(np.float32) / 255
    return vervaag(masker, feather) if feather else masker


def rgba(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    uit = np.zeros((*alpha.shape, 4), np.uint8)
    uit[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    uit[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(uit, "RGBA")


def op_stage(beeld: Image.Image, stage_maat: tuple[int, int], x: int) -> Image.Image:
    stage = Image.new("RGBA", stage_maat, (0, 0, 0, 0))
    stage.alpha_composite(beeld, (x, 0))
    return stage


def meet(pad: Path, beeld: Image.Image, *, voorbewerkt: bool = True) -> dict:
    a = np.asarray(beeld.getchannel("A")).astype(np.float32) / 255
    return {
        "doos": [0.0, 0.0, 1.0, 1.0],
        "pixels": [0, 0, beeld.width, beeld.height],
        "alfa": round(float(a.mean()), 4),
        "dekking": round(float((a >= 0.5).mean()), 4),
        "kB": pad.stat().st_size // 1024,
        "overlap": {},
        "voorbewerkt": voorbewerkt,
    }


def maak_glastegel(bron: Image.Image) -> Image.Image:
    # Rustige zone boven/links van de rating en links van de portretring. Geen
    # tekst of prop; wel ruitpatroon, veegstrepen en kleine druppels.
    tegel = bron.crop((408, 274, 520, 402)).convert("RGB")
    a = np.asarray(tegel).astype(np.float32)
    h, w = a.shape[:2]
    overlap = 20
    helling = np.linspace(0, 1, overlap, dtype=np.float32)
    a[:, :overlap] = a[:, :overlap] * helling[None, :, None] + a[:, -overlap:] * (1 - helling[None, :, None])
    a[:overlap] = a[:overlap] * helling[:, None, None] + a[-overlap:] * (1 - helling[:, None, None])
    # De kleur van het glas komt uit CSS. Alleen detail krijgt alpha; zo ontstaat
    # geen herhaald rechthoekig kleurvlak.
    vlak = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32)
    detail = np.abs(a - vlak).mean(-1)
    alpha = np.clip((detail - 1.5) / 13, 0, 0.82)
    return rgba(a, alpha)


def bouw() -> dict[str, dict]:
    UIT.mkdir(parents=True, exist_ok=True)
    bron_beeld = Image.open(REFERENTIE).convert("RGB")
    laagfix_beeld = Image.open(LAAGFIX).convert("RGB")
    w, h = bron_beeld.size
    if (w, h) != (1024, 1536):
        raise SystemExit(f"verwacht referentie 1024x1536, kreeg {w}x{h}")
    if laagfix_beeld.size != (w, h):
        raise SystemExit(
            f"verwacht laagfix {w}x{h}, kreeg "
            f"{laagfix_beeld.width}x{laagfix_beeld.height}"
        )

    stage_w = round(h / KAART_RATIO)
    xoff = (stage_w - w) // 2
    rgb = np.asarray(bron_beeld).astype(np.float32)
    luma = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    buiten_key = np.clip((luma - 10) / 58, 0, 1)

    maat = (w, h)
    # Het basisschild, zonder uitspringende props. De maskers volgen de zichtbare
    # buiten- en binnenrail van de referentie; het verschil is de frameband.
    buiten = polygoon(maat, [
        (92, 264), (168, 188), (365, 116), (512, 230), (659, 116),
        (866, 188), (934, 270), (935, 1125), (881, 1254), (704, 1376),
        (512, 1485), (316, 1376), (139, 1254), (78, 1120),
    ], 7)
    binnen = polygoon(maat, [
        (148, 310), (225, 245), (374, 191), (512, 286), (650, 191),
        (806, 245), (874, 310), (872, 1110), (815, 1204), (672, 1295),
        (512, 1374), (348, 1295), (205, 1204), (146, 1105),
    ], 10)
    frame = np.clip(buiten - binnen, 0, 1)

    # Geïntegreerde voorwerpen. De ruimere organische contouren nemen het
    # aangrenzende schuim/water mee; hun grenzen vallen op of buiten de rail en
    # zijn daardoor niet als assetrechthoek zichtbaar.
    top_badge = polygoon(maat, [(350, 172), (405, 92), (512, 44), (620, 92), (682, 180), (604, 286), (512, 319), (420, 286)], 8)
    squeegee = polygoon(maat, [(774, 122), (921, 73), (1023, 91), (1023, 666), (958, 729), (889, 673), (870, 500), (790, 342)], 10)
    bucket = polygoon(maat, [(0, 916), (178, 905), (270, 1018), (270, 1348), (193, 1430), (33, 1385)], 9)
    sponge = polygoon(maat, [(755, 1160), (1023, 1108), (1023, 1428), (899, 1460), (749, 1378)], 9)
    bottom_badge = polygoon(maat, [(286, 1250), (398, 1212), (512, 1260), (626, 1212), (744, 1250), (684, 1410), (512, 1518), (337, 1410)], 8)
    top_foam = polygoon(maat, [(75, 130), (340, 86), (423, 188), (303, 258), (95, 268)], 12)
    top_foam = np.maximum(top_foam, polygoon(maat, [(603, 164), (748, 82), (958, 125), (1008, 275), (825, 289)], 12))
    frame_decor = np.maximum.reduce([frame, top_badge, bottom_badge])
    front_props = np.maximum.reduce([squeegee, bucket, sponge, top_foam])
    props = np.maximum(frame_decor, front_props)

    # De vlakke referentie had de onderste rail letterlijk in de pixels van
    # emmer en spons. De gerichte laagfix reconstrueert alleen die overlapzones
    # met de rail achter de props; alle overige pixels blijven uit de primaire
    # visuele referentie komen.
    laagfix_rgb = np.asarray(laagfix_beeld).astype(np.float32)
    onderste_props = np.maximum(bucket, sponge)[..., None]
    front_rgb = rgb * (1 - onderste_props) + laagfix_rgb * onderste_props

    # Binnen het schild zijn frame/props volledig dekkend. Waar ze buiten het
    # schild komen verwijdert de zwartkey de bronachtergrond en bewaart hij de
    # halftransparante randen van bellen, water en schuim.
    vrijstelling = np.where(buiten > 0.55, 1.0, buiten_key)
    frame_alpha = np.clip(frame_decor, 0, 1) * vrijstelling
    front_alpha = np.clip(front_props, 0, 1) * vrijstelling

    # Achterwater bevat alles buiten de kaart, behalve de massieve props die in
    # de ring vóór het frame komen. Een zachte overlap onder de rail voorkomt
    # naden bij halftransparante druppels.
    achter_alpha = buiten_key * np.clip(1 - buiten, 0, 1)
    achter_alpha *= np.clip(1 - props * 0.82, 0, 1)

    frame_beeld = op_stage(rgba(rgb, frame_alpha), (stage_w, h), xoff)
    front_beeld = op_stage(rgba(front_rgb, front_alpha), (stage_w, h), xoff)
    achter = op_stage(rgba(rgb, achter_alpha), (stage_w, h), xoff)
    glas = maak_glastegel(bron_beeld)

    paden = {
        "frame": UIT / "gw-frame.webp",
        "front-props": UIT / "gw-front-props.webp",
        "water-back": UIT / "gw-water-back.webp",
        "glas": UIT / "gw-glas.webp",
    }
    frame_web = frame_beeld.resize(LAGEN_DOEK, Image.Resampling.LANCZOS)
    front_web = front_beeld.resize(LAGEN_DOEK, Image.Resampling.LANCZOS)
    frame_web.save(paden["frame"], "WEBP", quality=86, method=6)
    front_web.save(paden["front-props"], "WEBP", quality=86, method=6)
    # De achterlaag bestaat hoofdzakelijk uit zachte, halftransparante bellen en
    # spray. Q78 bewaart die randen zichtbaar identiek op kaartmaat en voorkomt
    # dat één decoratieve laag het gedeelde assetbudget overschrijdt.
    achter.save(paden["water-back"], "WEBP", quality=70, method=6)
    glas.save(paden["glas"], "WEBP", quality=94, method=6)

    delen = {
        "frame": meet(paden["frame"], frame_web),
        "front-props": meet(paden["front-props"], front_web),
        "water-back": meet(paden["water-back"], achter),
        "glas": {
            **meet(paden["glas"], glas, voorbewerkt=False),
            "tegel": True,
        },
    }

    # Compacte masters op exact dezelfde stage: base bevat achterwater en frame;
    # front uitsluitend frame-breakers. Zo kan ook zonder runtime-mask nooit een
    # metalen railpixel over emmer, spons of trekker worden geschilderd.
    vx, vy, vw, vh = MASTER_VAK
    master = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
    # De referentie is een poster met vrije marge rond het eigenlijke schild.
    # De app-master heeft die marge niet nodig: 1,18 laat de metalen flanken
    # dezelfde breedte innemen als de gedeelde FUT-schilden, terwijl het vaste
    # 100:139 canvas (en dus layout/klikzone) ongewijzigd blijft.
    schaal = 1.18
    kb, kh = round(vw * schaal), round(vh * schaal)
    kx, ky = round(vx - (kb - vw) / 2), round(vy - (kh - vh) / 2)
    achter_k = achter.resize((kb, kh), Image.Resampling.LANCZOS)
    frame_k = frame_beeld.resize((kb, kh), Image.Resampling.LANCZOS)
    front_k = front_beeld.resize((kb, kh), Image.Resampling.LANCZOS)
    master.alpha_composite(achter_k, (kx, ky))
    master.alpha_composite(frame_k, (kx, ky))
    master_pad = UIT / "glazenwasser-master.webp"
    # Op de compacte kaart is de master hoogstens enkele honderden pixels
    # breed. Q76 blijft daar visueel gelijk aan Q80, maar houdt ook na de
    # maatcorrectie het globale productie-assetbudget onder de grens.
    master.save(master_pad, "WEBP", quality=74, method=6)

    front_master = Image.new("RGBA", MASTER_DOEK, (0, 0, 0, 0))
    front_master.alpha_composite(front_k, (kx, ky))
    front_pad = UIT / "glazenwasser-front.webp"
    front_master.resize(FRONT_DOEK, Image.Resampling.LANCZOS).save(
        front_pad,
        "WEBP",
        # De transparante bron wordt alleen boven de al scherpe basismaster
        # gelegd. Q70 houdt metalen randen en schuim op 450 px kaartbreedte
        # zichtbaar gelijk, maar voorkomt dat de fysiek gescheiden laag het
        # globale productie-assetbudget opsoupeert.
        quality=70,
        method=6,
    )

    (UIT / "gw-onderdelen.json").write_text(json.dumps(delen, indent=2) + "\n", encoding="utf8")
    print(f"referentie {w}x{h}; stage {stage_w}x{h}; x-offset {xoff}")
    for naam, data in delen.items():
        print(f"  {naam:12s} alfa {data['alfa']:.3f}  dekking {data['dekking']:.3f}  {data['kB']} kB")
    print(f"  master       {master_pad.stat().st_size // 1024} kB")
    print(f"  front        {front_pad.stat().st_size // 1024} kB")

    if "--preview" in sys.argv:
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        voorbeeld = Image.new("RGBA", (stage_w, h), (8, 17, 28, 255))
        voorbeeld.alpha_composite(achter)
        voorbeeld.alpha_composite(frame_beeld)
        voorbeeld.alpha_composite(front_beeld)
        voorbeeld.convert("RGB").save(PREVIEW)
        print(PREVIEW.relative_to(WORTEL))
    return delen


def main() -> int:
    bouw()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
