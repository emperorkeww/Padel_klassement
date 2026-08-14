import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "@/ui/ToastProvider";

const tik = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

// Gastheer met knoppen per soort, zodat een test een toast kan laten
// verschijnen zoals de app dat doet: via de hook, niet via props.
function Host() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Gelukt")}>succes</button>
      <button onClick={() => toast.error("Mislukt")}>fout</button>
      <button onClick={() => toast.info("Tik hier", { onClick: () => {} })}>
        tikbaar
      </button>
    </>
  );
}

const toon = (soort: string) =>
  fireEvent.click(screen.getByRole("button", { name: soort }));

describe("<ToastProvider />", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("laat succes vanzelf verdwijnen en houdt fouten staan", () => {
    render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );

    toon("succes");
    toon("fout");
    expect(screen.getByText("Gelukt")).toBeInTheDocument();

    tik(4000);
    expect(screen.queryByText("Gelukt")).not.toBeInTheDocument();
    expect(screen.getByText("Mislukt")).toBeInTheDocument();
  });

  it("geeft een tikbare toast langer de tijd", () => {
    render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );

    toon("tikbaar");
    tik(4000);
    expect(screen.getByText("Tik hier")).toBeInTheDocument();

    tik(4000);
    expect(screen.queryByText("Tik hier")).not.toBeInTheDocument();
  });

  // De timer overleefde de provider: vier seconden na het einde van een test
  // vuurde er nog een setState in een afgebroken jsdom ("window is not
  // defined"), wat de hele suite rood maakte terwijl elke test slaagde.
  it("laat geen timer achter na unmount", () => {
    const { unmount } = render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );

    toon("succes");
    toon("tikbaar");
    expect(vi.getTimerCount()).toBe(2);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  // Wegklikken haalde de toast wel weg maar liet zijn timer lopen; die deed
  // daarna niets zichtbaars, en hield dus stilletjes de provider vast.
  it("neemt de timer mee als de toast weggeklikt wordt", () => {
    render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );

    toon("succes");
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }));

    expect(screen.queryByText("Gelukt")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});
