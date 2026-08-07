import { describe, it, expect } from "vitest";
import {
  drawSpeeldagPoster,
  kaartRaster,
  speeldagPoster,
  KAART_RATIO,
  MAX_KAARTEN,
  POSTER_H,
  POSTER_W,
} from "@/features/groups/speeldagPoster";
import type { KaartData } from "@/features/profiles/profielPoster";

// Alleen de velden die de posterinhoud aanraakt; tier/editie zijn voor de
// tekenlaag en doen hier niet ter zake.
const speler = (name: string, rating: number | null = 1200): KaartData => ({
  name,
  avatarUrl: null,
  rating,
  tier: null,
  editie: null,
  editieTekst: null,
});

const basis = {
  groepsnaam: "Vrijdagavond padel",
  moment: "vrijdag 10 januari · 20:00",
  club: "LAGO CLUB Padel Beveren · 90 min",
};

describe("speeldagPoster", () => {
  it("neemt kop, moment en club letterlijk over", () => {
    const p = speeldagPoster({ ...basis, spelers: [speler("Ann")] });
    expect(p).toMatchObject(basis);
  });

  it("zet de sterkste speler vooraan", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Ann", 1100), speler("Bob", 1400), speler("Cis", 1250)],
    });
    expect(p.kaarten.map((k) => k.name)).toEqual(["Bob", "Cis", "Ann"]);
    expect(p.extraNamen).toBeNull();
  });

  it("zet spelers zonder rating achteraan, alfabetisch", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Zoe", null), speler("Ann", null), speler("Bob", 900)],
    });
    expect(p.kaarten.map((k) => k.name)).toEqual(["Bob", "Ann", "Zoe"]);
  });

  it("is deterministisch bij gelijke rating", () => {
    const spelers = [speler("Cis", 1200), speler("Ann", 1200), speler("Bob", 1200)];
    const eerst = speeldagPoster({ ...basis, spelers }).kaarten.map((k) => k.name);
    const nogmaals = speeldagPoster({
      ...basis,
      spelers: [...spelers].reverse(),
    }).kaarten.map((k) => k.name);
    expect(eerst).toEqual(["Ann", "Bob", "Cis"]);
    expect(nogmaals).toEqual(eerst);
  });

  it("valt boven acht spelers terug op namen i.p.v. kleinere kaarten", () => {
    const spelers = Array.from({ length: 12 }, (_, i) =>
      speler(`Speler ${String.fromCharCode(65 + i)}`, 1500 - i * 10),
    );
    const p = speeldagPoster({ ...basis, spelers });
    expect(p.kaarten).toHaveLength(MAX_KAARTEN);
    // De acht hoogst geratete krijgen een kaart; de rest staat in de regel.
    expect(p.kaarten.at(-1)?.name).toBe("Speler H");
    expect(p.extraNamen).toBe(
      "…en 4 anderen: Speler I, Speler J, Speler K, Speler L",
    );
  });

  it("schrijft één overgebleven speler enkelvoudig", () => {
    const spelers = Array.from({ length: 9 }, (_, i) => speler(`S${i}`, 100 - i));
    expect(speeldagPoster({ ...basis, spelers }).extraNamen).toBe(
      "…en 1 ander: S8",
    );
  });

  it("laat de code weg zolang er geen opt-in is", () => {
    const spelers = [speler("Ann")];
    expect(speeldagPoster({ ...basis, spelers }).code).toBeNull();
    expect(speeldagPoster({ ...basis, spelers, code: null }).code).toBeNull();
    // Witruimte telt niet als code.
    expect(speeldagPoster({ ...basis, spelers, code: "  " }).code).toBeNull();
  });

  it("zet de code er alleen op als hij expliciet is meegegeven", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Ann")],
      code: " b3: 1234 ",
    });
    expect(p.code).toBe("b3: 1234");
  });

  // #886: de QR staat op dezelfde voet als de code — standaard níét op de
  // poster, want een afbeelding wordt doorgestuurd en blijft rondslingeren.
  it("laat de QR weg zolang er geen opt-in is", () => {
    const spelers = [speler("Ann")];
    expect(speeldagPoster({ ...basis, spelers }).qr).toBeNull();
    expect(speeldagPoster({ ...basis, spelers, link: null }).qr).toBeNull();
    expect(speeldagPoster({ ...basis, spelers, link: " " }).qr).toBeNull();
  });

  it("maakt een vierkante QR-matrix van de deel-link", () => {
    const p = speeldagPoster({
      ...basis,
      spelers: [speler("Ann")],
      link: "https://padel.example/groepen/g1?tab=plannen&poll=poll-1",
    });
    expect(p.qr).not.toBeNull();
    const qr = p.qr!;
    expect(qr.length).toBeGreaterThanOrEqual(29);
    expect(qr.every((rij) => rij.length === qr.length)).toBe(true);
    // Zoekpatroon linksboven: 7×7 met een donkere rand — als dat klopt heeft
    // de encoder echt een QR gemaakt en geen lege matrix.
    expect(qr[0].slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
    expect(qr[1].slice(0, 7)).toEqual([true, false, false, false, false, false, true]);
  });

  // De scanbaarheid hangt aan het aantal modules: het QR-blok op de poster is
  // 200px, dus boven de 42 modules zakt elke module onder de ~4px die een
  // telefooncamera nodig heeft. Een echte deel-link is het langste wat er in
  // gaat — die moet er dus met marge onder blijven.
  it("houdt een echte deel-link met een uuid scanbaar klein", () => {
    const echt =
      "https://padel-klassement.pages.dev/speeldag/" +
      "8f14e45f-ceea-467a-9575-2b4f4c6a4f0b";
    const p = speeldagPoster({ ...basis, spelers: [speler("Ann")], link: echt });
    expect(p.qr!.length).toBeLessThanOrEqual(42);
  });

  it("blijft overeind zonder deelnemers", () => {
    const p = speeldagPoster({ ...basis, spelers: [] });
    expect(p.kaarten).toEqual([]);
    expect(p.extraNamen).toBeNull();
  });
});

