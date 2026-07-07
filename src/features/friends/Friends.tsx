import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useRealtime } from "../../lib/useRealtime";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import {
  getMyFriendships,
  getFriendSuggestions,
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
import { AccountNav } from "../../components/AccountNav";
import { EmptyState } from "../../components/EmptyState";
import type { Profile } from "../../lib/types";

export function Friends() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const friendships = useAsync(getMyFriendships, []);
  const profiles = useAsync(getProfilesMap, []);
  const suggestions = useAsync(getFriendSuggestions, []);
  useRealtime("friendships", () => {
    friendships.reload();
    suggestions.reload();
  });

  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  // Puur voor de lege-status: "nog niet gezocht" ≠ "geen resultaten".
  const [searched, setSearched] = useState(false);
  // Welke suggesties hun gemeenschappelijke-vrienden-lijst uitgeklapt hebben.
  const [openMutual, setOpenMutual] = useState<Set<string>>(new Set());

  const pmap = profiles.data ?? {};
  const { accepted, incoming, outgoing } = categorize(friendships.data ?? [], myId);

  // Klap de lijst met gemeenschappelijke vrienden van één suggestie open/dicht.
  function toggleMutual(id: string) {
    setOpenMutual((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Namen van de gemeenschappelijke vrienden (voor de uitgeklapte lijst).
  function mutualNames(ids: string[]): string {
    return ids
      .map((id) => displayName(pmap[id]))
      .filter(Boolean)
      .join(", ");
  }

  // ids die al een relatie hebben (om dubbele verzoeken te voorkomen in de zoekresultaten)
  const relatedIds = new Set(
    (friendships.data ?? []).flatMap((f) => [f.requester_id, f.addressee_id]),
  );

  // Suggesties waarvan we het profiel kennen en die nog geen relatie hebben.
  const visibleSuggestions = (suggestions.data ?? []).filter(
    (s) => !relatedIds.has(s.id) && pmap[s.id],
  );

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      setResults(await searchProfiles(query, myId));
      setSearched(true);
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
      suggestions.reload();
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

      <AccountNav />

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

          <div className="person-list mt-4">
            {results.length === 0 && (
              <p className="empty">
                {searched
                  ? `Geen spelers gevonden voor “${query.trim()}”.`
                  : "Zoek op gebruikersnaam om spelers te vinden."}
              </p>
            )}
            {results.map((p) => {
              const already = relatedIds.has(p.id);
              return (
                <div key={p.id} className="person-row">
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
          <div className="person-list">
            {friendships.loading && <Skeleton rows={2} />}
            {!friendships.loading && incoming.length === 0 && (
              <p className="empty">Geen openstaande verzoeken.</p>
            )}
            {incoming.map((f) => (
              <div key={f.id} className="person-row person-row--attn">
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
              <div className="person-list">
                {outgoing.map((f) => (
                  <div key={f.id} className="person-row">
                    <span className="cell-player">
                      <Avatar profile={pmap[otherId(f, myId)]} size={28} />
                      <Link className="profile-link" to={`/spelers/${otherId(f, myId)}`}>
                        {displayName(pmap[otherId(f, myId)])}
                      </Link>
                    </span>
                    <span className="btn-row">
                      <span className="badge">In afwachting</span>
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() =>
                          act(() => removeFriendship(f.id), "Verzoek ingetrokken.")
                        }
                      >
                        Intrekken
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="card__title">Misschien ken je</h2>
        {suggestions.loading && <Skeleton rows={3} />}
        {!suggestions.loading && visibleSuggestions.length === 0 && (
          <p className="empty">
            Nog geen suggesties — voeg vrienden toe en we stellen op basis van
            gemeenschappelijke vrienden nieuwe spelers voor.
          </p>
        )}
        <div className="suggest-grid">
          {visibleSuggestions.map((s) => {
            const p = pmap[s.id];
            const open = openMutual.has(s.id);
            return (
              <div key={s.id} className="suggest-card">
                <Link className="suggest-card__id" to={`/spelers/${s.id}`}>
                  <Avatar profile={p} size={56} />
                  <span className="suggest-card__name">{displayName(p)}</span>
                  <span className="badge">@{p.username}</span>
                </Link>

                {s.mutual_count > 0 ? (
                  <button
                    type="button"
                    className="mutual-toggle"
                    aria-expanded={open}
                    onClick={() => toggleMutual(s.id)}
                  >
                    {s.mutual_ids.length > 0 && (
                      <span className="mutual-avatars" aria-hidden="true">
                        {s.mutual_ids.slice(0, 3).map((mid) => (
                          <Avatar key={mid} profile={pmap[mid]} size={20} />
                        ))}
                      </span>
                    )}
                    {s.mutual_count} gemeenschappelijke vriend
                    {s.mutual_count === 1 ? "" : "en"}
                    <span className="mutual-caret" aria-hidden="true">
                      {open ? "▲" : "▼"}
                    </span>
                  </button>
                ) : (
                  <span className="person-sub">Voorgesteld voor jou</span>
                )}
                {open && s.mutual_count > 0 && (
                  <span className="suggest-card__mutuals">
                    {mutualNames(s.mutual_ids)}
                  </span>
                )}

                <button
                  className="btn btn--sm btn--primary suggest-card__cta"
                  onClick={() =>
                    act(() => sendFriendRequest(myId, s.id), "Verzoek verstuurd.")
                  }
                >
                  Verzoek sturen
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Mijn vrienden</h2>
        {!friendships.loading && accepted.length === 0 && (
          <EmptyState icon="👋" title="Nog geen vrienden.">
            Zoek hierboven een speler op gebruikersnaam en stuur een verzoek —
            samen matches loggen begint hier.
          </EmptyState>
        )}
        <div className="person-grid">
          {friendships.loading && <Skeleton rows={3} />}
          {accepted.map((f) => (
            <div key={f.id} className="person-row">
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
