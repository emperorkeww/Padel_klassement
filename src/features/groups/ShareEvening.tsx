import { useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import { canvasPalette, sharePng, wrapCentered } from "../../lib/shareImage";
import { eveningSummary, type EveningSummary } from "../../lib/eveningSummary";
import { displayName } from "../profiles/api";
import { teamLabel } from "../matches/api";
import type { Match, Profile, Team } from "../../lib/types";

// Deelbare poster (4:5) met de samenvatting van vanavond: avondstand-top-3,
// alle uitslagen en het beste duo. Verschijnt zodra er vandaag minstens één
// afgeronde match in de groep is.

const W = 1080;
const H = 1350;

function draw(
  ctx: CanvasRenderingContext2D,
  groupName: string,
  summary: EveningSummary,
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
) {
  const c = canvasPalette();
  const nameOf = (playerId: string) => displayName(profiles[playerId]);

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createRadialGradient(W, 0, 0, W, 0, W);
  grad.addColorStop(0, c.accentSoft);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Kop: merk, groep en datum.
  ctx.fillStyle = c.accent;
  ctx.font = "800 60px Outfit, system-ui, sans-serif";
  ctx.fillText("Vamos!", W / 2, 110);
  ctx.fillStyle = c.ink;
  ctx.font = "800 46px Outfit, system-ui, sans-serif";
  wrapCentered(ctx, groupName, W / 2, 185, W - 140, 52);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "600 28px Outfit, system-ui, sans-serif";
  ctx.fillText(
    new Date().toLocaleDateString("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    W / 2,
    245,
  );

  // Avondstand: top 3 met medaillekleuren, daarna compact de rest.
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 26px Outfit, system-ui, sans-serif";
  ctx.fillText("AVONDSTAND", W / 2, 330);
  const medal = [c.gold, "#8c98a4", "#b0722d"];
  let y = 395;
  summary.rows.slice(0, 3).forEach((row, i) => {
    ctx.fillStyle = medal[i];
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    ctx.fillText(
      `${i + 1}. ${nameOf(row.playerId)} — ${row.points} ptn`,
      W / 2,
      y,
    );
    y += 58;
  });
  ctx.fillStyle = c.inkSoft;
  ctx.font = "600 28px Outfit, system-ui, sans-serif";
  for (const row of summary.rows.slice(3, 8)) {
    ctx.fillText(`${nameOf(row.playerId)} — ${row.points} ptn`, W / 2, y);
    y += 42;
  }

  // Onderste blok (beste duo + accentstreep) staat vast; de uitslagenlijst mag
  // daar nooit overheen lopen. maxContentY is de harde ondergrens voor de tekst,
  // met wat lucht boven het beste-duo-blok.
  const bestDuoY = H - 120;
  const maxContentY = bestDuoY - 70;
  const lineH = 44;

  // Uitslagen van de avond.
  y = Math.max(y + 40, 700);
  ctx.fillStyle = c.inkSoft;
  ctx.font = "700 26px Outfit, system-ui, sans-serif";
  ctx.fillText("UITSLAGEN", W / 2, y);
  y += 52;
  let shownCount = 0;
  for (const m of summary.matches) {
    // Reserveer altijd één regel: als er meer volgt, past "+ N meer" er nog.
    if (y > maxContentY - lineH) break;
    ctx.fillStyle = c.ink;
    ctx.font = "600 27px Outfit, system-ui, sans-serif";
    const line = `${teamLabel(teams[m.team_a_id], profiles)}  ${m.score_a ?? "–"}–${m.score_b ?? "–"}  ${teamLabel(teams[m.team_b_id], profiles)}`;
    ctx.fillText(line, W / 2, y, W - 120);
    y += lineH;
    shownCount += 1;
  }
  const restCount = summary.matches.length - shownCount;
  if (restCount > 0) {
    ctx.fillStyle = c.inkSoft;
    ctx.font = "600 24px Outfit, system-ui, sans-serif";
    ctx.fillText(`+ ${restCount} meer`, W / 2, y);
  }

  // Beste duo van de avond — vaste plek onderaan, boven de accentstreep.
  if (summary.bestDuo) {
    ctx.fillStyle = c.success;
    ctx.font = "700 32px Outfit, system-ui, sans-serif";
    const duo = teamLabel(teams[summary.bestDuo.teamId], profiles);
    ctx.fillText(
      `🏆 Beste duo: ${duo} (${summary.bestDuo.won} winst${summary.bestDuo.won === 1 ? "" : "en"})`,
      W / 2,
      bestDuoY,
      W - 120,
    );
  }

  // Lime accentstreep onderaan.
  ctx.fillStyle = c.lime;
  ctx.fillRect(W / 2 - 80, H - 70, 160, 10);
}

export function ShareEvening({
  groupName,
  matches,
  teams,
  profiles,
}: {
  groupName: string;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(
    () => eveningSummary(matches, teams, today),
    [matches, teams, today],
  );

  if (summary.matches.length === 0) return null;

  async function share() {
    setBusy(true);
    try {
      const outcome = await sharePng(
        (ctx) => draw(ctx, groupName, summary, teams, profiles),
        { width: W, height: H, filename: "vamos-avond.png", title: "Vamos! avond" },
      );
      if (outcome === "clipboard")
        toast.success("Poster gekopieerd naar klembord.");
      if (outcome === "download") toast.success("Poster gedownload.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn btn--sm" onClick={share} disabled={busy}>
      {busy ? "Bezig…" : "↗ Deel avond-samenvatting"}
    </button>
  );
}

export default ShareEvening;
