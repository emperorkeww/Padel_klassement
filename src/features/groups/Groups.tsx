import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { getMyGroups, createGroup } from "./api";

export function Groups() {
  const { user } = useAuth();
  const myId = user?.id ?? "";
  const groups = useAsync(getMyGroups, []);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await createGroup(name, myId);
      setName("");
      setMsg({ type: "success", text: "Groep aangemaakt." });
      groups.reload();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Groepen</h1>
        <p className="page-subtitle">
          Maak een groep, voeg vrienden toe en genereer willekeurige wedstrijden.
        </p>
      </header>

      <section className="card">
        <h2 className="card__title">Nieuwe groep</h2>
        {msg && <p className={`msg msg--${msg.type}`}>{msg.text}</p>}
        <form className="row-between" onSubmit={create}>
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

      <section className="card">
        <h2 className="card__title">Mijn groepen</h2>
        {groups.loading && <p className="empty">Laden…</p>}
        {groups.error && <p className="msg msg--error">{groups.error}</p>}
        {!groups.loading && (groups.data ?? []).length === 0 && (
          <p className="empty">Je zit nog in geen enkele groep.</p>
        )}
        <div className="stack">
          {(groups.data ?? []).map((g) => (
            <div key={g.id} className="row-between">
              <span>
                {g.name}{" "}
                {g.created_by === myId && (
                  <span className="badge badge--accent">eigenaar</span>
                )}
              </span>
              <Link className="btn btn--sm" to={`/groepen/${g.id}`}>
                Openen
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Groups;
