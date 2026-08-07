import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { useConfirm } from "@/ui/ConfirmDialog";
import { errorMessage } from "@/lib/utils/errors";
import { tap } from "@/lib/utils/haptics";
import { replaceMatchPlayer } from "@/features/matches/api";
import { getGroupMembers } from "@/features/groups/api";
import { categorize, getMyFriendships, otherId } from "@/features/friends/api";
import { displayName, getProfilesByIds } from "@/features/profiles/api";
import type { Match, Profile } from "@/types";

/**
 * Gast vervangen (#681): één gastprofiel wordt in de praktijk soms voor
 * verschillende personen hergebruikt ("Gast 1"), en soms blijkt achteraf dat de
 * gast een speler mét account was. Hier corrigeer je per match wie er écht
 * speelde. Zichtbaar voor wie de match aanmaakte of de groep bezit — dezelfde
 * kring die replace_match_player afdwingt.
 *
 * De parent rendert dit alleen bij een afgeronde match mét gast, zodat een
 * gewone match niet voor de queries hieronder betaalt.
 *
 * Uitgesneden uit MatchDetail in #1144, gedrag ongewijzigd.
 */
export function GuestSwapSection({
  match: m,
  guestIds,
  matchPlayerIds,
  profiles,
  myId,
  onSaved,
}: {
  match: Match;
  guestIds: string[];
  matchPlayerIds: string[];
  profiles: Record<string, Profile>;
  myId: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [gastId, setGastId] = useState(guestIds.length === 1 ? guestIds[0] : "");
  const [naarId, setNaarId] = useState("");
  const [busy, setBusy] = useState(false);

  const members = useAsync(
    () => (m.group_id ? getGroupMembers(m.group_id) : Promise.resolve([])),
    [m.group_id],
  );
  const friendships = useAsync(getMyFriendships, []);

  // Kandidaten: groepsgenoten en vrienden die nog niet meespelen. Zelfde
  // populatie als _can_add_player, dus de UI biedt niets aan wat de RPC weigert.
  const kandidaatIds = [
    ...(members.data ?? []).map((x) => x.player_id),
    ...categorize(friendships.data ?? [], myId).accepted.map((f) =>
      otherId(f, myId),
    ),
    myId,
  ].filter(
    (pid, i, all) => all.indexOf(pid) === i && !matchPlayerIds.includes(pid),
  );
  const kandidaatKey = kandidaatIds.slice().sort().join(",");
  const kandidaatProfielen = useAsync(
    () => getProfilesByIds(kandidaatIds),
    [kandidaatKey],
  );

  const kmap = kandidaatProfielen.data ?? {};
  // Gasten van iemand anders vallen af: die zou de RPC toch weigeren.
  const kandidaten = kandidaatIds
    .filter(
      (pid) => kmap[pid] && (!kmap[pid].is_guest || kmap[pid].owner_id === myId),
    )
    .sort((a, b) => displayName(kmap[a]).localeCompare(displayName(kmap[b])));

  const magWijzigen =
    m.created_by === myId ||
    (members.data ?? []).some((x) => x.player_id === myId && x.role === "owner");
  if (!magWijzigen) return null;

  async function vervang() {
    if (!gastId || !naarId) return;
    if (
      !(await confirm({
        title: "Gast vervangen?",
        body: `${displayName(profiles[gastId])} wordt in deze match vervangen door ${displayName(kmap[naarId])}. De match komt op diens naam te staan en alle ratings worden opnieuw berekend. Dit kan niet ongedaan worden gemaakt.`,
        confirmLabel: "Vervangen",
      }))
    )
      return;
    setBusy(true);
    try {
      await replaceMatchPlayer(m.id, gastId, naarId);
      tap();
      toast.success("Deelnemer vervangen.");
      setNaarId("");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <p className="card__subtitle">
        Speelde er iemand anders onder deze gastnaam? Zet de match op de juiste
        speler; de ratings worden daarna opnieuw berekend.
      </p>
      <div className="stack">
        {guestIds.length > 1 && (
          <div className="row-between">
            <span>Gast</span>
            <select
              className="select"
              aria-label="Welke gast"
              disabled={busy}
              value={gastId}
              onChange={(e) => setGastId(e.target.value)}
            >
              <option value="">Kies een gast…</option>
              {guestIds.map((pid) => (
                <option key={pid} value={pid}>
                  {displayName(profiles[pid])}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row-between">
          <span>
            {guestIds.length > 1
              ? "Vervangen door"
              : `${displayName(profiles[gastId])} was eigenlijk`}
          </span>
          <select
            className="select"
            aria-label="Vervangen door"
            disabled={busy || kandidaatProfielen.loading}
            value={naarId}
            onChange={(e) => setNaarId(e.target.value)}
          >
            <option value="">Kies een speler…</option>
            {kandidaten.map((pid) => (
              <option key={pid} value={pid}>
                {displayName(kmap[pid])}
              </option>
            ))}
          </select>
        </div>
        {!kandidaatProfielen.loading && kandidaten.length === 0 && (
          <p className="field-hint">
            Geen spelers om uit te kiezen. Voeg de speler eerst toe als vriend of
            als lid van de groep.
          </p>
        )}
        <div className="form-actions">
          <button
            className="btn btn--sm"
            disabled={busy || !gastId || !naarId}
            onClick={() => void vervang()}
          >
            {busy ? "Bezig…" : "Vervang deelnemer"}
          </button>
        </div>
      </div>
      {confirmUi}
    </section>
  );
}

export default GuestSwapSection;
