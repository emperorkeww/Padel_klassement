import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { dateInZone } from "../../lib/time";
import { useClub } from "../availability/club";
import { getProfilesMap } from "../profiles/api";
import { getMyGroups, createGroup, type GroupSummary } from "./api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "./pollsApi";
import { activePoll } from "./pollLogic";
import "./Groups.css";

// "Spelen": de hub van de kernreis (#106). Per groep zie je wáár je zit in
// de reis (poll loopt → gekozen → geboekt) met één duidelijke vervolgstap;
// losse matches en het archief zijn hiervandaan bereikbaar. Bij precies één
// groep opent de tab direct de groepspagina (terug via "← Spelen").

const MAX_MEMBER_AVATARS = 4;

function ledenLabel(n: number): string {
  return n === 1 ? "1 lid" : `${n} leden`;
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

type Journey = {
  label: string;
  /** "act" = actie nodig (accent), "info" = staat vast, "idle" = niets gepland. */
  tone: "act" | "info" | "idle";
  tab: "plannen" | "rondes";
};

/** Reis-status van een groep: waar zit de groep in de kernreis? */
function journeyFor(
  polls: PlayPoll[],
  options: PollOption[],
  today: string,
): Journey {
  const active = activePoll(polls, options, today);
  const locked = active?.locked_option_id
    ? (options.find((o) => o.id === active.locked_option_id) ?? null)
    : null;
  if (active?.status === "open") {
    return { label: "📊 Poll loopt — stem mee", tone: "act", tab: "plannen" };
  }
  if (active?.status === "locked" && locked) {
    return {
      label: `📆 ${shortDay(locked.date)} gekozen — boek de baan`,
      tone: "act",
      tab: "plannen",
    };
  }
  if (active?.status === "booked" && locked) {
    return {
      label: `🎾 ${shortDay(locked.date)} · ${locked.start_time} geboekt`,
      tone: "info",
      tab: locked.date === today ? "rondes" : "plannen",
    };
  }
  return { label: "Plan een speeldag →", tone: "idle", tab: "plannen" };
}

async function loadJourneys(
  groups: GroupSummary[],
): Promise<Record<string, { polls: PlayPoll[]; options: PollOption[]; votes: PollVote[] }>> {
  const rows = await Promise.all(
    groups.map(async (g) => {
      const [polls, options, votes] = await Promise.all([
        getGroupPolls(g.id),
        getGroupPollOptions(g.id),
        getGroupPollVotes(g.id),
      ]);
      return [g.id, { polls, options, votes }] as const;
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
                Start hieronder je eigen padelgroep, nodig je vrienden uit en hou jullie onderlinge klassementen en speelrondes live bij!
              </EmptyState>
            </div>
          ) : (
            <div className="group-grid">
              {list.map((g) => {
                const j = journeys.data?.[g.id];
                const journey = j
                  ? journeyFor(j.polls, j.options, today)
                  : null;
                return (
                  <Link
                    key={g.id}
                    className="group-card"
                    to={`/groepen/${g.id}${journey && journey.tab !== "rondes" ? "?tab=plannen" : ""}`}
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

      {/* Losse matches (buiten een groep) + het archief. */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Losse match</h2>
        </div>
        <p className="card__subtitle">
          Buiten een groep om gespeeld? Log de uitslag — hij telt gewoon mee
          voor je rating.
        </p>
        <div className="proposal__links">
          <Link className="btn btn--sm btn--primary" to="/matches?log=1">
            + Match loggen
          </Link>
          <Link className="btn btn--sm" to="/matches">
            Matcharchief →
          </Link>
        </div>
      </section>

      {/* Duidelijke mobiele ingang naar de baanbeschikbaarheid (zit niet in
          de onderbalk; binnen de plan-flow is hij er ook). */}
      <section className="card">
        <div className="card__head">
          <h2 className="card__title card__title--tight">Vrije banen</h2>
        </div>
        <p className="card__subtitle">
          Bekijk per dag of week welke banen vrij zijn bij {club.name}.
        </p>
        <div className="proposal__links">
          <Link className="btn btn--sm" to="/banen">
            🎾 Vrije banen bekijken →
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Nieuwe groep</h2>
        <form className="row-between account-form" onSubmit={create}>
          <input
            ref={nameRef}
            className="input"
            placeholder="Groepsnaam, bijv. Vrijdagavond"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn--primary" disabled={busy || !name.trim()}>
            {busy ? "Aanmaken…" : "Aanmaken"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default Groups;
