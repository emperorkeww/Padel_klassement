import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Profile } from "@/types";
import type { PollOption } from "@/features/groups/pollsApi";
import type { OptionTally } from "@/features/groups/pollLogic";
import { PollOptionRow } from "./PollOptionRow";

// De "+N?"-badge zei alleen hóéveel mensen twijfelden; de namen zaten in een
// title-attribuut, dus op touch kwam je er nooit bij (#803).

const OPTION: PollOption = {
  id: "opt-1",
  poll_id: "poll-1",
  group_id: "g1",
  date: "2030-01-10",
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: "2026-07-08T10:00:00Z",
};

const profiel = (id: string, naam: string): Profile => ({
  id,
  username: naam.toLowerCase(),
  full_name: naam,
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
});

const PROFILES: Record<string, Profile> = {
  p1: profiel("p1", "Ann"),
  p2: profiel("p2", "Bert"),
  p3: profiel("p3", "Cis"),
};

const TALLY: OptionTally = {
  yes: ["p1"],
  maybe: ["p2", "p3"],
  no: [],
  needed: 1,
  enoughPlayers: false,
};

function renderRow(
  extra: { tally?: OptionTally; detailOpen?: boolean; votable?: boolean } = {},
  onToggleDetail = vi.fn(),
) {
  render(
    <ul>
      <PollOptionRow
        option={OPTION}
        tally={extra.tally ?? TALLY}
        state="haalbaar"
        free={2}
        mine={null}
        votable={extra.votable ?? true}
        past={false}
        detailOpen={extra.detailOpen ?? false}
        onToggleDetail={onToggleDetail}
        onVote={vi.fn()}
        profiles={PROFILES}
      />
    </ul>,
  );
  return onToggleDetail;
}

describe("<PollOptionRow /> misschien-stemmers (#803)", () => {
  it("noemt de twijfelaars bij naam in het detail", () => {
    renderRow({ detailOpen: true });

    expect(screen.getByText(/misschien: bert, cis/i)).toBeInTheDocument();
  });

  it("laat de misschien-badge het detail openen i.p.v. enkel te hoveren", async () => {
    const onToggleDetail = renderRow();

    const badge = screen.getByRole("button", { name: /2 misschien: bert, cis/i });
    await userEvent.click(badge);
    expect(onToggleDetail).toHaveBeenCalledTimes(1);
  });

  it("toont geen badge en geen regel zonder twijfelaars", () => {
    renderRow({ tally: { ...TALLY, maybe: [] }, detailOpen: true });

    expect(screen.queryByText(/misschien/i)).not.toBeInTheDocument();
  });

  it("telt de twijfelaars mee in de samenvatting van een niet-stembare rij", () => {
    renderRow({ votable: false });

    expect(screen.getByText("1 mee · 2?")).toBeInTheDocument();
  });
});
