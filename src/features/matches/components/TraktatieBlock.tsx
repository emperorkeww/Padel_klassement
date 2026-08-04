import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { celebrate } from "@/lib/utils/confetti";
import { tap } from "@/lib/utils/haptics";
import { displayName } from "@/features/profiles/api";
import { setMatchWager, settleMatchWager } from "@/features/matches/api";
import { DrankPicker } from "@/features/matches/components/DrankPicker";
import {
  drankIcon,
  traktatieOpen,
  traktatieTekst,
} from "@/features/matches/drankkaart";
import type { Match, Profile } from "@/types";
import "./TraktatieBlock.css";

/**
 * Drankje-inzet (#1004): waar de verliezers de winnaars op trakteren.
 *
 * Eén blok dat de hele levensloop draagt, want het is één afspraak:
 *   * gepland  → de inzet kiezen of wijzigen (tot de aftrap);
 *   * afgerond → "Traktatie ingelost 🍻" afvinken aan de bar;
 *   * gelijkspel → de inzet vervalt, en dat zeggen we ook.
 *
 * Wijzigen is nodig náást de keuze in de wizard: gegenereerde rondes
 * (americano, mexicano, fair round) komen daar nooit langs, en zonder dit blok
 * zou op een speeldag nergens om gespeeld kunnen worden.
 *
 * `magBeheren` spiegelt _can_manage_wager in de databank (spelers, aanmaker,
 * groepseigenaar); de RPC blijft de echte poort.
 */
export function TraktatieBlock({
  match: m,
  profiles,
  magBeheren,
  onSaved,
}: {
  match: Match;
  profiles: Record<string, Profile>;
  magBeheren: boolean;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [drank, setDrank] = useState<string | null>(m.wager_drink ?? null);
  const [aantal, setAantal] = useState(m.wager_drink_qty ?? 1);

  const done = m.status === "completed";
  const gestart =
    m.status !== "scheduled" ||
    (m.played_at != null && new Date(m.played_at).getTime() <= Date.now());
  const gelijkspel = done && m.winner_team_id == null;
  const ingelost = !!m.wager_settled_at;
  const magKiezen = magBeheren && !gestart;

  // Niets afgesproken en niets af te spreken: dan hoort hier geen blok te staan.
  if (!m.wager_drink && !magKiezen) return null;

  const tekst = traktatieTekst(m.wager_drink, m.wager_drink_qty);
  const icoon = m.wager_drink ? drankIcon(m.wager_drink) : "🍻";
  const inlosser = m.wager_settled_by ? profiles[m.wager_settled_by] : undefined;

  async function bewaar() {
    if (busy) return;
    setBusy(true);
    try {
      await setMatchWager({ matchId: m.id, drink: drank, qty: aantal });
      tap();
      toast.success(
        drank
          ? `Afgesproken: ${traktatieTekst(drank, aantal)}.`
          : "Inzet eraf — jullie spelen voor de eer.",
      );
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function los(settled: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await settleMatchWager({ matchId: m.id, settled });
      if (settled) {
        celebrate();
        toast.success("Proost! De traktatie staat genoteerd als ingelost.");
      } else {
        tap();
        toast.success("Terug op de rekening: er staat nog wat open.");
      }
      onSaved?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="traktatie" aria-label="Drankje-inzet">
      <header className="traktatie__head">
        <span className="traktatie__name">
          <span aria-hidden="true">{icoon}</span> Inzet
        </span>
        <span className="traktatie__stat">
          {m.wager_drink ? tekst : "nog niets afgesproken"}
        </span>
      </header>

      {gelijkspel && m.wager_drink && (
        <p className="traktatie__uitkomst">
          Gelijkspel — de inzet vervalt. Iedereen betaalt zijn eigen glas.
        </p>
      )}

      {ingelost && (
        <p className="traktatie__uitkomst traktatie__uitkomst--ok">
          🍻 Ingelost
          {inlosser ? ` — afgevinkt door ${displayName(inlosser)}` : ""}.
        </p>
      )}

      {/* De knop uit de acceptatiecriteria: na de pot aan de bar afvinken. */}
      {magBeheren && traktatieOpen(m) && (
        <button
          type="button"
          className="traktatie__knop traktatie__knop--vol"
          disabled={busy}
          onClick={() => los(true)}
        >
          Traktatie ingelost 🍻
        </button>
      )}
      {magBeheren && done && ingelost && (
        <button
          type="button"
          className="traktatie__knop"
          disabled={busy}
          onClick={() => los(false)}
        >
          Toch nog niet betaald
        </button>
      )}

      {magKiezen && !open && (
        <button
          type="button"
          className="traktatie__knop"
          disabled={busy}
          onClick={() => {
            setDrank(m.wager_drink ?? null);
            setAantal(m.wager_drink_qty ?? 1);
            setOpen(true);
          }}
        >
          {m.wager_drink ? "Inzet wijzigen" : "Zet er een drankje op"}
        </button>
      )}

      {magKiezen && open && (
        <>
          <DrankPicker
            value={drank}
            aantal={aantal}
            onChange={setDrank}
            onAantalChange={setAantal}
            disabled={busy}
          />
          <div className="traktatie__acties">
            <button
              type="button"
              className="traktatie__knop traktatie__knop--vol"
              disabled={busy}
              onClick={bewaar}
            >
              {busy ? "Bewaren…" : "Inzet bewaren"}
            </button>
            <button
              type="button"
              className="traktatie__knop"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Annuleren
            </button>
          </div>
        </>
      )}

      <p className="traktatie__foot">
        {gestart
          ? "De inzet ligt vast zodra de match begonnen is."
          : "De verliezers trakteren de winnaars. Tot de aftrap kun je de afspraak nog wijzigen."}
      </p>
    </section>
  );
}

export default TraktatieBlock;
