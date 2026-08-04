import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useRealtime } from "@/lib/hooks/useRealtime";
import { useToast } from "@/ui/ToastProvider";
import { useConfirm } from "@/ui/ConfirmDialog";
import { Skeleton } from "@/ui/Skeleton";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Aankondiging } from "@/ui/Aankondiging";
import { aantalTekst } from "@/lib/utils/format";
import { Sheet } from "@/ui/Sheet";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import {
  getMyFriendships,
  getFriendSuggestions,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
  searchDiscoverableProfiles,
  categorize,
  otherId,
  mijnRelaties,
  reopenFriendRequest,
  type FriendSuggestion,
  type MijnRelatie,
} from "./api";
import {
  getMyGuestClaims,
  claimGuestPlayer,
  cancelGuestClaim,
} from "@/features/guests/api";
import { getProfilesMap, displayName } from "@/features/profiles/api";
import { getPlayerMatches, getTeamsMap } from "@/features/matches/api";
import { headToHead } from "@/features/profiles/headToHead";
import { coachVrienden } from "@/features/coach/coachMoments";
import { CoachBubble } from "@/features/coach/components/CoachBubble";
import type { RoastCtx, CoachMood } from "@/features/coach/roastTone";
import { Avatar } from "@/ui/Avatar";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { Toggle } from "@/ui/Toggle";
import { OverflowMenu } from "@/ui/OverflowMenu";
import { readFlag, writeFlag } from "@/lib/utils/localFlag";
import { EmptyState } from "@/ui/EmptyState";
import type { Profile } from "@/types";
import "./Friends.css";

// Onder dit aantal onderlinge duels is de balans nog toeval — dezelfde drempel
// als MIN_DUELS in groups/rivalry.ts en MIN_SAMEN in profiles/headToHead.ts.
const MIN_DUELS = 3;

// Vijf secties stapelden altijd volledig uitgeklapt onder elkaar (#919). Drie
// tabs: je lijst, wat op je wacht, en waar je iemand vindt.
type Tab = "vrienden" | "verzoeken" | "ontdekken";

function tabFrom(value: string | null): Tab {
  return value === "verzoeken" || value === "ontdekken" ? value : "vrienden";
}

/** Hoeveel rijen een lange lijst toont voordat "Toon meer" verschijnt. */
const LIJST_STAP = 12;

/** localStorage-sleutel voor het dempen van de H2H-bubbels. */
const H2H_UIT = "vrienden-h2h-uit";

/**
 * Wat de knop naast een zoekresultaat zegt en doet. Eén generiek "Al gekoppeld"
 * dekte vier verschillende situaties (#1013); nu benoemt het label waar je op
 * wacht. Een verzoek dat ík geweigerd heb is geen doodlopende weg meer:
 * `heropenId` wijst naar de rij die daarvoor plaats moet maken.
 */
function zoekActie(relatie: MijnRelatie | undefined): {
  label: string;
  disabled: boolean;
  heropenId: string | null;
} {
  switch (relatie?.soort) {
    case undefined:
      return { label: "Verzoek sturen", disabled: false, heropenId: null };
    case "vrienden":
      return { label: "Al vrienden", disabled: true, heropenId: null };
    case "verzoek-verstuurd":
      return { label: "Verzoek verstuurd", disabled: true, heropenId: null };
    case "verzoek-ontvangen":
      return { label: "Verzoek ontvangen", disabled: true, heropenId: null };
    case "geweigerd-door-mij":
      return {
        label: "Alsnog toevoegen",
        disabled: false,
        heropenId: relatie.rij.id,
      };
    case "geweigerd-door-hen":
      return { label: "Verzoek geweigerd", disabled: true, heropenId: null };
  }
}

