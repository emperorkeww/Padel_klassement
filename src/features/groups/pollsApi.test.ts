import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase/client", async () => {
  const h = await import("@/test/apiHarness");
  return { supabase: h.build() };
});

import { enqueue, reset, calls } from "@/test/apiHarness";
import {
  pollClub,
  setPollVote,
  clearPollVote,
  createPoll,
  addPollOption,
  removePollOption,
  pollShareUrl,
  pollSharePath,
  markPollBooked,
  setPollBookingDetails,
  reopenPoll,
  type PlayPoll,
  type NewPollOption,
} from "./pollsApi";
import type { Club } from "@/features/availability/club";

// pollClub leidt het Club-object af uit de locatie-snapshot op de poll (#322),
// zodat de UI de opgeslagen club gebruikt i.p.v. de globale voorkeur.
function poll(overrides: Partial<PlayPoll> = {}): PlayPoll {
  return {
    id: "poll-1",
    group_id: "g1",
    created_by: "p1",
    status: "open",
    locked_option_id: null,
    created_at: "2026-07-08T10:00:00Z",
    locked_at: null,
    booked_at: null,
    club_id: "tenant-42",
    club_name: "Padel Gent",
    club_city: "Gent",
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...overrides,
  };
}

describe("pollClub (#322)", () => {
  it("bouwt het Club-object uit de opgeslagen snapshot", () => {
    expect(pollClub(poll())).toEqual({
      id: "tenant-42",
      name: "Padel Gent",
      city: "Gent",
      timezone: "Europe/Brussels",
    });
  });

  it("vult een ontbrekende stad aan met een lege string", () => {
    expect(pollClub(poll({ club_city: null })).city).toBe("");
  });

  it("behoudt een lege club_id (handmatige locatie)", () => {
    // Een handmatige locatie heeft geen Playtomic-tenant: leeg id blijft leeg.
    expect(pollClub(poll({ club_id: "", club_name: "Sporthal" })).id).toBe("");
  });
});

const club: Club = {
  id: "tenant-42",
  name: "Padel Gent",
  city: "Gent",
  timezone: "Europe/Brussels",
};

function option(overrides: Partial<NewPollOption> = {}): NewPollOption {
  return {
    date: "2026-07-25",
    startTime: "19:00",
    duration: 90,
    courtsFree: 2,
    ...overrides,
  };
}

describe("setPollVote", () => {
  beforeEach(() => reset());

  it("upsert't de stem met onConflict en de juiste velden", async () => {
    enqueue({ error: null });
    await setPollVote("opt1", "g1", "p1", "yes");
    const up = calls.find((c) => c.method === "upsert");
    expect(up?.table).toBe("play_poll_votes");
    expect(up?.args[0]).toMatchObject({
      option_id: "opt1",
      group_id: "g1",
      player_id: "p1",
      status: "yes",
    });
    expect(up?.args[1]).toEqual({ onConflict: "option_id,player_id" });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(setPollVote("opt1", "g1", "p1", "no")).rejects.toEqual({
      message: "stuk",
    });
  });
});

describe("clearPollVote", () => {
  beforeEach(() => reset());

  it("delete't de stem op option_id en player_id", async () => {
    enqueue({ error: null });
    await clearPollVote("opt1", "p1");
    const del = calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("play_poll_votes");
    const eqs = calls.filter((c) => c.method === "eq");
    expect(eqs).toHaveLength(2);
    expect(eqs[0].args).toEqual(["option_id", "opt1"]);
    expect(eqs[1].args).toEqual(["player_id", "p1"]);
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(clearPollVote("opt1", "p1")).rejects.toEqual({
      message: "stuk",
    });
  });
});

describe("createPoll", () => {
  beforeEach(() => reset());

  it("maakt de poll en de opties aan", async () => {
    enqueue({ data: [{ id: "poll1" }] }); // play_polls insert().select()
    enqueue({ data: [{ id: "o1" }, { id: "o2" }] }); // play_poll_options insert().select()
    await createPoll({
      groupId: "g1",
      createdBy: "p1",
      club,
      options: [option(), option({ startTime: "20:30" })],
    });
    const inserts = calls.filter((c) => c.method === "insert");
    expect(inserts[0].table).toBe("play_polls");
    expect(inserts[0].args[0]).toMatchObject({
      group_id: "g1",
      created_by: "p1",
      club_id: "tenant-42",
      club_name: "Padel Gent",
      club_city: "Gent",
      club_timezone: "Europe/Brussels",
    });
    expect(inserts[1].table).toBe("play_poll_options");
    const rows = inserts[1].args[0] as unknown[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      poll_id: "poll1",
      group_id: "g1",
      date: "2026-07-25",
      start_time: "19:00",
      duration: 90,
      courts_free: 2,
    });
  });

  it("gooit als de poll-insert geen rij teruggeeft", async () => {
    enqueue({ data: [] });
    await expect(
      createPoll({ groupId: "g1", createdBy: "p1", club, options: [option()] }),
    ).rejects.toThrow("Poll aanmaken mislukte.");
  });

  it("rolt de poll terug als de opties falen", async () => {
    enqueue({ data: [{ id: "poll1" }] }); // poll insert ok
    enqueue({ error: { message: "opties stuk" } }); // opties insert faalt
    enqueue({ data: null }); // rollback delete
    await expect(
      createPoll({ groupId: "g1", createdBy: "p1", club, options: [option()] }),
    ).rejects.toEqual({ message: "opties stuk" });
    // De rollback verwijdert de zojuist gemaakte poll.
    const del = calls.find(
      (c) => c.method === "delete" && c.table === "play_polls",
    );
    expect(del).toBeTruthy();
    const eq = calls.find((c) => c.method === "eq");
    expect(eq?.args).toEqual(["id", "poll1"]);
  });
});

