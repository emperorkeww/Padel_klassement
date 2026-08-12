import { describe, it, expect, vi, beforeEach } from "vitest";

const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  const mock = makeSupabaseMock({ session: SESSION, tables });
  return { supabase: { ...mock, rpc } };
});

import {
  feedUrl,
  getMyFeedToken,
  googleCalendarUrl,
  rotateFeedToken,
  revokeFeedTokens,
  webcalUrl,
} from "./feedApi";

const BASE = "https://abc123.supabase.co";
const TOKEN = "11111111-2222-3333-4444-555555555555";

describe("feedUrl / webcalUrl / googleCalendarUrl", () => {
  it("bouwt de feed-URL op de edge function", () => {
    expect(feedUrl(TOKEN, BASE)).toBe(
      `${BASE}/functions/v1/calendar-feed/${TOKEN}.ics`,
    );
  });

  it("laat een afsluitende slash in de basis geen dubbele slash worden", () => {
    expect(feedUrl(TOKEN, `${BASE}/`)).toBe(feedUrl(TOKEN, BASE));
  });

  // webcal:// is wat één tik op mobiel meteen de agenda-app laat openen; https
  // zou het bestand downloaden en dan is het weer een momentopname.
  it("wisselt alleen het schema voor de abonneerlink", () => {
    expect(webcalUrl(TOKEN, BASE)).toBe(
      `webcal://abc123.supabase.co/functions/v1/calendar-feed/${TOKEN}.ics`,
    );
  });

  /* Android kent webcal:// niet; daar is Google's eigen "agenda via URL
     toevoegen" de enige tik die iets doet (#1117). Die route wil de feed
     ge-encodeerd in cid= hebben, anders kapt Google hem af op de query-scheiding. */
  it("zet de feed url-encoded in Google's cid-parameter", () => {
    const link = googleCalendarUrl(TOKEN, BASE);
    expect(link).toBe(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(TOKEN, BASE))}`,
    );
    expect(link).toContain("%3A%2F%2F");
    expect(new URL(link).searchParams.get("cid")).toBe(webcalUrl(TOKEN, BASE));
  });

  /* Deze assertie stond tot #1197 andersom ("geeft Google de https-vorm, niet
     webcal"), op de aanname dat Google de feed toch serverside ophaalt en het
     schema dus niet uitmaakt. Dat klopt voor het ophálen, maar niet voor de
     abonneervraag: `cid` is voor Google eerst een agenda-id en pas een
     feed-URL als het schema dat zegt. Elke "voeg toe aan Google Agenda"-link
     die in het wild werkt gebruikt daarom `cid=webcal%3A%2F%2F…`.

     Dat de aanname anderhalf jaar stil kon blijven staan komt doordat deze
     route niet lokaal te testen is (Google haalt geen localhost op), dus:
     verander dit niet zonder het tegen een gedeployde feed te klikken. */
  it("geeft Google de webcal-vorm in cid, met een https-feed erachter", () => {
    expect(googleCalendarUrl(TOKEN, BASE)).toContain(encodeURIComponent("webcal://"));
    expect(new URL(googleCalendarUrl(TOKEN, BASE)).searchParams.get("cid")).toMatch(
      /^webcal:\/\//,
    );
    // De feed zelf blijft gewoon https; webcal is alleen het signaal aan Google.
    expect(feedUrl(TOKEN, BASE)).toMatch(/^https:\/\//);
  });

  it("laat ook hier een afsluitende slash geen dubbele slash worden", () => {
    expect(googleCalendarUrl(TOKEN, `${BASE}/`)).toBe(googleCalendarUrl(TOKEN, BASE));
  });
});

describe("feedApi", () => {
  beforeEach(() => {
    rpc.mockReset();
    tables.calendar_feeds = [];
  });

  it("geeft null terug zolang je geen link hebt", async () => {
    await expect(getMyFeedToken()).resolves.toBeNull();
  });

  it("geeft je lopende link terug", async () => {
    tables.calendar_feeds = [
      { token: TOKEN, player_id: "p1", created_at: "2026-08-01T10:00:00Z", revoked_at: null },
    ];
    await expect(getMyFeedToken()).resolves.toBe(TOKEN);
  });

  // Dat een ingetrokken link niets meer teruggeeft staat in
  // supabase/tests/calendar_feed_test.sql: de supabase-mock filtert niet, dus
  // hier zou zo'n test alleen de mock bevestigen.

  it("vraagt een nieuwe link via de RPC die de oude meteen intrekt", async () => {
    rpc.mockResolvedValue({ data: TOKEN, error: null });
    await expect(rotateFeedToken()).resolves.toBe(TOKEN);
    expect(rpc).toHaveBeenCalledWith("rotate_calendar_feed");
  });

  it("laat een fout uit de RPC doorkomen i.p.v. een lege link terug te geven", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Niet ingelogd" } });
    await expect(rotateFeedToken()).rejects.toBeTruthy();
  });

  it("kan stoppen zonder nieuwe link", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await revokeFeedTokens();
    expect(rpc).toHaveBeenCalledWith("revoke_calendar_feeds");
  });
});
