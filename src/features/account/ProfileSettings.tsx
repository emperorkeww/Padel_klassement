import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { ProfileSkeleton, Skeleton } from "@/ui/Skeleton";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  displayName,
} from "@/features/profiles/api";
import {
  changeEmail,
  changePassword,
  getNotificationPrefs,
  getPrivacy,
  updateNotificationPrefs,
  updatePrivacy,
  type NotificationPrefs,
  type Privacy,
} from "./api";
import { AccountNav } from "@/ui/AccountNav";
import { CoachAbout } from "@/features/coach/components/CoachAbout";
import type { RoastIntensiteit } from "@/types";
import { formatDate } from "@/lib/utils/format";
import { errorMessage } from "@/lib/utils/errors";
import {
  disablePush,
  enablePush,
  getPushSubscription,
  pushAvailability,
} from "@/lib/supabase/push";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/utils/theme";
import type { Profile } from "@/types";
import "./ProfileSettings.css";

// De secties liggen sinds #70 achter tabs — één behapbaar blok per tab i.p.v.
// alles onder elkaar. Zelfde tab-patroon als GroupDetail/PlayerProfile.
type SettingsTab = "profiel" | "privacy" | "account";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "profiel", label: "Profiel" },
  { id: "privacy", label: "Meldingen & privacy" },
  { id: "account", label: "Account" },
];

function tabFrom(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((t) => t.id === value)
    ? (value as SettingsTab)
    : "profiel";
}

export function ProfileSettings() {
  const { user, signOut } = useAuth();
  const myId = user?.id ?? "";
  const profile = useAsync(() => getProfile(myId), [myId]);

  // Actieve tab in de URL (?tab=): deelbaar en refresh-bestendig. De default
  // (profiel) laat de param weg, net als elders in de app.
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("tab"));
  function setTab(next: SettingsTab) {
    const p = new URLSearchParams(params);
    if (next === "profiel") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  }

  if (profile.loading)
    return (
      // Speelt de echte paginavorm na: twee kaarten naast elkaar.
      <div className="grid grid--2">
        <div className="card">
          <ProfileSkeleton />
        </div>
        <div className="card">
          <Skeleton rows={3} />
        </div>
      </div>
    );
  if (!profile.data) return <p className="msg msg--error">Profiel niet gevonden.</p>;

  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">Profiel</h1>
        <p className="page-subtitle">Pas je profiel aan. Zorg in ieder geval dat je foto er professioneler uitziet dan je slagen.</p>
      </header>

      <AccountNav />

      <nav className="tabs settings-tabs" aria-label="Instellingen">
        {SETTINGS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? "is-active" : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "profiel" && (
        <>
          <div className="grid grid--2">
            <AvatarCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
            <NameCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
          </div>
          <ThemeCard
            userId={myId}
            toonWaarnemend={profile.data?.toon_waarnemend_dictator ?? true}
            dictatorPortret={profile.data?.dictator_portret ?? true}
            onUpdated={profile.reload}
          />
        </>
      )}

      {tab === "privacy" && (
        <>
          <div className="grid grid--2">
            <NotificationsCard userId={myId} />
            <PrivacyCard userId={myId} />
          </div>
          <section className="card">
            <h2 className="card__title card__title--tight">Over Coach Rudy 🎙️</h2>
            <p className="card__subtitle">
              Wie hij is en hoe je hem afstelt.
            </p>
            <CoachAbout />
          </section>
        </>
      )}

      {tab === "account" && (
        <>
          <div className="grid grid--2">
            <EmailCard currentEmail={user?.email ?? ""} />
            <PasswordCard email={user?.email ?? ""} />
          </div>

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
        </>
      )}
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
          <div className="btn-row">
            <button className="btn" onClick={() => inputRef.current?.click()}>
              Foto kiezen
            </button>
            <button className="btn btn--primary" disabled={busy || !file} onClick={save}>
              {busy ? "Uploaden…" : "Opslaan"}
            </button>
          </div>
          {file && <span className="badge badge--accent">Nog niet opgeslagen</span>}
          <p className="avatar-hint">JPG of PNG, maximaal 5 MB.</p>
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

/* ---------- Meldingen (web push) ---------- */
const NOTIFY_OPTIES: {
  key: keyof NotificationPrefs;
  label: string;
  hint: string;
}[] = [
  {
    key: "notify_new_round",
    label: "Nieuwe ronde",
    hint: "Als er een nieuwe wedstrijd voor jou gegenereerd is.",
  },
  {
    key: "notify_result",
    label: "Uitslagen",
    hint: "Als de uitslag van jouw match is ingevoerd.",
  },
  {
    key: "notify_friend_request",
    label: "Vriendschapsverzoeken",
    hint: "Als iemand je een verzoek stuurt.",
  },
  {
    key: "notify_match_reminder",
    label: "Match-herinneringen",
    hint: "Een paar uur vóór een geplande match.",
  },
  {
    key: "notify_rank_change",
    label: "Promotie & degradatie",
    hint: "Als je stijgt of zakt in het klassement (troon, top-3, kelder).",
  },
];

