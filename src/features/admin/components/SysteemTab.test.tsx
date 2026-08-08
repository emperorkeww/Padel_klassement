import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { ToastProvider } from "@/ui/ToastProvider";
import { SysteemTab } from "./SysteemTab";
import type { SysteemStatus } from "../types";

// Sinds #1049 hangt SchakelaarsBlok in dit tabblad; die haalt zijn eigen data
// op, dus die api-functies moeten hier mee gemockt worden.
vi.mock("../api", () => ({
  systeemStatus: vi.fn(),
  lijstInstellingen: vi.fn(),
  zetInstelling: vi.fn(),
}));

const { systeemStatus, lijstInstellingen } = await import("../api");

/** SchakelaarsBlok gebruikt toasts, dus het tabblad heeft de provider nodig. */
function toonTab() {
  return render(
    <ToastProvider>
      <SysteemTab />
    </ToastProvider>,
  );
}

function status(over: Partial<SysteemStatus["databank"]> = {}): SysteemStatus {
  return {
    databank: {
      cron: [
        {
          jobname: "appeal-deadline",
          schedule: "10,25,40,55 * * * *",
          actief: true,
          laatste_start: "2026-08-08T11:55:00Z",
          laatste_einde: "2026-08-08T11:55:01Z",
          laatste_status: "succeeded",
          laatste_bericht: null,
          oordeel: { status: "ok", stilMinuten: 5, drempel: 25 },
        },
      ],
      tabellen: [{ tabel: "matches", rijen: 743 }],
      migratie: { versie: "20260808120000", naam: "1049_systeem_status" },
      push: {
        abonnementen: 12,
        gebruikers: 7,
        oudste: "2026-01-01T10:00:00Z",
        nieuwste: "2026-08-01T10:00:00Z",
      },
      gemeten_op: "2026-08-08T12:00:00Z",
      ...over,
    },
    secrets: { CRON_SECRET: true, OPENAI_API_KEY: true },
    // Bewust een andere naam dan de cron-job hierboven: anders staat dezelfde
    // tekst in twee tabellen en zegt een getByText niets meer over wélke.
    functies: [
      {
        naam: "send-push",
        rol: "Pushmeldingen",
        verifyJwt: false,
        cronGeheim: true,
        ontbrekend: [],
      },
    ],
  };
}

describe("<SysteemTab />", () => {
  beforeEach(() => {
    (systeemStatus as Mock).mockReset();
    (lijstInstellingen as Mock).mockReset();
    (lijstInstellingen as Mock).mockResolvedValue([]);
  });

  it("toont per cron-job het schema en de laatste run", async () => {
    (systeemStatus as Mock).mockResolvedValue(status());
    toonTab();

    expect(await screen.findByText("appeal-deadline")).toBeInTheDocument();
    expect(screen.getByText("10,25,40,55 * * * *")).toBeInTheDocument();
    expect(screen.getByText("draait")).toBeInTheDocument();
  });

  it("markeert een job die zijn interval ruim overschreden heeft", async () => {
    (systeemStatus as Mock).mockResolvedValue(
      status({
        cron: [
          {
            jobname: "appeal-deadline",
            schedule: "10,25,40,55 * * * *",
            actief: true,
            laatste_start: "2026-08-08T09:00:00Z",
            laatste_einde: "2026-08-08T09:00:01Z",
            laatste_status: "succeeded",
            laatste_bericht: null,
            oordeel: { status: "laat", stilMinuten: 180, drempel: 25 },
          },
        ],
      }),
    );
    toonTab();

    const badge = await screen.findByText("te lang stil");
    expect(badge).toHaveClass("badge--loss");
    expect(screen.getByText(/hoort elke 25 min iets te doen/)).toBeInTheDocument();
    expect(screen.getByText(/3 uur geleden/)).toBeInTheDocument();
  });

  it("noemt een uitgezette job niet rood", async () => {
    (systeemStatus as Mock).mockResolvedValue(
      status({
        cron: [
          {
            jobname: "snapshot-availability-week",
            schedule: "2 * * * *",
            actief: false,
            laatste_start: null,
            laatste_einde: null,
            laatste_status: null,
            laatste_bericht: null,
            oordeel: { status: "uit", stilMinuten: null, drempel: null },
          },
        ],
      }),
    );
    toonTab();

    const badge = await screen.findByText("uitgezet");
    expect(badge).not.toHaveClass("badge--loss");
  });

  // Het open punt uit het issue: lokaal draait er geen pg_cron. Het tabblad
  // moet dat netjes tonen in plaats van te ontploffen.
  it("verdraagt een databank zonder pg_cron", async () => {
    (systeemStatus as Mock).mockResolvedValue(status({ cron: null }));
    toonTab();

    expect(await screen.findByText(/Geen/)).toBeInTheDocument();
    expect(screen.getByText(/normaal buiten het gehoste project/)).toBeInTheDocument();
    // De rest van het scherm hoort er gewoon te staan.
    expect(screen.getByText("743")).toBeInTheDocument();
  });

  it("waarschuwt als pg_cron draait maar er niets gepland staat", async () => {
    (systeemStatus as Mock).mockResolvedValue(status({ cron: [] }));
    toonTab();

    expect(
      await screen.findByText(/geen enkele job gepland/),
    ).toBeInTheDocument();
  });

  it("toont per function of zijn vereiste sleutels gezet zijn", async () => {
    const s = status();
    s.functies = [
      {
        naam: "generate-pias-avatar",
        rol: "AI-portret",
        verifyJwt: false,
        cronGeheim: true,
        ontbrekend: ["OPENAI_API_KEY"],
      },
      {
        naam: "admin-users",
        rol: "Accountbeheer",
        verifyJwt: true,
        cronGeheim: false,
        ontbrekend: [],
      },
    ];
    (systeemStatus as Mock).mockResolvedValue(s);
    toonTab();

    expect(await screen.findByText(/mist OPENAI_API_KEY/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 function mist een vereiste sleutel/),
    ).toBeInTheDocument();
    expect(screen.getByText("compleet")).toBeInTheDocument();
    // De JWT-gate hoort zichtbaar te zijn: dát was de fout bij appeal-deadline.
    expect(screen.getByText(/uit · eigen geheim/)).toBeInTheDocument();
    expect(screen.getByText("aan")).toBeInTheDocument();
  });

  it("toont de laatste migratie en de rijtellingen", async () => {
    (systeemStatus as Mock).mockResolvedValue(status());
    toonTab();

    expect(
      await screen.findByText("20260808120000 1049_systeem_status"),
    ).toBeInTheDocument();
    expect(screen.getByText("matches")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument(); // push-abonnementen
  });
});
