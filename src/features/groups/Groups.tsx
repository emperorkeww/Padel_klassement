import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import { Avatar } from "../../components/Avatar";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { getMyGroups, createGroup } from "./api";
import "./Groups.css";

export function Groups() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);
  const toast = useToast();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createGroup(name, myId);
      setName("");
      toast.success("Groep aangemaakt.");
      groups.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const list = groups.data ?? [];

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
              <div className="empty-state">
                <p className="empty-state__title">
                  Je zit nog in geen enkele groep. Maak hieronder je eerste
                  groep aan ↓ en nodig daarna je vrienden uit.
                </p>
              </div>
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
                      sinds {formatDate(g.created_at)}
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
            className="input"
            placeholder="Groepsnaam, bijv. Vrijdagavond"
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
