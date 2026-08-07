import { describe, it, expect } from "vitest";
import {
  feedRespons,
  minuutStempel,
  naarEvent,
  tokenUitPad,
  type FeedRij,
} from "./feedRoute.ts";

const NU = new Date("2026-08-07T09:15:30.000Z");
const TOKEN = "427a530a-2cc4-4785-a3d8-d4bb3e6455fe";

const rij: FeedRij = {
  poll_id: "poll-1",
  group_name: "Vrijdagavond",
  club_name: "Funchal Padel",
  club_city: "Funchal",
  courts: "3 & 4",
  duration: 90,
  starts_at: "2026-08-14T19:00:00+00:00",
  changed_at: "2026-08-07T10:03:21.045937+00:00",
};

describe("tokenUitPad", () => {
  it("pakt het token uit het pad, met of zonder .ics", () => {
    expect(tokenUitPad(`https://x.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics`)).toBe(TOKEN);
    expect(tokenUitPad(`https://x.supabase.co/functions/v1/calendar-feed/${TOKEN}`)).toBe(TOKEN);
  });

  it("negeert een querystring", () => {
    expect(
      tokenUitPad(`https://x.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics?t=1`),
    ).toBe(TOKEN);
  });

  /* Het token is de hele afscherming, dus alles wat er niet als één uitziet
     gaat eruit vóór er een query op los gaat. */
  it("weigert alles wat geen UUID is", () => {
    for (const pad of [
      "https://x.supabase.co/functions/v1/calendar-feed/",
      "https://x.supabase.co/functions/v1/calendar-feed/geen-token.ics",
      "https://x.supabase.co/functions/v1/calendar-feed/../../etc/passwd",
      `https://x.supabase.co/functions/v1/calendar-feed/${TOKEN}xx.ics`,
    ]) {
      expect(tokenUitPad(pad)).toBeNull();
    }
  });
});

describe("naarEvent", () => {
  it("maakt er een event van met groep, club en banen", () => {
    const e = naarEvent(rij);
    expect(e.uid).toBe("speeldag-poll-1@vamos-padel");
    expect(e.title).toBe("Padel: Vrijdagavond");
    expect(e.location).toBe("Funchal Padel, Funchal");
    expect(e.description).toBe("Vrijdagavond · Baan 3 & 4");
    expect(e.sequence).toBe(minuutStempel(rij.changed_at));
  });

  it("laat de stad weg als de club er geen heeft", () => {
    expect(naarEvent({ ...rij, club_city: null }).location).toBe("Funchal Padel");
  });
});

describe("feedRespons", () => {
  it("geeft een kalender met het juiste content-type en privé-caching", async () => {
    const res = feedRespons([rij], { now: NU });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, max-age=1800");
    const body = await res.text();
    expect(body).toContain("BEGIN:VEVENT");
    // 20:00 in Funchal (UTC+1 in augustus) = 19:00 UTC.
    expect(body).toContain("DTSTART:20260814T190000Z");
  });

  it("geeft bij een geldige lege feed nog steeds 200 met een lege kalender", async () => {
    const res = feedRespons([], { now: NU });
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("BEGIN:VEVENT");
  });

  // Onbekend en ingetrokken komen allebei als null binnen: van buitenaf mag je
  // die twee niet uit elkaar kunnen houden.
  it("geeft 404 zonder onderscheid als er geen lopende feed achter zit", async () => {
    const res = feedRespons(null);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Not Found");
  });

  it("laat bij HEAD het lichaam weg maar houdt de headers", async () => {
    const res = feedRespons([rij], { head: true, now: NU });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(await res.text()).toBe("");
  });
});
