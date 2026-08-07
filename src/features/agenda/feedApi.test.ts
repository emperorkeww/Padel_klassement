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
  rotateFeedToken,
  revokeFeedTokens,
  webcalUrl,
} from "./feedApi";

const BASE = "https://abc123.supabase.co";
const TOKEN = "11111111-2222-3333-4444-555555555555";

describe("feedUrl / webcalUrl", () => {
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
