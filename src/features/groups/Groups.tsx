import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { Skeleton } from "@/ui/Skeleton";
import { Avatar } from "@/ui/Avatar";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { errorMessage } from "@/lib/utils/errors";
import { formatDate } from "@/lib/utils/format";
import { dateInZone } from "@/lib/utils/time";
import { useClub } from "@/features/availability/club";
import { getProfilesMap } from "@/features/profiles/api";
import { getMyGroups, createGroup, type GroupSummary } from "./api";
import {
  getGroupPolls,
  getGroupPollOptions,
  type PlayPoll,
  type PollOption,
} from "./pollsApi";
import { journeyFor } from "./journey";
import { ledenLabel, MAX_MEMBER_AVATARS } from "./groepHelpers";
import "./Groups.css";

// "Spelen": de hub van de kernreis (#106). Per groep zie je wáár je zit in
// de reis (poll loopt → gekozen → geboekt) met één duidelijke vervolgstap;
// losse matches en het archief zijn hiervandaan bereikbaar.

// Per groep: alleen wat journeyFor echt gebruikt. De votes werden opgehaald
// en nooit gelezen — bij 5 groepen 5 nutteloze queries (#674 C1). Het blijft
// een N+1; één RPC per hub-load is de volgende stap als dat gaat knellen.
async function loadJourneys(
  groups: GroupSummary[],
): Promise<Record<string, { polls: PlayPoll[]; options: PollOption[] }>> {
  const rows = await Promise.all(
    groups.map(async (g) => {
      const [polls, options] = await Promise.all([
        getGroupPolls(g.id),
        getGroupPollOptions(g.id),
      ]);
      return [g.id, { polls, options }] as const;
    }),
  );
  return Object.fromEntries(rows);
}

