import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../components/ToastProvider";
import { Skeleton } from "../../components/Skeleton";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  displayName,
} from "../profiles/api";
import { changeEmail, changePassword } from "./api";
import { formatDate } from "../../lib/format";
import type { Profile } from "../../lib/types";
import "./ProfileSettings.css";

export function ProfileSettings() {
  const { user, signOut } = useAuth();
  const myId = user?.id ?? "";
  const profile = useAsync(() => getProfile(myId), [myId]);

  if (profile.loading)
    return (
      <div className="card">
        <Skeleton rows={4} />
      </div>
    );
  if (!profile.data) return <p className="msg msg--error">Profiel niet gevonden.</p>;

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Profiel</h1>
        <p className="page-subtitle">Beheer je gegevens en accountinstellingen.</p>
      </header>

      <div className="grid grid--2">
        <AvatarCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
        <NameCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
      </div>

      <EmailCard currentEmail={user?.email ?? ""} />
      <PasswordCard email={user?.email ?? ""} />

      <section className="card">
        <div className="row-between">
          <div>
            <h2 className="card__title card__title--tight">Sessie</h2>
            <p className="empty empty--bare">Ingelogd als {user?.email}</p>
          </div>
          <button className="btn btn--danger" onClick={() => signOut()}>
            Uitloggen
          </button>
        </div>
      </section>

      <p className="profile-meta">Lid sinds {formatDate(profile.data.created_at)}.</p>
    </div>
  );
}

/* ---------- Profielfoto ---------- */
function AvatarCard({
  profile,
  userId,
  onUpdated,
}: {
  profile: Profile;
  userId: string;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Kies een afbeelding.");
    if (f.size > 5 * 1024 * 1024) return toast.error("Maximaal 5 MB.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(userId, file);
      await updateProfile(userId, { avatar_url: url });
      toast.success("Profielfoto bijgewerkt.");
      setFile(null);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? profile.avatar_url;

  return (
    <section className="card">
      <h2 className="card__title">Profielfoto</h2>
      <div className="avatar-row">
        <div className="avatar-preview">
          {shown ? (
            <img src={shown} alt="Profielfoto" />
          ) : (
            <span>{displayName(profile).slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="stack">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
          <button className="btn" onClick={() => inputRef.current?.click()}>
            Foto kiezen
          </button>
          <button className="btn btn--primary" disabled={busy || !file} onClick={save}>
            {busy ? "Uploaden…" : "Opslaan"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Naam ---------- */
function NameCard({
  profile,
  userId,
  onUpdated,
}: {
  profile: Profile;
  userId: string;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const [username, setUsername] = useState(profile.username);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile(userId, {
        username: username.trim(),
        full_name: fullName.trim() || null,
      });
      toast.success("Naam bijgewerkt.");
      onUpdated();
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      toast.error(
        m.includes("duplicate") || m.includes("unique")
          ? "Die gebruikersnaam is al bezet."
          : m,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title">Naam</h2>
      <form className="stack" onSubmit={save}>
        <label className="label">
          Gebruikersnaam
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="label">
          Volledige naam
          <input
            className="input"
            value={fullName}
            placeholder="Voor- en achternaam"
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <div>
          <button className="btn btn--primary" disabled={busy || !username.trim()}>
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------- E-mail ---------- */
function EmailCard({ currentEmail }: { currentEmail: string }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await changeEmail(email);
      toast.success("Bevestig de wijziging via de link in je mailbox (lokaal: Mailpit).");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">E-mailadres</h2>
      <p className="card__subtitle">
        Huidig: <strong>{currentEmail}</strong>
      </p>
      <form className="stack" onSubmit={save}>
        <label className="label">
          Nieuw e-mailadres
          <input
            className="input"
            type="email"
            value={email}
            placeholder="nieuw@voorbeeld.nl"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <div>
          <button className="btn btn--primary" disabled={busy || !email.trim()}>
            {busy ? "Versturen…" : "E-mail wijzigen"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------- Wachtwoord ---------- */
function PasswordCard({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6)
      return toast.error("Nieuw wachtwoord: minstens 6 tekens.");
    if (next !== confirm)
      return toast.error("De nieuwe wachtwoorden komen niet overeen.");
    setBusy(true);
    try {
      await changePassword(email, current, next);
      toast.success("Wachtwoord gewijzigd.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title">Wachtwoord</h2>
      <form className="stack" onSubmit={save}>
        <label className="label">
          Huidig wachtwoord
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <div className="grid grid--2">
          <label className="label">
            Nieuw wachtwoord
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </label>
          <label className="label">
            Bevestig nieuw wachtwoord
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
        </div>
        <div>
          <button
            className="btn btn--primary"
            disabled={busy || !current || !next || !confirm}
          >
            {busy ? "Wijzigen…" : "Wachtwoord wijzigen"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ProfileSettings;