function NotificationsCard({ userId }: { userId: string }) {
  const toast = useToast();
  const availability = pushAvailability();
  const [enabled, setEnabled] = useState<boolean | null>(
    availability === "ready" ? null : false,
  );
  const [busy, setBusy] = useState(false);
  const prefs = useAsync(() => getNotificationPrefs(userId), [userId]);
  const [prefsBusy, setPrefsBusy] = useState(false);

  async function setPref(patch: Partial<NotificationPrefs>) {
    setPrefsBusy(true);
    try {
      await updateNotificationPrefs(userId, patch);
      toast.success("Meldingen bijgewerkt.");
      prefs.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPrefsBusy(false);
    }
  }

  useEffect(() => {
    if (availability !== "ready") return;
    getPushSubscription()
      .then((sub) => setEnabled(!!sub))
      .catch(() => setEnabled(false));
  }, [availability]);

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Meldingen uitgeschakeld op dit apparaat.");
      } else {
        await enablePush(userId);
        setEnabled(true);
        toast.success("Meldingen staan aan — vamos!");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const np = prefs.data;

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">Meldingen</h2>
      <p className="card__subtitle">
        Nieuwe wedstrijden, uitslagen van jouw matches en vriendschapsverzoeken —
        ook als de app dicht is.
      </p>
      {availability === "needs-install" ? (
        <p className="empty">
          Op iPhone en iPad werken meldingen alleen als de app op je beginscherm
          staat. Tik in Safari op Deel (het vierkantje met pijl) en kies "Zet op
          beginscherm". Open de app daarna vanaf je beginscherm en zet meldingen
          hier aan.
        </p>
      ) : availability === "denied" ? (
        <p className="empty">
          Je hebt meldingen voor deze app geweigerd. Zet ze weer aan via
          Instellingen → Meldingen op je iPhone, of via de site-instellingen van
          je browser, en herlaad daarna de app.
        </p>
      ) : availability === "unsupported" ? (
        <p className="empty">Meldingen worden in deze browser niet ondersteund.</p>
      ) : (
        <button
          className={`btn ${enabled ? "" : "btn--primary"}`}
          disabled={busy || enabled == null}
          onClick={toggle}
        >
          {enabled == null
            ? "Controleren…"
            : enabled
              ? "Meldingen uitzetten"
              : "Meldingen aanzetten"}
        </button>
      )}
      {/* Per-type voorkeuren (#57): server-side, gelden voor ál je apparaten —
          daarom ook zichtbaar als push op dít apparaat niet kan of uit staat. */}
      <h3 className="card__title card__title--section">Welke meldingen wil je?</h3>
      <p className="card__subtitle">
        {availability === "ready"
          ? "De knop hierboven regelt dít apparaat; deze keuzes gelden voor al je apparaten."
          : "Deze keuzes gelden voor al je apparaten."}
      </p>
      {prefs.loading || !np ? (
        <Skeleton rows={4} />
      ) : (
        <div className="stack">
          {NOTIFY_OPTIES.map((o) => (
            <label key={o.key} className="toggle-row">
              <span className="toggle-row__text">
                <span className="toggle-row__label">{o.label}</span>
                <span className="toggle-row__hint">{o.hint}</span>
              </span>
              <input
                type="checkbox"
                checked={np[o.key]}
                disabled={prefsBusy}
                onChange={(e) => setPref({ [o.key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Weergave (thema) ---------- */
const THEMA_OPTIES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Systeem" },
  { value: "light", label: "Licht" },
  { value: "dark", label: "Donker" },
];

function ThemeCard({
  userId,
  toonWaarnemend,
  dictatorPortret,
  onUpdated,
}: {
  userId: string;
  /** Huidige waarde uit het profiel (#542); default zichtbaar. */
  toonWaarnemend: boolean;
  /** AI dictator-portret opt-out (#554); default aan. */
  dictatorPortret: boolean;
  onUpdated: () => void;
}) {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function choose(next: ThemePreference) {
    setPref(next);
    // Past direct toe én bewaart in localStorage (src/lib/theme.ts).
    setThemePreference(next);
  }

  // Cosmetische voorkeur (#542): cross-device in de profiles-kolom, zodat het
  // ook op je andere apparaten geldt (anders dan het thema, dat per apparaat is).
  async function toggleMbappe(zichtbaar: boolean) {
    setBusy(true);
    try {
      await updateProfile(userId, { toon_waarnemend_dictator: zichtbaar });
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // AI dictator-portret opt-out (#554): staat dit uit, dan gaat je profielfoto
  // nooit naar OpenAI en toont De Troon je gewone avatar. Cross-device via de
  // profiles-kolom.
  async function toggleDictatorPortret(aan: boolean) {
    setBusy(true);
    try {
      await updateProfile(userId, { dictator_portret: aan });
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">Weergave</h2>
      <p className="card__subtitle">
        Kies licht of donker, of volg automatisch je systeeminstelling.
      </p>
      <div className="tabs" role="radiogroup" aria-label="Thema">
        {THEMA_OPTIES.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pref === o.value}
            className={`tab ${pref === o.value ? "is-active" : ""}`}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="toggle-row">
        <span className="toggle-row__text">
          <span className="toggle-row__label">Waarnemend dictator 🫡</span>
          <span className="toggle-row__hint">
            Toont Kylian Mbappé bovenaan het klassement zolang niemand de
            El Padelissimo-tier haalt. Puur cosmetisch — zet uit als je hem
            liever niet ziet; de dictator-divisie zelf blijft gewoon bestaan.
          </span>
        </span>
        <input
          type="checkbox"
          checked={toonWaarnemend}
          disabled={busy}
          onChange={(e) => toggleMbappe(e.target.checked)}
        />
      </label>
      <label className="toggle-row">
        <span className="toggle-row__text">
          <span className="toggle-row__label">Dictator-portret 🎨</span>
          <span className="toggle-row__hint">
            Kom je in de buurt van de troon, dan maakt een AI van je foto een
            militair dictator-portret (via OpenAI) voor op De Troon. Zet uit als
            je je foto liever niet laat versturen — dan blijft je gewone avatar
            staan.
          </span>
        </span>
        <input
          type="checkbox"
          checked={dictatorPortret}
          disabled={busy}
          onChange={(e) => toggleDictatorPortret(e.target.checked)}
        />
      </label>
    </section>
  );
}

/* ---------- Privacy ---------- */
function PrivacyCard({ userId }: { userId: string }) {
  const toast = useToast();
  const privacy = useAsync(() => getPrivacy(userId), [userId]);
  const [busy, setBusy] = useState(false);

  async function set(patch: Partial<Privacy>) {
    setBusy(true);
    try {
      await updatePrivacy(userId, patch);
      toast.success("Privacy bijgewerkt.");
      privacy.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const p = privacy.data;

  return (
    <section className="card">
      <h2 className="card__title card__title--tight">Privacy</h2>
      <p className="card__subtitle">
        Kies wie je kan vinden en verzoeken mag sturen.
      </p>
      {privacy.loading || !p ? (
        <Skeleton rows={2} />
      ) : (
        <div className="stack">
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">Vindbaar in zoeken</span>
              <span className="toggle-row__hint">
                Anderen kunnen je op gebruikersnaam vinden.
              </span>
            </span>
            <input
              type="checkbox"
              checked={p.discoverable}
              disabled={busy}
              onChange={(e) => set({ discoverable: e.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">
                Vriendschapsverzoeken toestaan
              </span>
              <span className="toggle-row__hint">
                Zet uit om geen nieuwe verzoeken te ontvangen.
              </span>
            </span>
            <input
              type="checkbox"
              checked={p.allow_friend_requests}
              disabled={busy}
              onChange={(e) => set({ allow_friend_requests: e.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">Roast-schild 🛡️</span>
              <span className="toggle-row__hint">
                Zet aan als je niet geroast wilt worden: pias, feed en profiel
                tonen dan een neutrale variant zonder spot.
              </span>
            </span>
            <input
              type="checkbox"
              checked={p.roast_schild}
              disabled={busy}
              onChange={(e) => set({ roast_schild: e.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">Roast-intensiteit 🎙️</span>
              <span className="toggle-row__hint">
                Hoe hard Coach Rudy jóu in je eigen feed en dashboard toespreekt.
                De toon binnen een groep bepaalt de eigenaar apart. Zet je het
                roast-schild aan, dan word je hoe dan ook gespaard.
              </span>
            </span>
            <select
              className="select"
              aria-label="Roast-intensiteit"
              value={p.roast_intensiteit}
              disabled={busy || p.roast_schild}
              onChange={(e) =>
                set({ roast_intensiteit: e.target.value as RoastIntensiteit })
              }
            >
              <option value="mild">Mild</option>
              <option value="gemeen">Gemeen</option>
              <option value="radioactief">Geen genade</option>
            </select>
          </label>
        </div>
      )}
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
      <form className="stack account-form" onSubmit={save}>
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
        <div className="form-actions">
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
      <form className="stack account-form" onSubmit={save}>
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
              aria-describedby="new-password-hint"
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
        <p className="field-hint" id="new-password-hint">
          Minstens 6 tekens.
        </p>
        <div className="form-actions">
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