export function Groups() {
  usePageTitle("Spelen");
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);
  const profiles = useAsync(getProfilesMap, []);
  const toast = useToast();
  const navigate = useNavigate();
  const club = useClub();
  const today = dateInZone(club.timezone);

  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const journeys = useAsync(
    () => loadJourneys(groups.data ?? []),
     
    [groupKey],
  );

  // Tot #916 stuurde kaal /spelen je bij precies één groep meteen die groep in,
  // met "?hub=1" als enige uitzondering (#761). Dat maakte de hub — en dus
  // "+ Nieuwe groep", dat alleen hier staat — bereikbaar via één knop diep in
  // de groepskop, precies waar niemand hem zoekt. De hub staat er nu altijd;
  // dat kost één tik naar je groep, maar de tab doet wat hij belooft.
  const list = groups.data ?? [];

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Het aanmaakformulier zit achter een knop (#674 A5), behalve als je nog
  // geen groep hebt — dan is dít de actie van de pagina. Afgeleid tijdens de
  // render en niet in een effect, anders verschijnt het formulier één frame
  // ná de lege staat.
  const [newOpen, setNewOpen] = useState(false);
  const nieuwKnopRef = useRef<HTMLButtonElement>(null);
  const noGroups = !groups.loading && !groups.error && list.length === 0;
  // Zelf uitklappen zet de cursor meteen in het naamveld; bij een lege hub
  // niet, want dan zou de pagina bij het laden je focus kapen. Sluiten geeft
  // de focus terug aan de knop (#916) — dat moet in een effect: op het moment
  // van klikken bestaat die knop nog niet, het formulier staat er dan nog.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (newOpen) nameRef.current?.focus();
    else if (wasOpen.current) nieuwKnopRef.current?.focus();
    wasOpen.current = newOpen;
  }, [newOpen]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const g = await createGroup(name, myId);
      toast.success("Groep aangemaakt — voeg nu leden toe.");
      // Meteen door naar de ledentab van de nieuwe groep: daar gebeurt de
      // logische vervolgstap (vrienden toevoegen).
      navigate(`/groepen/${g.id}?tab=leden`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  const pmap = profiles.data ?? {};

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Spelen</h1>
        <p className="page-subtitle">
          Je vaste padel-kringen, planningspolls en divisionaire heerschappij.
        </p>
      </header>

      {groups.loading && (
        <div className="card">
          <Skeleton rows={3} />
        </div>
      )}
      {groups.error && (
        <ErrorRetry
          melding={`Je groepen laden mislukte: ${groups.error}`}
          onRetry={groups.reload}
        />
      )}

      {!groups.loading && !groups.error && (
        <>
          {list.length === 0 ? (
            // Eén kaart met één actie (#916). Hiervoor stonden er twee dingen
            // onder elkaar: een lege staat met een knop die alleen het veld
            // focuste, en daaronder datzelfde formulier al open.
            <div className="card">
              <EmptyState icon="👥" title="Geen groep, geen glorie.">
                Start je eigen padelgroep, nodig je vrienden uit en hou jullie
                onderlinge klassementen en wedstrijden live bij!
              </EmptyState>
              <form className="row-between account-form" onSubmit={create}>
                <input
                  ref={nameRef}
                  className="input"
                  aria-label="Groepsnaam"
                  placeholder="Groepsnaam, bijv. Vrijdagavond"
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="btn btn--primary"
                  disabled={busy || !name.trim()}
                >
                  {busy ? "Aanmaken…" : "Maak deze groep"}
                </button>
              </form>
            </div>
          ) : (
            <div className="group-grid">
              {list.map((g) => {
                const j = journeys.data?.[g.id];
                const journey = j
                  ? journeyFor(j.polls, j.options, today, Date.now())
                  : null;
                return (
                  <Link
                    key={g.id}
                    className="group-card"
                    to={`/groepen/${g.id}${journey && journey.tab !== "vandaag" ? "?tab=plannen" : ""}`}
                  >
                    <Avatar name={g.name} size={44} />
                    <span className="group-card__body">
                      <span className="group-card__top">
                        <span className="group-card__name">{g.name}</span>
                        {g.created_by === myId && (
                          <span className="badge badge--accent">eigenaar</span>
                        )}
                      </span>
                      <span className="group-card__meta">
                        {g.member_ids.length > 0 && (
                          <span
                            className="group-card__members"
                            aria-hidden="true"
                          >
                            {g.member_ids
                              .slice(0, MAX_MEMBER_AVATARS)
                              .map((pid) => (
                                <Avatar
                                  key={pid}
                                  profile={pmap[pid]}
                                  size={20}
                                  short
                                />
                              ))}
                            {g.member_ids.length > MAX_MEMBER_AVATARS && (
                              <span className="group-card__more">
                                +{g.member_ids.length - MAX_MEMBER_AVATARS}
                              </span>
                            )}
                          </span>
                        )}
                        <span>
                          {ledenLabel(g.member_ids.length)} · sinds{" "}
                          {formatDate(g.created_at)}
                        </span>
                      </span>
                      {/* De status komt uit een tweede query en viel dus ná de
                          kaarten binnen, waardoor de lijst versprong (#916).
                          De plek staat er nu meteen; alleen de inhoud wisselt. */}
                      {journey ? (
                        <span
                          className={`group-card__journey group-card__journey--${journey.tone}`}
                        >
                          {journey.icon && (
                            <span aria-hidden="true">{journey.icon}</span>
                          )}
                          {journey.label}
                        </span>
                      ) : (
                        <span
                          className="group-card__journey group-card__journey--laadt"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="group-card__chevron" aria-hidden="true">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Een groep erbij is zeldzaam; het formulier stond altijd open en woog
          even zwaar als de groepen zelf (#674 A5). Achter een knop dus. Met nul
          groepen zit het formulier ín de lege staat hierboven, dus deze tak
          draait alleen als je al een groep hebt. */}
      {!noGroups &&
        (newOpen ? (
          <section className="card">
            <div className="row-between">
              <h2 className="card__title">Nieuwe groep</h2>
              {/* #916: uitklappen had geen tegenhanger — het formulier bleef
                  staan tot je wegnavigeerde. */}
              <button
                type="button"
                className="btn btn--sm"
                aria-label="Formulier sluiten"
                onClick={() => {
                  setNewOpen(false);
                  setName("");
                }}
              >
                ✕
              </button>
            </div>
            <form className="row-between account-form" onSubmit={create}>
              <input
                ref={nameRef}
                className="input"
                aria-label="Groepsnaam"
                placeholder="Groepsnaam, bijv. Vrijdagavond"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn btn--primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Aanmaken…" : "Aanmaken"}
              </button>
            </form>
          </section>
        ) : (
          <button
            type="button"
            ref={nieuwKnopRef}
            className="btn hub-new"
            onClick={() => setNewOpen(true)}
          >
            + Nieuwe groep
          </button>
        ))}

      {/* Losse match is een veelgebruikt pad, geen voetnoot (#916): het stond
          als grijs kaartje onder de kop "Ook hier", naast de banen-verwijzing.
          Nu een gewone actie in de hub-toon, direct onder de groepen. */}
      <section className="card hub-los">
        <div className="row-between">
          <div>
            <h2 className="card__title card__title--tight">Losse match</h2>
            <p className="card__subtitle">
              Buiten een groep gespeeld? De uitslag telt gewoon mee voor je
              rating.
            </p>
          </div>
          <div className="btn-row">
            <Link className="btn btn--primary btn--sm" to="/matches?log=1">
              + Match loggen
            </Link>
            <Link className="btn btn--sm" to="/matches">
              Alle matches →
            </Link>
          </div>
        </div>
      </section>

      {/* Vrije banen blijft wél een rustige verwijzing: je komt hier niet om
          een baan te bekijken, maar het is handig dat het pad er staat. */}
      <p className="hub-banen">
        Benieuwd welke banen vrij zijn bij {club.name}?{" "}
        <Link to="/banen">🎾 Bekijk de banen →</Link>
      </p>
    </div>
  );
}

export default Groups;
