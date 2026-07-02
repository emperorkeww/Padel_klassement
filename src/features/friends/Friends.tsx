import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import {
  getMyFriendships,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
  categorize,
  otherId,
} from "./api";
import {
  getProfilesMap,
  searchProfiles,
  displayName,
} from "../profiles/api";
import { Avatar } from "../../components/Avatar";
import type { Profile } from "../../lib/types";

export function Friends() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const friendships = useAsync(getMyFriendships, []);
  const profiles = useAsync(getProfilesMap, []);
  useRealtime("friendships", friendships.reload);

  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const pmap = profiles.data ?? {};
  const { accepted, incoming, outgoing } = categorize(friendships.data ?? [], myId);

  // ids die al een relatie hebben (om dubbele verzoeken te voorkomen in de zoekresultaten)
  const relatedIds = new Set(
    (friendships.data ?? []).flatMap((f) => [f.requester_id, f.addressee_id]),
  );

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      setResults(await searchProfiles(query, myId));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSearching(false);
    }
  }

  async function act(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      friendships.reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Vrienden</h1>
        <p className="page-subtitle">
          Zoek spelers, stuur verzoeken en beheer je vrienden.
        </p>
      </header>

      <div className="grid grid--2">
        <section className="card">
          <h2 className="card__title">Speler zoeken</h2>
          <form className="row-between" onSubmit={runSearch}>
            <input
              className="input"
              placeholder="Zoek op gebruikersnaam…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn--primary" disabled={searching}>
              {searching ? "Zoeken…" : "Zoek"}
            </button>
          </form>

          <div className="stack mt-4">
            {results.length === 0 && <p className="empty">Geen resultaten.</p>}
            {results.map((p) => {
              const already = relatedIds.has(p.id);
              return (
                <div key={p.id} className="row-between">
                  <span className="cell-player">
                    <Avatar profile={p} size={28} />
                    {displayName(p)}{" "}
                    <span className="badge">@{p.username}</span>
                  </span>
                  <button
                    className="btn btn--sm"
                    disabled={already}
                    onClick={() =>
                      act(
                        () => sendFriendRequest(myId, p.id),
                        "Verzoek verstuurd.",
                      )
                    }
                  >
                    {already ? "Al gekoppeld" : "Verzoek sturen"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">
            Inkomende verzoeken{" "}
            {incoming.length > 0 && (
              <span className="badge badge--accent">{incoming.length}</span>
            )}
          </h2>
          <div className="stack">
            {incoming.length === 0 && <p className="empty">Geen openstaande verzoeken.</p>}
            {incoming.map((f) => (
              <div key={f.id} className="row-between">
                <span className="cell-player">
                  <Avatar profile={pmap[otherId(f, myId)]} size={28} />
                  <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                    {displayName(pmap[otherId(f, myId)])}
                  </Link>
                </span>
                <span className="btn-row">
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() =>
                      act(() => respondToRequest(f.id, "accepted"), "Geaccepteerd.")
                    }
                  >
                    Accepteer
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={() =>
                      act(() => respondToRequest(f.id, "declined"), "Geweigerd.")
                    }
                  >
                    Weiger
                  </button>
                </span>
              </div>
            ))}
          </div>

          {outgoing.length > 0 && (
            <>
              <h2 className="card__title card__title--section">Verzonden verzoeken</h2>
              <div className="stack">
                {outgoing.map((f) => (
                  <div key={f.id} className="row-between">
                    <span className="cell-player">
                      <Avatar profile={pmap[otherId(f, myId)]} size={28} />
                      <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                        {displayName(pmap[otherId(f, myId)])}
                      </Link>
                    </span>
                    <span className="badge">In afwachting</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="card__title">Mijn vrienden</h2>
        <div className="stack">
          {friendships.loading && <Skeleton rows={3} />}
          {!friendships.loading && accepted.length === 0 && (
            <p className="empty">Nog geen vrienden. Zoek hierboven een speler.</p>
          )}
          {accepted.map((f) => (
            <div key={f.id} className="row-between">
              <span className="cell-player">
                <Avatar profile={pmap[otherId(f, myId)]} size={28} />
                <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                  {displayName(pmap[otherId(f, myId)])}
                </Link>
              </span>
              <button
                className="btn btn--danger btn--sm"
                onClick={() => act(() => removeFriendship(f.id), "Verwijderd.")}
              >
                Verwijderen
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function errMsg(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m.includes("friendships_unique_pair") || m.includes("duplicate"))
    return "Er bestaat al een relatie met deze speler.";
  return m;
}

export default Friends;
