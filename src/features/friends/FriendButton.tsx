import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { errorMessage } from "../../lib/errors";
import {
  getMyFriendships,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
} from "./api";

/** Vriendschapsactie op een profielpagina (#282): toont de relatie t.o.v. de
 *  bekeken speler en de juiste vervolgstap — verzoek sturen, in afwachting,
 *  binnengekomen verzoek accepteren, of al bevriend. Zelfstandig: laadt de
 *  eigen vriendschappen en ververst realtime, net als de Vrienden-pagina.
 *
 *  Rendert niets op het eigen profiel of zolang de relatie nog onbekend is. */
export function FriendButton({ targetId }: { targetId: string }) {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const toast = useToast();
  const friendships = useAsync(getMyFriendships, []);
  useRealtime("friendships", friendships.reload);
  const [busy, setBusy] = useState(false);

  if (!myId || myId === targetId) return null;
  if (friendships.loading || friendships.data == null) return null;

  const rel = friendships.data.find(
    (f) =>
      (f.requester_id === myId && f.addressee_id === targetId) ||
      (f.requester_id === targetId && f.addressee_id === myId),
  );

  async function act(fn: () => Promise<void>, msg: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      friendships.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Al vrienden: statische bevestiging, geen actie.
  if (rel?.status === "accepted") {
    return (
      <span className="friend-btn friend-btn--done" aria-label="Jullie zijn vrienden">
        Vrienden ✓
      </span>
    );
  }

  // Ik heb een verzoek uitstaan: tonen als in afwachting, met de optie het
  // weer in te trekken.
  if (rel?.status === "pending" && rel.requester_id === myId) {
    return (
      <button
        type="button"
        className="btn btn--sm friend-btn friend-btn--withdraw"
        disabled={busy}
        aria-label="Verzoek intrekken"
        onClick={() =>
          act(() => removeFriendship(rel.id), "Verzoek ingetrokken.")
        }
      >
        {busy ? "Bezig…" : "Verzoek verzonden · intrekken"}
      </button>
    );
  }

  // Er ligt een verzoek van deze speler op mij: accepteren.
  if (rel?.status === "pending" && rel.addressee_id === myId) {
    return (
      <button
        type="button"
        className="btn btn--primary btn--sm friend-btn"
        disabled={busy}
        onClick={() =>
          act(() => respondToRequest(rel.id, "accepted"), "Verzoek geaccepteerd.")
        }
      >
        {busy ? "Bezig…" : "Verzoek accepteren"}
      </button>
    );
  }

  // Geen (actieve) relatie: verzoek sturen.
  return (
    <button
      type="button"
      className="btn btn--primary btn--sm friend-btn"
      disabled={busy}
      onClick={() =>
        act(() => sendFriendRequest(myId, targetId), "Verzoek verstuurd.")
      }
    >
      {busy ? "Bezig…" : "Verzoek sturen"}
    </button>
  );
}

export default FriendButton;