describe("addPollOption", () => {
  beforeEach(() => reset());

  it("insert't één optie op de poll", async () => {
    enqueue({ error: null });
    await addPollOption("poll1", "g1", option());
    const ins = calls.find((c) => c.method === "insert");
    expect(ins?.table).toBe("play_poll_options");
    expect(ins?.args[0]).toMatchObject({
      poll_id: "poll1",
      group_id: "g1",
      date: "2026-07-25",
      start_time: "19:00",
      duration: 90,
      courts_free: 2,
    });
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(addPollOption("poll1", "g1", option())).rejects.toEqual({
      message: "stuk",
    });
  });
});

describe("removePollOption", () => {
  beforeEach(() => reset());

  it("delete't de optie op id", async () => {
    enqueue({ error: null });
    await removePollOption("o1");
    const del = calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("play_poll_options");
    const eq = calls.find((c) => c.method === "eq");
    expect(eq?.args).toEqual(["id", "o1"]);
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(removePollOption("o1")).rejects.toEqual({ message: "stuk" });
  });
});

// Boekgegevens: banen (#802) en toegangscode (#675) — optioneel bij het boeken,
// los te zetten of te wissen achteraf, en weg zodra de boeking vervalt.
describe("markPollBooked", () => {
  beforeEach(() => reset());

  it("laat de boekgegevens ongemoeid zonder argument", async () => {
    enqueue({ error: null });
    await markPollBooked("poll1");
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.table).toBe("play_polls");
    expect(upd?.args[0]).toMatchObject({ status: "booked" });
    expect(upd?.args[0]).not.toHaveProperty("access_code");
    expect(upd?.args[0]).not.toHaveProperty("courts");
  });

  it("zet de genormaliseerde banen en code mee", async () => {
    enqueue({ error: null });
    await markPollBooked("poll1", {
      courts: "  3  &  4 ",
      accessCode: "  b3:  1234 ",
    });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toMatchObject({
      status: "booked",
      courts: "3 & 4",
      access_code: "b3: 1234",
    });
  });

  it("een leeg veld betekent expliciet 'niet ingevuld'", async () => {
    enqueue({ error: null });
    await markPollBooked("poll1", { courts: "  ", accessCode: "   " });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toMatchObject({ courts: null, access_code: null });
  });

  it("raakt alleen het meegegeven veld aan", async () => {
    enqueue({ error: null });
    await markPollBooked("poll1", { courts: "3" });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toMatchObject({ courts: "3" });
    expect(upd?.args[0]).not.toHaveProperty("access_code");
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(markPollBooked("poll1")).rejects.toEqual({ message: "stuk" });
  });
});

describe("setPollBookingDetails", () => {
  beforeEach(() => reset());

  it("zet banen en code op de poll", async () => {
    enqueue({ error: null });
    await setPollBookingDetails("poll1", { courts: "Baan 3", accessCode: "A12" });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.table).toBe("play_polls");
    expect(upd?.args[0]).toEqual({ courts: "Baan 3", access_code: "A12" });
    const eq = calls.find((c) => c.method === "eq");
    expect(eq?.args).toEqual(["id", "poll1"]);
  });

  it("wist ze met null", async () => {
    enqueue({ error: null });
    await setPollBookingDetails("poll1", { courts: null, accessCode: null });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toEqual({ courts: null, access_code: null });
  });

  it("raakt de status niet aan", async () => {
    enqueue({ error: null });
    await setPollBookingDetails("poll1", { accessCode: "1234" });
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).not.toHaveProperty("status");
  });

  it("gooit bij een fout", async () => {
    enqueue({ error: { message: "stuk" } });
    await expect(
      setPollBookingDetails("poll1", { accessCode: "1234" }),
    ).rejects.toEqual({
      message: "stuk",
    });
  });
});

describe("reopenPoll", () => {
  beforeEach(() => reset());

  it("wist de banen en de code samen met de boeking", async () => {
    enqueue({ error: null });
    await reopenPoll("poll1");
    const upd = calls.find((c) => c.method === "update");
    expect(upd?.args[0]).toMatchObject({
      status: "open",
      locked_option_id: null,
      locked_at: null,
      booked_at: null,
      access_code: null,
      courts: null,
    });
  });
});

// Deep-link naar één speeldag (#675): spiegel van slotShareUrl. Sinds #1121
// een eigen route in plaats van een tab-toestand op de groepspagina.
describe("pollShareUrl", () => {
  it("bouwt een absolute link naar de speeldagpagina", () => {
    expect(pollShareUrl("poll-1")).toBe(
      `${window.location.origin}/speeldag/poll-1`,
    );
  });

  it("codeert id's die niet URL-veilig zijn", () => {
    expect(pollShareUrl("a b&c")).toContain("/speeldag/a%20b%26c");
  });
});

// Zelfde pad zonder origin (#886), voor links binnen de app.
describe("pollSharePath", () => {
  it("geeft een relatief pad — een absolute url herlaadt de hele app", () => {
    expect(pollSharePath("poll-1")).toBe("/speeldag/poll-1");
  });

  it("is precies het pad-deel van pollShareUrl", () => {
    expect(pollShareUrl("poll-1")).toBe(
      `${window.location.origin}${pollSharePath("poll-1")}`,
    );
  });
});