describe("kaartRaster", () => {
  // De ruimte die drawSpeeldagPoster overhoudt tussen header en voet.
  const ruimte = { breedte: POSTER_W - 112, hoogte: 940, gap: 22 };

  it("houdt de kaarten zo groot mogelijk: 2 kolommen tot vier spelers", () => {
    expect(kaartRaster(1, ruimte).kolommen).toBe(1);
    expect(kaartRaster(2, ruimte).kolommen).toBe(2);
    expect(kaartRaster(4, ruimte).kolommen).toBe(2);
    expect(kaartRaster(6, ruimte).kolommen).toBe(3);
    expect(kaartRaster(8, ruimte).kolommen).toBe(4);
  });

  it("rekent de rijen uit het aantal kolommen", () => {
    expect(kaartRaster(3, ruimte)).toMatchObject({ kolommen: 2, rijen: 2 });
    expect(kaartRaster(5, ruimte)).toMatchObject({ kolommen: 3, rijen: 2 });
    expect(kaartRaster(7, ruimte)).toMatchObject({ kolommen: 4, rijen: 2 });
  });

  it("laat het raster binnen de beschikbare ruimte vallen", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { kolommen, rijen, kaartBreedte } = kaartRaster(n, ruimte);
      const breed = kolommen * kaartBreedte + (kolommen - 1) * ruimte.gap;
      const hoog = rijen * kaartBreedte * KAART_RATIO + (rijen - 1) * ruimte.gap;
      expect(breed).toBeLessThanOrEqual(ruimte.breedte + 0.001);
      expect(hoog).toBeLessThanOrEqual(ruimte.hoogte + 0.001);
    }
  });

  it("laat de hoogte de breedte klemmen waar dat nodig is", () => {
    // 4 spelers in 2×2: op breedte alleen zou een kaart 473px worden en het
    // blok 1314px hoog — ruim buiten de poster. De hoogtegrens wint.
    const { kaartBreedte } = kaartRaster(4, ruimte);
    expect(kaartBreedte).toBeLessThan((ruimte.breedte - ruimte.gap) / 2);
  });
});