export function Friends() {
  usePageTitle("Vrienden");
  const { user } = useAuth();
  const myId = user?.id ?? "";

  // Tab in de URL (?tab=), net als op het groepsdetail en het profiel:
  // deelbaar en refresh-bestendig.
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("tab"));
  const setTab = (next: Tab) => {
    const volgende = new URLSearchParams(params);
    if (next === "vrienden") volgende.delete("tab");
    else volgende.set("tab", next);
    setParams(volgende, { replace: true });
  };
  // Hoeveel rijen er per lange lijst getoond worden; groeit per LIJST_STAP.
  const [vriendenLimiet, setVriendenLimiet] = useState(LIJST_STAP);
  const [suggestieLimiet, setSuggestieLimiet] = useState(LIJST_STAP);
  // De H2H-sneer per vriend verdubbelde de rijhoogte en was niet te dempen.
  const [h2hUit, setH2hUit] = useState(() => readFlag(H2H_UIT) === "1");

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
  const [confirm, confirmUi] = useConfirm();
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
  const myIntensiteit = pmap[myId]?.roast_intensiteit ?? "radioactief";
  const mySchild = pmap[myId]?.roast_schild ?? false;
  const myCtx: RoastCtx = { intensiteit: myIntensiteit, schild: mySchild };

  // Rudy verwelkomt de nieuwe rivaal in de bevestigings-toast (per doelwit
  // geseed, zodat elke naam een eigen regel krijgt).
  const nieuweRivaalQuip = (addresseeId: string) =>
    coachVrienden({ situatie: "nieuw", seed: addresseeId, ctx: myCtx });

  // Mijn eigen relaties, per speler-id — strikt de rijen waar ik zelf bij zit.
  // Dit stond hier ooit als "alle ids uit alle rijen", maar sinds #326 zijn ook
  // vriendschappen tússen twee anderen leesbaar; die maakten vreemden onterecht
  // "al gekoppeld" en filterden ze uit de suggesties (#1013).
  const relaties = mijnRelaties(friendships.data ?? [], myId);

  // Suggesties waarvan we het profiel kennen. De RPC sluit bestaande relaties
  // al server-side uit; deze filter dekt enkel nog een suggestielijst die net
  // achterloopt op een zojuist verstuurd verzoek.
  const visibleSuggestions = (suggestions.data ?? []).filter(
    (s) => !relaties.has(s.id) && pmap[s.id],
  );

  // Lange lijsten stap voor stap (#919): een volle vriendenlijst maakte de tab
  // alsnog eindeloos.
  const zichtbareVrienden = accepted.slice(0, vriendenLimiet);
  const zichtbareSuggesties = visibleSuggestions.slice(0, suggestieLimiet);
  // Alleen een schakelaar aanbieden als er ook echt een H2H-regel te dempen is.
  const heeftH2H =
    !!myMatches.data &&
    !!teams.data &&
    accepted.some(
      (f) =>
        headToHead(myMatches.data!, teams.data!, myId, otherId(f, myId))
          .alsTegenstanders.gespeeld >= MIN_DUELS,
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

  // Live zoeken terwijl je typt (met debounce). Sinds #919 de enige manier: de
  // Zoek-knop ernaast riep exact dezelfde functie aan.
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

  // Koppelverzoeken voor gastspelers (#681): iemand claimt dat een gast die hij
  // aanmaakte in werkelijkheid dit account is. Alleen ik kan dat bevestigen.
  const guestClaims = useAsync(getMyGuestClaims, []);
  const inkomendeClaims = (guestClaims.data ?? []).filter(
    (c) => c.player_id === myId,
  );
  // Hoeveel historie er op het spel staat — zonder dat getal is "bevestigen"
  // een blinde keuze. Alleen opgehaald als er echt een verzoek ligt.
  const claimGuestIds = inkomendeClaims.map((c) => c.guest_id).join(",");
  const claimMatchCounts = useAsync(async () => {
    const ids = claimGuestIds ? claimGuestIds.split(",") : [];
    const entries = await Promise.all(
      ids.map(
        async (gid) =>
          [
            gid,
            (await getPlayerMatches(gid, 200)).filter(
              (m) => m.status === "completed",
            ).length,
          ] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<string, number>;
  }, [claimGuestIds]);

  // De koppeling raakt profielen, matches én de vriendenlijst; de actie geeft
  // zelf de tekst terug, omdat die het aantal overgenomen matches noemt.
  async function claimAct(fn: () => Promise<string>) {
    try {
      toast.success(await fn());
      guestClaims.reload();
      profiles.reload();
      friendships.reload();
    } catch (err) {
      toast.error(errMsg(err));
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
        <div className="row-between">
          <h1 className="page-title">Vrienden</h1>
          {/* Terug naar de andere helft van je account (#945). Stond hier als
              segmented control (AccountNav) dwars boven de tabs van deze
              pagina: twee balken met hetzelfde gewicht die op verschillende
              niveaus navigeren. Dit is een secundaire ingang, dus die leest ook
              zo. Op desktop staan Profiel en Vrienden al naast elkaar in de
              zijbalk; op mobiel blijft de avatar in de topbalk. */}
          <Link className="profile-link" to="/profiel">
            Naar je profiel →
          </Link>
        </div>
        <p className="page-subtitle">
          Je favoriete bondgenoten en slachtoffers op het veld.
        </p>
      </header>

      {/* Mislukte query → echte foutmelding i.p.v. "geen vrienden" (issue #67). */}
      {(friendships.error ?? profiles.error) && (
        <ErrorRetry
          melding={`Je vrienden laden mislukte: ${friendships.error ?? profiles.error}`}
          onRetry={() => {
            if (friendships.error) friendships.reload();
            if (profiles.error) profiles.reload();
            if (suggestions.error) suggestions.reload();
          }}
        />
      )}

      {/* Drie tabs in plaats van vijf stapelende secties (#919). De gastclaims
          horen bij "wacht op jou" en verhuizen dus naar Verzoeken; de teller op
          die tab is meteen het signaal dat er iets ligt — dat zag je eerder
          alleen door te scrollen. */}
      <PageTabs
        tabs={[
          { id: "vrienden" as const, label: "Vrienden", count: accepted.length || undefined },
          {
            id: "verzoeken" as const,
            label: "Verzoeken",
            count: incoming.length + outgoing.length + inkomendeClaims.length || undefined,
          },
          { id: "ontdekken" as const, label: "Ontdekken" },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Vriendenonderdelen"
        idPrefix="vrienden"
      />

      <TabPanel id={tab} idPrefix="vrienden">
        {tab === "vrienden" && (
              <section className="card">
                {/* De tab erboven zegt "Vrienden 3" al; deze kop herhaalde dat
                    met dezelfde teller (#945). Hij blijft voor schermlezers
                    staan, zodat het paneel een kop houdt. */}
                <h2 className="sr-only">Mijn vrienden</h2>
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
                {/* De H2H-sneer verdubbelde de rijhoogte en was niet te dempen
                    (#919). Alleen aanbieden als er ook echt iets te dempen is. */}
                {accepted.length > 0 && heeftH2H && (
                  <div className="friends-h2h-toggle">
                    <Toggle
                      label="Rudy's onderlinge balans tonen"
                      checked={!h2hUit}
                      onChange={(aan) => {
                        setH2hUit(!aan);
                        writeFlag(H2H_UIT, aan ? null : "1");
                      }}
                    />
                  </div>
                )}
                <div className="person-grid">
                  {friendships.loading && <Skeleton rows={3} />}
                  {zichtbareVrienden.map((f) => {
                    const fid = otherId(f, myId);
                    // Onderlinge balans tegen deze vriend (alleen tonen bij genoeg duels).
                    const balans =
                      myMatches.data && teams.data
                        ? headToHead(myMatches.data, teams.data, myId, fid).alsTegenstanders
                        : null;
                    const toonH2H =
                      !h2hUit && !!balans && balans.gespeeld >= MIN_DUELS;
                    // Bij de rivaal telt diéns schild; de toon blijft mijn intensiteit.
                    const fSchild = pmap[fid]?.roast_schild ?? false;
                    const h2hMood: CoachMood = fSchild ? "portret" : myIntensiteit;
                    return (
                      <div key={f.id} className="friend-cell">
                        <div className="person-row">
                          <PersonCell profile={pmap[fid]} to={`/spelers/${fid}`} />
                          {/* Verwijderen stond als rode knop naast elke vriend,
                              terwijl je hier meestal komt om iemand tóe te
                              voegen (#919). De bevestiging blijft — dat was
                              nooit het probleem, de prominentie wel. */}
                          <OverflowMenu
                            label={`Meer bij ${displayName(pmap[fid])}`}
                            className="person-row__menu"
                          >
                            {(sluit) => (
                              <>
                                <Link className="btn btn--sm" to={`/spelers/${fid}`}>
                                  Profiel bekijken
                                </Link>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={async () => {
                                    sluit();
                                    if (
                                      !(await confirm({
                                        title: "Vriend verwijderen?",
                                        body: `${displayName(pmap[fid])} wordt uit je vriendenlijst verwijderd.`,
                                        confirmLabel: "Verwijderen",
                                        danger: true,
                                      }))
                                    )
                                      return;
                                    act(() => removeFriendship(f.id), "Verwijderd.");
                                  }}
                                >
                                  Vriend verwijderen
                                </button>
                              </>
                            )}
                          </OverflowMenu>
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
                {accepted.length > vriendenLimiet && (
                  <div className="friends-meer">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setVriendenLimiet((n) => n + LIJST_STAP)}
                    >
                      Toon meer ({accepted.length - vriendenLimiet})
                    </button>
                  </div>
                )}
              </section>
        )}

        {tab === "verzoeken" && (
          <>
                  {inkomendeClaims.length > 0 && (
                    <section className="card">
                      <h2 className="card__title">Ben jij deze gast? 👤</h2>
                      <p className="card__subtitle">
                        Iemand speelde je als gast in, voordat je een account had. Bevestig
                        je dat, dan komt die historie op jouw naam te staan.
                      </p>
                      <div className="person-list">
                        {inkomendeClaims.map((c) => {
                          const gast = displayName(pmap[c.guest_id]);
                          const vrager = displayName(pmap[c.requested_by]);
                          const aantal = claimMatchCounts.data?.[c.guest_id];
                          return (
                            <div key={c.id} className="person-row person-row--attn">
                              <PersonCell profile={pmap[c.guest_id]} />
                              <span className="btn-row">
                                <span className="badge">
                                  {vrager} vraagt
                                  {aantal != null && ` · ${aantal} matches`}
                                </span>
                                <button
                                  className="btn btn--primary btn--sm"
                                  onClick={async () => {
                                    if (
                                      !(await confirm({
                                        title: "Ben jij deze gast?",
                                        body: `Alle matches, punten en groepen van ${gast} komen op jouw account te staan en je rating wordt opnieuw berekend — inclusief de matches die je als gast speelde. ${gast} verdwijnt daarna. Dit kan niet ongedaan worden gemaakt.`,
                                        confirmLabel: "Ja, koppel mijn account",
                                      }))
                                    )
                                      return;
                                    await claimAct(async () => {
                                      const res = await claimGuestPlayer(c.guest_id, myId);
                                      return `Gekoppeld — ${res.matches} matches staan nu op jouw naam.`;
                                    });
                                  }}
                                >
                                  Ja, dat ben ik
                                </button>
                                <button
                                  className="btn btn--sm"
                                  onClick={() =>
                                    claimAct(async () => {
                                      await cancelGuestClaim(c.id);
                                      return "Verzoek geweigerd.";
                                    })
                                  }
                                >
                                  Nee
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
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
          </>
        )}

        {tab === "ontdekken" && (
          <>
                    <section className="card">
                      <h2 className="card__title">Speler zoeken</h2>
                      {/* Eén affordance (#919): er werd al live gezocht met debounce, dus
                          de "Zoek"-knop deed exact hetzelfde als typen. Het formulier blijft
                          staan zodat Enter de pagina niet herlaadt; de wis-knop is een
                          ándere actie en telt dus niet als tweede zoekknop. */}
                      <form
                        className="friends-search"
                        role="search"
                        onSubmit={(e) => e.preventDefault()}
                      >
                        <input
                          className="input"
                          placeholder="Zoek op gebruikersnaam…"
                          aria-label="Zoek een speler"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query && (
                          <button
                            type="button"
                            className="btn btn--sm friends-search__clear"
                            aria-label="Zoekterm wissen"
                            onClick={() => setQuery("")}
                          >
                            <span aria-hidden="true">✕</span>
                          </button>
                        )}
                      </form>
                      {searching && (
                        <p className="empty" role="status">
                          Zoeken…
                        </p>
                      )}

                      {/* "Zoeken…" hierboven meldt dát er gezocht wordt; dit
                          meldt de uitkomst, die anders geluidloos binnenkomt
                          (#924). Nog niet gezocht = niets te melden. */}
                      <Aankondiging
                        sleutel={query.trim()}
                        bericht={
                          searching || !searched
                            ? ""
                            : `${aantalTekst(results.length, "speler", "spelers")} gevonden.`
                        }
                      />

                      <div className="person-list mt-4">
                        {results.length === 0 && (
                          <p className="empty">
                            {searched
                              ? `Geen spelers gevonden voor “${query.trim()}”.`
                              : "Typ een gebruikersnaam — resultaten verschijnen vanzelf."}
                          </p>
                        )}
                        {results.map((p) => {
                          const { label, disabled, heropenId } = zoekActie(
                            relaties.get(p.id),
                          );
                          return (
                            <div key={p.id} className="person-row">
                              <PersonCell profile={p} to={`/spelers/${p.id}`} />
                              <button
                                className="btn btn--sm"
                                disabled={disabled}
                                onClick={() =>
                                  act(
                                    () =>
                                      heropenId
                                        ? reopenFriendRequest(heropenId, myId, p.id)
                                        : sendFriendRequest(myId, p.id),
                                    nieuweRivaalQuip(p.id),
                                  )
                                }
                              >
                                {label}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  <section className="card">
                    <h2 className="card__title">Misschien ken je</h2>
                    {suggestions.loading && <Skeleton rows={3} />}
                    {suggestions.error && (
                      <ErrorRetry
                        melding={`Suggesties laden mislukte: ${suggestions.error}`}
                        onRetry={suggestions.reload}
                      />
                    )}
                    {!suggestions.loading && !suggestions.error && visibleSuggestions.length === 0 && (
                      <p className="empty">
                        Nog geen suggesties — voeg vrienden toe en we stellen op basis van
                        gemeenschappelijke vrienden nieuwe spelers voor.
                      </p>
                    )}
                    <div className="suggest-grid">
                      {zichtbareSuggesties.map((s) => {
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
                    {visibleSuggestions.length > suggestieLimiet && (
                      <div className="friends-meer">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setSuggestieLimiet((n) => n + LIJST_STAP)}
                        >
                          Toon meer ({visibleSuggestions.length - suggestieLimiet})
                        </button>
                      </div>
                    )}
                  </section>
          </>
        )}
      </TabPanel>

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
      {confirmUi}
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
