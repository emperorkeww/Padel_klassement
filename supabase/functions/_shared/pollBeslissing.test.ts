import { describe, expect, it } from "vitest";
import { haaltDrempel, kiesMoment, MIN_SPELERS } from "./pollBeslissing.ts";
import type { MomentTelling } from "./pollBeslissing.ts";
// De client-tegenhanger: dezelfde drempel, andere boom.
import { besteOptie, PLAYERS_PER_COURT } from "@/features/groups/pollLogic";
import type { PollOption, PollVote } from "@/features/groups/pollsApi";

const moment = (over: Partial<MomentTelling> = {}): MomentTelling => ({
  optionId: "a",
  ja: 0,
  misschien: 0,
  courtsFree: null,
  startMs: Date.parse("2026-08-20T18:00:00Z"),
  ...over,
});

describe("MIN_SPELERS", () => {
  it("blijft gelijk aan de drempel die de app toont", () => {
    expect(MIN_SPELERS).toBe(PLAYERS_PER_COURT);
  });
});

describe("haaltDrempel", () => {
  it("telt ja en misschien bij elkaar op", () => {
    expect(haaltDrempel(moment({ ja: 3 }))).toBe(false);
    expect(haaltDrempel(moment({ ja: 2, misschien: 2 }))).toBe(true);
    expect(haaltDrempel(moment({ misschien: 4 }))).toBe(true);
  });
});

describe("kiesMoment", () => {
  it("annuleert onder de drempel — ook met ja-stemmen", () => {
    expect(kiesMoment([moment({ ja: 3 })])).toBeNull();
    expect(kiesMoment([moment({ ja: 1, misschien: 1 })])).toBeNull();
  });

  it("legt vast zodra ja plus misschien er vier zijn", () => {
    const gekozen = kiesMoment([moment({ ja: 2, misschien: 2 })]);
    expect(gekozen?.optionId).toBe("a");
  });

  it("kiest op ja-stemmen, niet op het totaal", () => {
    // b heeft meer volk (6), maar a heeft de meeste harde ja's.
    const a = moment({ optionId: "a", ja: 5 });
    const b = moment({ optionId: "b", ja: 2, misschien: 4 });
    expect(kiesMoment([a, b])?.optionId).toBe("a");
    expect(kiesMoment([b, a])?.optionId).toBe("a");
  });

  it("laat bij gelijk aantal ja het vroegste moment winnen", () => {
    const laat = moment({
      optionId: "laat",
      ja: 4,
      startMs: Date.parse("2026-08-21T18:00:00Z"),
    });
    const vroeg = moment({
      optionId: "vroeg",
      ja: 4,
      startMs: Date.parse("2026-08-20T18:00:00Z"),
    });
    expect(kiesMoment([laat, vroeg])?.optionId).toBe("vroeg");
    expect(kiesMoment([vroeg, laat])?.optionId).toBe("vroeg");
  });

  it("laat een moment vallen waarvoor te weinig baan vrij is", () => {
    // Negen ja-stemmers vragen drie banen; er is er één vrij.
    expect(kiesMoment([moment({ ja: 9, courtsFree: 1 })])).toBeNull();
    // Onbekende beschikbaarheid telt als haalbaar.
    expect(kiesMoment([moment({ ja: 9, courtsFree: null })])?.optionId).toBe("a");
  });

  it("valt terug op het moment dat wél een baan heeft", () => {
    const vol = moment({ optionId: "vol", ja: 8, courtsFree: 1 });
    const vrij = moment({ optionId: "vrij", ja: 4, courtsFree: 1 });
    expect(kiesMoment([vol, vrij])?.optionId).toBe("vrij");
  });

  it("geeft null zonder momenten", () => {
    expect(kiesMoment([])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Pariteit met de kaart (#1271).                                      */
/*                                                                     */
/* De poll-kaart stelt één moment voor met een "Kies …"-knop. Die knop */
/* had zijn eigen regel: meeste ja's onder de niet-onhaalbare, zonder  */
/* minimum. De cron eist daarnaast ja + misschien >= 4. De app kon dus */
/* een moment aanbevelen dat de automaat een halve dag later níét koos,*/
/* zonder dat iemand dat zag aankomen. Deze suite houdt de twee gelijk.*/
/* ------------------------------------------------------------------ */
describe("pariteit met de kaart", () => {
  const VANDAAG = "2026-08-20";

  /** Een MomentTelling als poll-optie plus stemmen, zodat besteOptie dezelfde
   *  situatie te zien krijgt. */
  function alsOptie(m: MomentTelling, tijd: string) {
    const option = {
      id: m.optionId,
      poll_id: "p",
      date: VANDAAG,
      start_time: tijd,
      duration: 90,
      courts_free: m.courtsFree,
      created_at: "2026-08-01T00:00:00Z",
    } as unknown as PollOption;
    const votes: PollVote[] = [
      ...Array.from({ length: m.ja }, (_, i) => ({ status: "yes" as const, i })),
      ...Array.from({ length: m.misschien }, (_, i) => ({
        status: "maybe" as const,
        i: 100 + i,
      })),
    ].map(({ status, i }) => ({
      option_id: m.optionId,
      player_id: `p${i}`,
      status,
    })) as unknown as PollVote[];
    return { option, votes };
  }

  const GEVALLEN: { naam: string; momenten: [MomentTelling, string][] }[] = [
    {
      naam: "te weinig volk",
      momenten: [[moment({ optionId: "a", ja: 2 }), "19:00"]],
    },
    {
      naam: "misschiens halen de drempel",
      momenten: [[moment({ optionId: "a", ja: 2, misschien: 2 }), "19:00"]],
    },
    {
      naam: "meeste ja's wint",
      momenten: [
        [moment({ optionId: "a", ja: 4 }), "19:00"],
        [moment({ optionId: "b", ja: 6 }), "20:00"],
      ],
    },
    {
      naam: "gelijkspel: de vroegste wint",
      momenten: [
        [moment({ optionId: "a", ja: 4 }), "19:00"],
        [moment({ optionId: "b", ja: 4 }), "20:00"],
      ],
    },
    {
      naam: "te weinig baan valt af",
      momenten: [
        [moment({ optionId: "a", ja: 9, courtsFree: 1 }), "19:00"],
        [moment({ optionId: "b", ja: 4, courtsFree: 1 }), "20:00"],
      ],
    },
    {
      naam: "onbekende beschikbaarheid telt als haalbaar",
      momenten: [[moment({ optionId: "a", ja: 4, courtsFree: null }), "19:00"]],
    },
    {
      naam: "niets haalt het",
      momenten: [
        [moment({ optionId: "a", ja: 1 }), "19:00"],
        [moment({ optionId: "b", ja: 9, courtsFree: 1 }), "20:00"],
      ],
    },
  ];

  for (const geval of GEVALLEN) {
    it(`kiest hetzelfde moment — ${geval.naam}`, () => {
      const tellingen = geval.momenten.map(([m, tijd], i) => ({
        ...m,
        startMs: Date.parse(`${VANDAAG}T${tijd}:00Z`) + i * 0,
      }));
      const opties = geval.momenten.map(([m, tijd]) => alsOptie(m, tijd));

      const cron = kiesMoment(tellingen)?.optionId ?? null;
      const kaart =
        besteOptie(
          opties.map((o) => o.option),
          opties.flatMap((o) => o.votes),
          (o) => (o.courts_free as number | null) ?? null,
          VANDAAG,
        )?.id ?? null;

      expect(kaart).toBe(cron);
    });
  }
});
