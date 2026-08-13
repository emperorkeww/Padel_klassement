import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { PollWindow } from "@/features/groups/pollsApi";

/* ------------------------------------------------------------------ */
/* #1270: het groepsfilter, en waar een gedeelde link uitkomt.         */
/*                                                                     */
/* Twee dingen zaten hier fout en zijn allebei gereproduceerd. Het      */
/* filter stond alleen in localStorage, dus een gedeelde agenda-link    */
/* toonde bij de ander iets anders — en de koppen zwegen erover, zodat  */
/* "Geen speeldagen deze maand" boven een raster vol stippen kon staan. */
/* En `?dag=<toekomst>&open=1` opende een sheet dat "Deze dag is        */
/* geweest" zei over een dag die nog moet komen.                        */
/* ------------------------------------------------------------------ */

const CLUB = {
  id: "club-1",
  name: "Padel De Panne",
  city: "De Panne",
  timezone: "Europe/Brussels",
};

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: {} }) };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "me" } }),
}));

vi.mock("@/features/availability/club", () => ({ useClub: () => CLUB }));

vi.mock("@/features/availability/components/ClubPicker", () => ({
  ClubPicker: () => <button type="button">Kies club</button>,
}));

vi.mock("@/features/groups/api", () => ({
  getMyGroups: () =>
    Promise.resolve([
      { id: "g1", name: "Vamos!", member_ids: ["me", "p2", "p3", "p4"] },
      { id: "g2", name: "Kantoorpadel", member_ids: ["me", "p5"] },
    ]),
}));

vi.mock("@/features/profiles/api", async (orig) => ({
  ...(await orig<typeof import("@/features/profiles/api")>()),
  getProfilesMap: () => Promise.resolve({}),
}));

/** Eén geboekte speeldag per groep, allebei in augustus. */
function poll(id: string, groupId: string) {
  return {
    id,
    group_id: groupId,
    created_by: "p2",
    status: "booked" as const,
    locked_option_id: `opt-${id}`,
    created_at: "2026-08-01T10:00:00.000Z",
    locked_at: "2026-08-02T10:00:00.000Z",
    booked_at: "2026-08-02T11:00:00.000Z",
    club_id: CLUB.id,
    club_name: CLUB.name,
    club_city: CLUB.city,
    club_timezone: CLUB.timezone,
    access_code: null,
    courts: null,
    rounds_generated_at: null,
  };
}

function optie(pollId: string, groupId: string, date: string) {
  return {
    id: `opt-${pollId}`,
    poll_id: pollId,
    group_id: groupId,
    date,
    start_time: "20:00",
    duration: 90,
    courts_free: null,
    created_at: "2026-08-01T10:00:00.000Z",
  };
}

const VENSTER: PollWindow = {
  polls: [poll("poll-1", "g1"), poll("poll-2", "g2")],
  options: [
    optie("poll-1", "g1", "2026-08-13"),
    optie("poll-2", "g2", "2026-08-14"),
  ],
  votes: [],
};

vi.mock("@/features/groups/pollsApi", async (orig) => ({
  ...(await orig<typeof import("@/features/groups/pollsApi")>()),
  getPollWindow: () => Promise.resolve(VENSTER),
}));

import { Agenda } from "./Agenda";

/** De querystring zoals hij nú in de router staat — dat is wat je deelt. */
function UrlSonde() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function toon(url = "/agenda") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Agenda />
        <UrlSonde />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const url = () => screen.getByTestId("url").textContent;

/**
 * De chip in de filterrij, en niet die in "Suggesties voor" onderaan: die
 * tweede rij draagt dezelfde groepsnamen in dezelfde vorm terwijl hij iets
 * anders doet. Dat is punt 5 van #1270 en hoort bij PR 3; hier moeten we er
 * alleen omheen kunnen mikken.
 */
const chip = (naam: string) =>
  within(screen.getByRole("group", { name: "Filter op groep" })).getByRole(
    "button",
    { name: naam },
  );

describe("<Agenda /> — het groepsfilter is zichtbaar (#1270)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("zwijgt over het filter zolang alles meetelt", async () => {
    toon();
    expect(await screen.findByText("2 speeldagen deze maand")).toBeInTheDocument();
    expect(url()).toBe("");
  });

  it("noemt de groep in de telling en zet hem in de URL", async () => {
    toon();
    await screen.findByText("2 speeldagen deze maand");

    await userEvent.click(chip("Vamos!"));

    // De telling zegt nu waarover ze gaat: zonder die staart las "1 speeldag
    // deze maand" als een agenda die ineens leger was geworden.
    expect(
      await screen.findByText("1 speeldag deze maand in Vamos!"),
    ).toBeInTheDocument();
    // En de keuze staat in de link die je deelt.
    expect(url()).toBe("?groepen=g1");
  });

  it("telt in plaats van namen op te sommen zodra er meer aanstaan", async () => {
    toon();
    await screen.findByText("2 speeldagen deze maand");
    await userEvent.click(chip("Vamos!"));
    await userEvent.click(chip("Kantoorpadel"));
    // Allebei aan is hetzelfde beeld als alles aan; dan valt er niets te melden.
    expect(await screen.findByText("2 speeldagen deze maand")).toBeInTheDocument();
  });

  it("leest het filter uit de URL, ook als je het nooit zelf koos", async () => {
    // Dit is de kant van de ontvanger: dezelfde link hoort hetzelfde te tonen.
    toon("/agenda?groepen=g2");
    expect(
      await screen.findByText("1 speeldag deze maand in Kantoorpadel"),
    ).toBeInTheDocument();
  });

  it("negeert een groep uit iemand anders' link", async () => {
    // `?groepen=` draagt per definitie vreemde id's; zonder zeef hield zo'n
    // link de agenda leeg zonder een chip om hem uit te zetten.
    toon("/agenda?groepen=niet-van-jou");
    expect(await screen.findByText("2 speeldagen deze maand")).toBeInTheDocument();
  });

  it("schrijft de onthouden keuze alsnog in de URL", async () => {
    // Wie vorige week filterde en vandaag een link deelt, deelde tot nu toe een
    // andere agenda dan hij zelf zag.
    localStorage.setItem("agenda-groepen", "g1");
    toon();
    expect(
      await screen.findByText("1 speeldag deze maand in Vamos!"),
    ).toBeInTheDocument();
    // Bijschrijven gebeurt in een effect, dus een tik later dan de telling.
    await waitFor(() => expect(url()).toBe("?groepen=g1"));
  });
});

describe("<Agenda /> — een deeplink naar een lege dag (#1270)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("liegt niet over een dag die nog moet komen", async () => {
    toon("/agenda?dag=2026-08-20&open=1");
    const sheet = await screen.findByRole("dialog", {
      name: /donderdag 20 augustus/,
    });
    expect(sheet).toHaveTextContent("Nog niets gepland");
    expect(sheet).not.toHaveTextContent("Deze dag is geweest");
  });

  it("houdt het verleden-verhaal voor een dag die wél geweest is", async () => {
    toon("/agenda?dag=2026-08-03&open=1");
    const sheet = await screen.findByRole("dialog", {
      name: /maandag 3 augustus/,
    });
    expect(sheet).toHaveTextContent("Deze dag is geweest");
  });
});
