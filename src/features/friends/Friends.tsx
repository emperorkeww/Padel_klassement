import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
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
import type { Profile } from "../../lib/types";

export function Friends() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const friendships = useAsync(getMyFriendships, []);
  const profiles = useAsync(getProfilesMap, []);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  const pmap = profiles.data ?? {};
  const { accepted, incoming, outgoing } = categorize(friendships.data ?? [], myId);

  // ids die al een relatie hebben (om dubbele verzoeken te voorkomen in de zoekresultaten)
  const relatedIds = new Set(
    (friendships.data ?? []).flatMap((f) => [f.requester_id, f.addressee_id]),
  );

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setMsg(null);
    try {
      setResults(await searchProfiles(query, myId));
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
    } finally {
      setSearching(false);
    }
  }

  async function act(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ type: "success", text: ok });
      friendships.reload();
      setResults((r) => r.filter(Boolean)); // laat resultaten staan; relatedIds herberekent
    } catch (err) {
      setMsg({ type: "error", text: errMsg(err) });
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

      {msg && <p className={`msg msg--${msg.type}`}>{msg.text}</p>}

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

          <div className="stack" style={{ marginTop: "1rem" }}>
            {results.length === 0 && <p className="empty">Geen resultaten.</p>}
            {results.map((p) => {
              const already = relatedIds.has(p.id);
              return (
                <div key={p.id} className="row-between">
                  <span>
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
                <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                  {displayName(pmap[otherId(f, myId)])}
                </Link>
                <span style={{ display: "flex", gap: "0.4rem" }}>
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
              <h2 className="card__title" style={{ marginTop: "1.25rem" }}>
                Verzonden verzoeken
              </h2>
              <div className="stack">
                {outgoing.map((f) => (
                  <div key={f.id} className="row-between">
                    <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                  {displayName(pmap[otherId(f, myId)])}
                </Link>
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
          {friendships.loading && <p className="empty">Laden…</p>}
          {!friendships.loading && accepted.length === 0 && (
            <p className="empty">Nog geen vrienden. Zoek hierboven een speler.</p>
          )}
          {accepted.map((f) => (
            <div key={f.id} className="row-between">
              <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                  {displayName(pmap[otherId(f, myId)])}
                </Link>
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
