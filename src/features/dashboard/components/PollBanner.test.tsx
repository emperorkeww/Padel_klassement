import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PollBanner } from "./PollBanner";
import type { GroupSummary } from "@/features/groups/api";
import type { PlayPoll, PollOption, PollVote } from "@/features/groups/pollsApi";

// De banner op het overzicht linkt sinds #886 naar de speeldag zelf i.p.v.
// naar de Plannen-tab: met meerdere lopende polls mocht je anders zelf raden
// welke van de drie de banner bedoelde.

const group = { id: "g1", name: "Vrijdagavond padel" } as unknown as GroupSummary;

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
    club_id: "91d8d419-3736-498e-90be-362de786d588",
    club_name: "LAGO CLUB Padel Beveren",
    club_city: "Beveren",
    club_timezone: "Europe/Brussels",
    access_code: null,
    courts: null,
    rounds_generated_at: null,
    ...overrides,
  };
}

function option(overrides: Partial<PollOption> = {}): PollOption {
  return {
    id: "opt-1",
    poll_id: "poll-1",
    group_id: "g1",
    date: "2026-07-10",
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-07-08T10:00:00Z",
    ...overrides,
  };
}

const NU = new Date("2026-07-09T12:00:00Z").getTime();

function renderBanner(polls: PlayPoll[], options: PollOption[], votes: PollVote[] = []) {
  return render(
    <MemoryRouter>
      <PollBanner
        bundles={[{ group, polls, options, votes }]}
        myId="p1"
        now={NU}
      />
    </MemoryRouter>,
  );
}

describe("<PollBanner />", () => {
  it("linkt 'Stem nu' naar de poll waar de banner over gaat", () => {
    const { container } = renderBanner(
      [poll({ id: "poll-open" })],
      [option({ poll_id: "poll-open" })],
    );

    expect(screen.getByRole("link", { name: /stem nu/i })).toHaveAttribute(
      "href",
      "/speeldag/poll-open",
    );
    expect(container.querySelector(".poll-banner__watermark")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("doet hetzelfde voor een vastgelegde speeldag", () => {
    renderBanner(
      [poll({ id: "poll-vast", status: "booked", locked_option_id: "opt-1" })],
      [option({ poll_id: "poll-vast" })],
      [
        {
          option_id: "opt-1",
          group_id: "g1",
          player_id: "p1",
          status: "yes",
          updated_at: "2026-07-08T10:00:00Z",
        },
      ],
    );

    expect(screen.getByRole("link", { name: /bekijk/i })).toHaveAttribute(
      "href",
      "/speeldag/poll-vast",
    );
  });

  it("toont niets zonder speeldag om over te berichten", () => {
    const { container } = renderBanner([], []);
    expect(container).toBeEmptyDOMElement();
  });
});
