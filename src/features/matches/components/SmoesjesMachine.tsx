// Smoesjesmachine (#167): op een verloren match één tik → een ludiek excuus,
// deelbaar met de vriendengroep. De keuze is deterministisch geseed op het
// match-id + een worp-teller, zodat "opnieuw" een vers smoesje trekt maar de
// getoonde smoes stabiel blijft binnen één weergave.
//
// Onder Coach Rudy's stem (#296): het excuus verschijnt in zijn speech-bubbel
// (avatar + naam) en Rudy velt als juryvoorzitter een deterministisch oordeel
// (❌/⚠️/✅). Op een groepsmatch kun je je smoes bovendien vastzetten ("Plaats op
// de feed"): één per match, vervangbaar, zichtbaar voor de groep. Bij roast-
// schild een neutrale toon.

import { useState } from "react";
import { useToast } from "@/ui/ToastProvider";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import { useAsync } from "@/lib/hooks/useAsync";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { shareOrCopyText } from "@/lib/utils/shareText";
import { hashString, kiesSmoes, kiesOordeel } from "@/features/matches/excuses";
import { COMMENTATOR, type RoastCtx } from "@/features/coach/roastTone";
import {
  getMatchSmoesjes,
  placeSmoes,
  removeSmoes,
} from "@/features/matches/smoesjesApi";
import "./SmoesjesMachine.css";

export function SmoesjesMachine({
  matchId,
  ctx,
  groupId = null,
  playerId,
}: {
  matchId: string;
  /** Roast-context van de kijker (toon + schild); stuurt Rudy's mood en oordeel. */
  ctx: RoastCtx;
  /** Groep van de match; alleen dán kan de smoes op de feed geplaatst worden. */
  groupId?: string | null;
  /** De kijker (verliezer). Nodig om te plaatsen en de eigen smoes te herkennen. */
  playerId?: string;
}) {
  const toast = useToast();
  const [worp, setWorp] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Plaatsen kan alleen op een groepsmatch en met een bekende speler.
  const kanPlaatsen = !!groupId && !!playerId;
  // De reeds geplaatste smoes van deze speler (voor de "geplaatst"-status).
  const geplaatstQuery = useAsync(
    () =>
      kanPlaatsen ? getMatchSmoesjes(matchId) : Promise.resolve([]),
    [matchId, groupId, playerId, kanPlaatsen],
  );
  const geplaatst =
    (geplaatstQuery.data ?? []).find((s) => s.player_id === playerId)?.smoes ??
    null;

  const seed = hashString(matchId) + (worp ?? 0);
  // Bij openen tonen we de al geplaatste smoes; "nog een smoesje" bladert verder.
  const huidig = worp === null ? geplaatst : kiesSmoes(seed);
  const oordeel = huidig ? kiesOordeel(huidig, ctx.schild) : null;
  // Rudy's illustratie volgt de groepstoon; met schild blijft hij neutraal.
  const mood = ctx.schild ? "portret" : ctx.intensiteit;

  const isGeplaatst = !!huidig && huidig === geplaatst;

  function trek() {
    tap();
    setWorp((w) => (w === null ? 0 : w + 1));
  }

  async function plaats() {
    if (!huidig || !groupId || !playerId) return;
    setBusy(true);
    try {
      await placeSmoes({ matchId, groupId, playerId, smoes: huidig });
      toast.success("Op de feed geplaatst — de groep ziet je smoes. 🙈");
      geplaatstQuery.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function haalWeg() {
    if (!playerId) return;
    setBusy(true);
    try {
      await removeSmoes(matchId, playerId);
      toast.success("Smoes van de feed gehaald.");
      geplaatstQuery.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deel() {
    if (!huidig) return;
    try {
      const oordeelDeel = oordeel ? `\n${COMMENTATOR.naam}: ${oordeel.tekst}` : "";
      const outcome = await shareOrCopyText({
        title: "Mijn smoesje 🎾",
        text: `Waarom ik verloor: “${huidig}”${oordeelDeel}`,
      });
      if (outcome === "clipboard") toast.success("Smoesje gekopieerd naar klembord.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(errorMessage(err));
    }
  }

  return (
    <section className="card smoesjes">
      <div className="card__head">
        <h2 className="card__title">🙈 Smoesjesmachine</h2>
        {huidig && (
          <button className="btn btn--sm" onClick={deel}>
            ↗ Deel
          </button>
        )}
      </div>

      {huidig && oordeel ? (
        <CoachBubble mood={mood}>
          <span className="coach-sneer__text smoesjes__quote">“{huidig}”</span>
          <span className={`smoesjes__oordeel smoesjes__oordeel--${oordeel.gradatie}`}>
            {oordeel.tekst}
          </span>
        </CoachBubble>
      ) : (
        <p className="smoesjes__hint">
          Verloren? Geen paniek — met de Smoesjesmachine is er altijd een waterdichte verklaring voor je nederlaag. Bedenk er direct eentje!
        </p>
      )}

      <div className="smoesjes__acties">
        <button
          className="btn btn--sm smoesjes__trek"
          onClick={trek}
          disabled={busy}
        >
          {huidig ? "Nog een smoesje" : "Geef me een smoesje"}
        </button>
        {kanPlaatsen && huidig && (
          isGeplaatst ? (
            <span className="smoesjes__status">
              ✓ Op de feed
              <button className="smoesjes__weg" onClick={haalWeg} disabled={busy}>
                Weghalen
              </button>
            </span>
          ) : (
            <button
              className="btn btn--sm btn--primary"
              onClick={plaats}
              disabled={busy}
            >
              {geplaatst ? "Vervang op feed ↗" : "Plaats op de feed ↗"}
            </button>
          )
        )}
      </div>
    </section>
  );
}

export default SmoesjesMachine;
