import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MAX_MEMBER_AVATARS } from "../groepHelpers";
import { MemberStack } from "./MemberStack";

// De groepskop toonde het restaantal als kaal getal dat onder de laatste avatar
// schoof: naast "19 leden" leek daar ineens een losse "15" te staan (#975).
// #946 probeerde dat al te repareren met een marge, maar die verloor op
// specificiteit van de stapel-overlap — vandaar deze test op de "+".

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe("MemberStack", () => {
  it("toont het restaantal als +n-badge, niet als kaal getal", () => {
    const { container } = render(
      <MemberStack ids={ids(MAX_MEMBER_AVATARS + 15)} profiles={{}} />,
    );

    const badge = container.querySelector(".member-stack__meer");
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("+15");
  });

  it("toont hooguit MAX_MEMBER_AVATARS avatars", () => {
    const { container } = render(
      <MemberStack ids={ids(MAX_MEMBER_AVATARS + 3)} profiles={{}} />,
    );

    expect(container.querySelectorAll(".avatar")).toHaveLength(
      MAX_MEMBER_AVATARS,
    );
  });

  it("laat de badge weg als iedereen in beeld staat", () => {
    const { container } = render(
      <MemberStack ids={ids(MAX_MEMBER_AVATARS)} profiles={{}} />,
    );

    expect(container.querySelector(".member-stack__meer")).toBeNull();
  });

  it("telt met het opgegeven totaal, niet met de getoonde id's", () => {
    // De uitnodigingspagina krijgt een preview met een los geteld ledental.
    const { container } = render(
      <MemberStack ids={ids(MAX_MEMBER_AVATARS)} profiles={{}} total={19} />,
    );

    expect(container.querySelector(".member-stack__meer")).toHaveTextContent(
      `+${19 - MAX_MEMBER_AVATARS}`,
    );
  });

  it("rendert niets zonder leden", () => {
    const { container } = render(<MemberStack ids={[]} profiles={{}} />);

    expect(container.querySelector(".member-stack")).toBeNull();
  });
});
