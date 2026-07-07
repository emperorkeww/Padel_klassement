import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { getProfilesMap } from "../profiles/api";
import { getMyGroups, createGroup } from "./api";
import "./Groups.css";

const MAX_MEMBER_AVATARS = 4;

function ledenLabel(n: number): string {
  return n === 1 ? "1 lid" : `${n} leden`;
}

export function Groups() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);
  const profiles = useAsync(getProfilesMap, []);
  const toast = useToast();
  const navigate = useNavigate();

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

  const list = groups.data ?? [];
  const pmap = profiles.data ?? {};

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Groepen</h1>
        <p className="page-subtitle">
          Maak een groep, voeg vrienden toe en genereer wedstrijdrondes.
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
                title="Je zit nog in geen enkele groep."
                action={
                  <button
                    className="btn btn--primary"
                    onClick={() => nameRef.current?.focus()}
                  >
                    Maak een groep
                  </button>
                }
              >
                Maak hieronder je eerste groep aan en nodig daarna je vrienden
                uit.
              </EmptyState>
            </div>
          ) : (
            <div className="group-grid">
              {list.map((g) => (
                <Link key={g.id} className="group-card" to={`/groepen/${g.id}`}>
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
                          {g.member_ids.slice(0, MAX_MEMBER_AVATARS).map((pid) => (
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
                  </span>
                  <span className="group-card__chevron" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

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