/* ------------------------------------------------------------------ */
/* Tekenlaag: waar de QR (#886) op de poster terechtkomt. Een QR die    */
/* half over het kaartraster valt of buiten de poster steekt is stuk,   */
/* en dat zie je aan de matrix alleen niet.                             */
/* ------------------------------------------------------------------ */

type Rect = { x: number; y: number; w: number; h: number };

/** Canvas-dubbel dat alleen fillRect onthoudt. Alle andere tekencalls zijn
 *  no-ops; measureText geeft een grove maar monotone breedte terug, genoeg
 *  voor de wrap- en ellipsize-helpers. */
function recorderCtx(): { ctx: CanvasRenderingContext2D; rects: Rect[] } {
  const rects: Rect[] = [];
  const verloop = { addColorStop: () => {} };
  const ctx = new Proxy(
    {},
    {
      get(_doel, prop) {
        if (prop === "canvas") return { width: POSTER_W, height: POSTER_H };
        if (prop === "measureText") {
          return (t: unknown) => ({ width: String(t).length * 12 });
        }
        if (
          prop === "createLinearGradient" ||
          prop === "createRadialGradient" ||
          prop === "createPattern"
        ) {
          return () => verloop;
        }
        if (prop === "fillRect") {
          return (x: number, y: number, w: number, h: number) =>
            rects.push({ x, y, w, h });
        }
        // Stijl-eigenschappen worden gelezen én geschreven (globalAlpha e.d.);
        // een getal is het enige antwoord waar gereken op blijft werken.
        if (
          prop === "globalAlpha" ||
          prop === "lineWidth" ||
          prop === "shadowBlur"
        ) {
          return 1;
        }
        return () => undefined;
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  return { ctx, rects };
}

/** De blokjes van de QR: kleine vierkantjes, in tegenstelling tot de
 *  paginavullende achtergrondvlakken. */
const qrBlokjes = (rects: Rect[]) => rects.filter((r) => r.w < 20 && r.h < 20);

describe("drawSpeeldagPoster — QR-plaatsing", () => {
  const poster = (link: string | null) =>
    speeldagPoster({
      ...basis,
      spelers: [speler("Ann"), speler("Bo"), speler("Cis"), speler("Dirk")],
      link,
    });

  it("tekent geen losse blokjes zonder opt-in", () => {
    const { ctx, rects } = recorderCtx();
    drawSpeeldagPoster(ctx, poster(null), [null, null, null, null]);
    expect(qrBlokjes(rects)).toHaveLength(0);
  });

  it("zet alle QR-modules binnen de poster, onder het kaartraster", () => {
    const { ctx, rects } = recorderCtx();
    drawSpeeldagPoster(
      ctx,
      poster("https://padel.example/groepen/g1?tab=plannen&poll=poll-1"),
      [null, null, null, null],
    );
    const blokjes = qrBlokjes(rects);
    // Een QR van 33×33 heeft honderden donkere modules.
    expect(blokjes.length).toBeGreaterThan(200);

    const links = Math.min(...blokjes.map((r) => r.x));
    const rechts = Math.max(...blokjes.map((r) => r.x + r.w));
    const boven = Math.min(...blokjes.map((r) => r.y));
    const onder = Math.max(...blokjes.map((r) => r.y + r.h));

    // Binnen de poster, en horizontaal gecentreerd.
    expect(links).toBeGreaterThan(0);
    expect(rechts).toBeLessThan(POSTER_W);
    expect(onder).toBeLessThan(POSTER_H);
    expect((links + rechts) / 2).toBeCloseTo(POSTER_W / 2, 0);
    // In de onderste band: de voet, niet ergens tussen de kaarten.
    expect(boven).toBeGreaterThan(POSTER_H - 300);
  });
});
