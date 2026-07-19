import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { Skeleton } from "@/ui/Skeleton";
import { Sheet } from "@/ui/Sheet";
import {
  getMyFriendships,
  getFriendSuggestions,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
  searchDiscoverableProfiles,
  categorize,
  otherId,
  type FriendSuggestion,
} from "./api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { headToHead } from "@/features/profiles/headToHead";
import { coachVrienden } from "@/features/coach/coachMoments";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import type { RoastCtx, CoachMood } from "@/features/coach/roastTone";
import { Avatar } from "@/ui/Avatar";
import { AccountNav } from "@/ui/AccountNav";
import { EmptyState } from "@/ui/EmptyState";
import type { Profile } from "@/types";
import "./Friends.css";

// Onder dit aantal onderlinge duels is de balans nog toeval — dezelfde drempel
// als MIN_DUELS in groups/rivalry.ts en MIN_SAMEN in profiles/headToHead.ts.
const MIN_DUELS = 3;

export function Friends() {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const friendships = useAsync(getMyFriendships, []);
  const profiles = useAsync(getProfilesMap, []);
  const suggestions = useAsync(getFriendSuggestions, []);
  // Voor Coach Rudy's head-to-head-sneer (#294): mijn matches + teams zodat we
  // de onderlinge balans tegen elke vriend kunnen afleiden (pure headToHead).
  const myMatches = useAsync(
    () => (myId ? getPlayerMatches(myId, 200) : Promise.resolve([])),
    [myId],
  );
  const teams = useAsync(getTeamsMap, []);
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
  // Suggestie waarvan de gemeenschappelijke vrienden in een popup getoond worden.
  const [mutualFor, setMutualFor] = useState<FriendSuggestion | null>(null);

  const pmap = profiles.data ?? {};
  const { accepted, incoming, outgoing } = categorize(friendships.data ?? [], myId);

  // /vrienden is een persoonlijk oppervlak (niet groep-gescoped), dus Coach Rudy
  // volgt — net als het dashboard — mijn eigen roast-intensiteit en -schild.
  const myIntensiteit = pmap[myId]?.roast_intensiteit ?? "gemeen";
  const mySchild = pmap[myId]?.roast_schild ?? false;
  const myCtx: RoastCtx = { intensiteit: myIntensiteit, schild: mySchild };

  // Rudy verwelkomt de nieuwe rivaal in de bevestigings-toast (per doelwit
  // geseed, zodat elke naam een eigen regel krijgt).
  const nieuweRivaalQuip = (addresseeId: string) =>
    coachVrienden({ situatie: "nieuw", seed: addresseeId, ctx: myCtx });

  // ids die al een relatie hebben (om dubbele verzoeken te voorkomen in de zoekresultaten)
  const relatedIds = new Set(
    (friendships.data ?? []).flatMap((f) => [f.requester_id, f.addressee_id]),
  );

  // Suggesties waarvan we het profiel kennen en die nog geen relatie hebben.
  const visibleSuggestions = (suggestions.data ?? []).filter(
    (s) => !relatedIds.has(s.id) && pmap[s.id],
  );

  // Oplopend volgnummer per zoekopdracht: een traag, verouderd antwoord mag
  // een nieuwer resultaat niet overschrijven.
  const searchSeq = useRef(0);

  const doSearch = useCallback(
    async (q: string) => {
      const seq = ++searchSeq.current;
      setSearching(true);
      try {
        const found = await searchDiscoverableProfiles(q, myId);
        if (seq !== searchSeq.current) return;
        setResults(found);
        setSearched(true);
      } catch (err) {
        if (seq === searchSeq.current) toast.error(errMsg(err));
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    },
    [myId, toast],
  );

  // Live zoeken terwijl je typt (met debounce); de Zoek-knop blijft voor
  // Enter en als expliciete bevestiging.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      searchSeq.current++;
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const t = setTimeout(() => doSearch(q), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) doSearch(query.trim());
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
          Je favoriete bondgenoten en slachtoffers op het veld.
        </p>
      </header>

      <AccountNav />

      {/* Mislukte query → echte foutmelding i.p.v. "geen vrienden" (issue #67). */}
      {(friendships.error ?? profiles.error) && (
        <div className="msg msg--error">
          Je vrienden laden mislukte: {friendships.error ?? profiles.error}{" "}
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              if (friendships.error) friendships.reload();
              if (profiles.error) profiles.reload();
              if (suggestions.error) suggestions.reload();
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      )}

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
                  : "Typ een gebruikersnaam — resultaten verschijnen vanzelf."}
              </p>
            )}
            {results.map((p) => {
              const already = relatedIds.has(p.id);
              return (
                <div key={p.id} className="person-row">
                  <PersonCell profile={p} to={`/spelers/${p.id}`} />
                  <button
                    className="btn btn--sm"
                    disabled={already}
                    onClick={() =>
                      act(
                        () => sendFriendRequest(myId, p.id),
                        nieuweRivaalQuip(p.id),
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
            {/* Lege staat alleen als de query slaagde en écht leeg is. */}
            {!friendships.loading && !friendships.error && incoming.length === 0 && (
              <p className="empty">Geen openstaande verzoeken.</p>
            )}
            {incoming.map((f) => (
              <div key={f.id} className="person-row person-row--attn">
                <PersonCell
                  profile={pmap[otherId(f, myId)]}
                  to={`/spelers/${otherId(f, myId)}`}
                />
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
                    <PersonCell
                      profile={pmap[otherId(f, myId)]}
                      to={`/spelers/${otherId(f, myId)}`}
                    />
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
        <h2 className="card__title">
          Mijn vrienden{" "}
          {accepted.length > 0 && (
            <span className="badge badge--accent">{accepted.length}</span>
          )}
        </h2>
        {!friendships.loading && !friendships.error && accepted.length === 0 && (
          <>
            <EmptyState icon="👋" title="Alleen op de baan?">
              Padel speel je niet alleen. Zoek hierboven je vaste partners of tegenstanders op en stuur ze een uitnodiging om samen matches te loggen!
            </EmptyState>
            <div className="friends-coach">
              <CoachBubble mood={mySchild ? "portret" : myIntensiteit} size={26}>
                <span className="coach-sneer__text">
                  {coachVrienden({ situatie: "leeg", seed: myId, ctx: myCtx })}
                </span>
              </CoachBubble>
            </div>
          </>
        )}
        <div className="person-grid">
          {friendships.loading && <Skeleton rows={3} />}
          {accepted.map((f) => {
            const fid = otherId(f, myId);
            // Onderlinge balans tegen deze vriend (alleen tonen bij genoeg duels).
            const balans =
              myMatches.data && teams.data
                ? headToHead(myMatches.data, teams.data, myId, fid).alsTegenstanders
                : null;
            const toonH2H = !!balans && balans.gespeeld >= MIN_DUELS;
            // Bij de rivaal telt diéns schild; de toon blijft mijn intensiteit.
            const fSchild = pmap[fid]?.roast_schild ?? false;
            const h2hMood: CoachMood = fSchild ? "portret" : myIntensiteit;
            return (
              <div key={f.id} className="friend-cell">
                <div className="person-row">
                  <PersonCell profile={pmap[fid]} to={`/spelers/${fid}`} />
                  <button
                    className="btn btn--danger btn--sm"
                    onClick={() => act(() => removeFriendship(f.id), "Verwijderd.")}
                  >
                    Verwijderen
                  </button>
                </div>
                {toonH2H && (
                  <CoachBubble mood={h2hMood} size={24}>
                    <span className="coach-sneer__text">
                      {coachVrienden({
                        situatie: "h2h",
                        balans: balans!,
                        seed: `${myId}:${fid}`,
                        ctx: { intensiteit: myIntensiteit, schild: fSchild },
                      })}
                    </span>
                  </CoachBubble>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Misschien ken je</h2>
        {suggestions.loading && <Skeleton rows={3} />}
        {suggestions.error && (
          <p className="msg msg--error">
            Suggesties laden mislukte: {suggestions.error}
          </p>
        )}
        {!suggestions.loading && !suggestions.error && visibleSuggestions.length === 0 && (
          <p className="empty">
            Nog geen suggesties — voeg vrienden toe en we stellen op basis van
            gemeenschappelijke vrienden nieuwe spelers voor.
          </p>
        )}
        <div className="suggest-grid">
          {visibleSuggestions.map((s) => {
            const p = pmap[s.id];
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
                    onClick={() => setMutualFor(s)}
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
                  </button>
                ) : (
                  <span className="person-sub">Voorgesteld voor jou</span>
                )}

                <button
                  className="btn btn--sm btn--primary suggest-card__cta"
                  onClick={() =>
                    act(() => sendFriendRequest(myId, s.id), nieuweRivaalQuip(s.id))
                  }
                >
                  Verzoek sturen
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {mutualFor && (
        <Sheet
          open
          onClose={() => setMutualFor(null)}
          compact
          title={`Gemeenschappelijk met ${displayName(pmap[mutualFor.id])}`}
        >
          <div className="person-list mt-4">
            {mutualFor.mutual_ids.map((mid) => (
              <div key={mid} className="person-row">
                <PersonCell
                  profile={pmap[mid]}
                  to={`/spelers/${mid}`}
                  onNavigate={() => setMutualFor(null)}
                />
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Avatar + naam (link naar spelersprofiel) met @gebruikersnaam eronder. */
function PersonCell({
  profile,
  to,
  onNavigate,
}: {
  profile?: Profile | null;
  to?: string;
  onNavigate?: () => void;
}) {
  return (
    <span className="cell-player">
      <Avatar profile={profile} size={32} />
      <span className="person-id">
        {to ? (
          <Link className="profile-link" to={to} onClick={onNavigate}>
            {displayName(profile)}
          </Link>
        ) : (
          <span>{displayName(profile)}</span>
        )}
        {profile?.username && (
          <span className="person-sub">@{profile.username}</span>
        )}
      </span>
    </span>
  );
}

function errMsg(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m.includes("friendships_unique_pair") || m.includes("duplicate"))
    return "Er bestaat al een relatie met deze speler.";
  return m;
}

export default Friends;
