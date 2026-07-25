import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { Skeleton } from "@/ui/Skeleton";
import { Avatar } from "@/ui/Avatar";
import { EmptyState } from "@/ui/EmptyState";
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
import "./Groups.css";

// "Spelen": de hub van de kernreis (#106). Per groep zie je wáár je zit in
// de reis (poll loopt → gekozen → geboekt) met één duidelijke vervolgstap;
// losse matches en het archief zijn hiervandaan bereikbaar. Bij precies één
// groep opent de tab direct de groepspagina (terug via "← Spelen").

const MAX_MEMBER_AVATARS = 4;

function ledenLabel(n: number): string {
  return n === 1 ? "1 lid" : `${n} leden`;
}

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
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);
  const profiles = useAsync(getProfilesMap, []);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const club = useClub();
  const today = dateInZone(club.timezone);

  const groupKey = (groups.data ?? []).map((g) => g.id).join(",");
  const journeys = useAsync(
    () => loadJourneys(groups.data ?? []),
     
    [groupKey],
  );

  // Eén groep → direct de groepspagina (alleen op /spelen; "?hub=1" of de
  // legacy /groepen-route toont altijd de hub, o.a. voor de terugknop).
  const list = groups.data ?? [];
  useEffect(() => {
    if (
      location.pathname === "/spelen" &&
      !params.has("hub") &&
      !groups.loading &&
      list.length === 1
    ) {
      navigate(`/groepen/${list[0].id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.loading, groupKey, location.pathname]);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Het aanmaakformulier zit achter een knop (#674 A5), behalve als je nog
  // geen groep hebt — dan is dít de actie van de pagina.
  const [newOpen, setNewOpen] = useState(false);
  const noGroups = !groups.loading && !groups.error && list.length === 0;
  useEffect(() => {
    if (noGroups) setNewOpen(true);
  }, [noGroups]);
  // Uitklappen zet de cursor meteen in het naamveld.
  useEffect(() => {
    if (newOpen && !noGroups) nameRef.current?.focus();
  }, [newOpen, noGroups]);

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
      {groups.error && <p className="msg msg--error">{groups.error}</p>}

      {!groups.loading && !groups.error && (
        <>
          {list.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="👥"
                title="Geen groep, geen glorie."
                action={
                  <button
                    className="btn btn--primary"
                    onClick={() => nameRef.current?.focus()}
                  >
                    Maak een groep
                  </button>
                }
              >
                Start hieronder je eigen padelgroep, nodig je vrienden uit en hou jullie onderlinge klassementen en wedstrijden live bij!
              </EmptyState>
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
                      {journey && (
                        <span
                          className={`group-card__journey group-card__journey--${journey.tone}`}
                        >
                          {journey.icon && (
                            <span aria-hidden="true">{journey.icon}</span>
                          )}
                          {journey.label}
                        </span>
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
          even zwaar als de groepen zelf (#674 A5). Achter een knop dus — met
          nul groepen staat hij meteen open, want dan ís dit de actie. */}
      {newOpen ? (
        <section className="card">
          <h2 className="card__title">Nieuwe groep</h2>
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
          className="btn hub-new"
          onClick={() => setNewOpen(true)}
        >
          + Nieuwe groep
        </button>
      )}

      {/* Secundaire rij: losse matches (buiten een groep) en de
          baanbeschikbaarheid. Stonden eerst als volwaardige kaarten tussen de
          groepen, waardoor de hub drie gelijkwaardige acties toonde. */}
      <section className="hub-extra" aria-label="Ook hier">
        <div className="hub-extra__card">
          <h2 className="hub-extra__title">Losse match</h2>
          <p className="hub-extra__text">
            Buiten een groep gespeeld? De uitslag telt gewoon mee voor je
            rating.
          </p>
          <div className="hub-extra__links">
            <Link className="btn btn--sm" to="/matches?log=1">
              + Match loggen
            </Link>
            <Link className="btn btn--sm" to="/matches">
              Alle matches →
            </Link>
          </div>
        </div>

        <div className="hub-extra__card">
          <h2 className="hub-extra__title">Vrije banen</h2>
          <p className="hub-extra__text">
            Kijk per dag of week welke banen vrij zijn bij {club.name}.
          </p>
          <div className="hub-extra__links">
            <Link className="btn btn--sm" to="/banen">
              🎾 Banen bekijken →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Groups;
