import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { ProfileSkeleton, Skeleton } from "@/ui/Skeleton";
import { initialen } from "@/lib/utils/initialen";
import { Toggle } from "@/ui/Toggle";
import { AvatarCropper } from "./components/AvatarCropper";
import { snijUit, type Uitsnede } from "./components/avatarCrop";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { useConfirm } from "@/ui/ConfirmDialog";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { UITLEG_PAD } from "@/features/uitleg/secties";
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
  exporteerMijnGegevens,
  type NotificationPrefs,
  type Privacy,
} from "./api";
import { CoachAbout } from "@/features/coach/components/CoachAbout";
import { PASSWORD_RULE, passwordError } from "@/features/auth/authErrors";
import { heeftVuileVorm, useVuileVorm } from "@/lib/hooks/useVuileVorm";
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
// alles onder elkaar. Zelfde tab-patroon als GroupDetail/PlayerProfile. De
// eerste tab heet "Algemeen" (niet "Profiel") om dubbeling met de paginatitel
// en de Vrienden-schakelaar te vermijden.
type SettingsTab = "algemeen" | "privacy" | "account";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "algemeen", label: "Algemeen" },
  { id: "privacy", label: "Meldingen & privacy" },
  { id: "account", label: "Account" },
];

function tabFrom(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((t) => t.id === value)
    ? (value as SettingsTab)
    : "algemeen";
}

export function ProfileSettings() {
  const { user, signOut } = useAuth();
  const myId = user?.id ?? "";
  const profile = useAsync(() => getProfile(myId), [myId]);
  usePageTitle("Instellingen");

  // Actieve tab in de URL (?tab=): deelbaar en refresh-bestendig. De default
  // (profiel) laat de param weg, net als elders in de app.
  const [params, setParams] = useSearchParams();
  const [confirm, confirmUi] = useConfirm();
  const tab = tabFrom(params.get("tab"));
  async function setTab(next: SettingsTab) {
    // Van tab wisselen ontkoppelt de kaarten en gooit dus onopgeslagen werk
    // weg (#921). De hoofdnavigatie kunnen we niet blokkeren — dat vraagt een
    // data-router — maar dít pad loopt door onze eigen code.
    if (
      heeftVuileVorm() &&
      !(await confirm({
        title: "Wijzigingen niet opgeslagen",
        body: "Je hebt iets ingevuld dat nog niet is opgeslagen. Van tab wisselen gooit dat weg.",
        confirmLabel: "Toch wisselen",
        danger: true,
      }))
    )
      return;
    const p = new URLSearchParams(params);
    if (next === "algemeen") p.delete("tab");
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
  if (!profile.data)
    return (
      <ErrorRetry
        melding="Je profiel laden lukte niet."
        onRetry={profile.reload}
      />
    );

  return (
    <div>
      <header className="page-head settings-head">
        {/* Deze pagina heette "Profiel", net als de profielweergave op
            /spelers/:id — de "Ik"-tab en de topbalk-avatar landden hier en je
            kwam nergens meer. Vandaar "Instellingen" als titel én een directe
            link naar je eigen kaart (#706). */}
        <div className="row-between">
          <h1 className="page-title">Instellingen</h1>
          <div className="btn-row">
            <Link className="btn btn--sm" to={`/spelers/${myId}`}>
              Mijn profiel →
            </Link>
            {/* Vrienden is de zusterpagina van het account-gebied; een discrete
                link i.p.v. een tweede tab-rij (#70). Ook op mobiel bereikbaar. */}
            <Link className="btn btn--sm" to="/vrienden">
              Vrienden →
            </Link>
            {/* De tweede, verwachte plek voor de uitleg (#989): de eerste is de
                ?-knop in de shell. Wie iets niet snapt zoekt het als eerste bij
                z'n instellingen. */}
            <Link className="btn btn--sm" to={UITLEG_PAD}>
              Hoe werkt het? →
            </Link>
          </div>
        </div>
        <p className="page-subtitle">Pas je profiel aan. Zorg in ieder geval dat je foto er professioneler uitziet dan je slagen.</p>
      </header>

      {/* Gedeelde tabbalk (#910). */}
      <PageTabs
        tabs={SETTINGS_TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Instellingen"
        idPrefix="instellingen"
      />

      <TabPanel id={tab} idPrefix="instellingen">
        {tab === "algemeen" && (
          <>
            <div className="grid grid--2">
              <AvatarCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
              <NameCard profile={profile.data} userId={myId} onUpdated={profile.reload} />
            </div>
            <ThemeCard
              userId={myId}
              toonWaarnemend={profile.data?.toon_waarnemend_dictator ?? true}
              dictatorPortret={profile.data?.dictator_portret ?? true}
              piasPortret={profile.data?.pias_portret ?? true}
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
              <h2 className="card__title card__title--tight">Over Coach Rudy</h2>
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

            {/* Je eigen gegevens meenemen (#921). Client-side samengesteld:
                RLS bepaalt al wat je mag zien, dus een export-RPC zou dezelfde
                regels nóg een keer moeten formuleren. */}
            <section className="card">
              <div className="row-between">
                <div>
                  <h2 className="card__title card__title--tight">
                    Mijn gegevens
                  </h2>
                  <p className="empty empty--bare">
                    Download alles wat de app over jou bewaart als JSON.
                  </p>
                </div>
                <ExportButton userId={myId} />
              </div>
            </section>

            <p className="profile-meta">Lid sinds {formatDate(profile.data.created_at)}.</p>
          </>
        )}
      </TabPanel>
      {confirmUi}
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
  const [busy, setBusy] = useState(false);
  // Uitsnede en geladen beeld komen uit de cropper; die heeft de blob-URL in
  // beheer (inclusief het vrijgeven ervan, #921).
  const uitsnede = useRef<Uitsnede>({ zoom: 1, x: 0, y: 0 });
  const beeld = useRef<HTMLImageElement | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Kies een afbeelding.");
    if (f.size > 5 * 1024 * 1024) return toast.error("Maximaal 5 MB.");
    setFile(f);
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      // Uitsnijden vóór uploaden: wat je in het kader ziet, is wat er komt te
      // staan — en het scheelt bandbreedte (#921).
      const bron = beeld.current;
      const blob = bron ? await snijUit(bron, uitsnede.current) : file;
      const bestand = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(userId, bestand);
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

  return (
    <section className="card">
      <h2 className="card__title">Profielfoto</h2>
      <div className="avatar-row">
        {file ? (
          <AvatarCropper
            bestand={file}
            onChange={(u, img) => {
              uitsnede.current = u;
              beeld.current = img;
            }}
          />
        ) : (
          <div className="avatar-preview">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profielfoto"
                loading="lazy"
                decoding="async"
              />
            ) : (
              // Dezelfde afleiding als elke andere avatar (#949): hier stond
              // met de hand `slice(0, 1)`, en dus "A" waar de topbalk "AA"
              // toonde voor dezelfde persoon.
              <span>{initialen(displayName(profile))}</span>
            )}
          </div>
        )}
        <div className="stack">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
          <div className="btn-row">
            <button className="btn" onClick={() => inputRef.current?.click()}>
              Foto kiezen
            </button>
            <button className="btn btn--primary" disabled={busy || !file} onClick={save}>
              {busy ? "Uploaden…" : "Opslaan"}
            </button>
            {file && (
              <button className="btn btn--sm" onClick={() => setFile(null)}>
                Annuleren
              </button>
            )}
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
  // Onopgeslagen wijzigingen gingen stil verloren bij een tabwissel (#921).
  const vuil =
    username !== profile.username || fullName !== (profile.full_name ?? "");
  useVuileVorm("naam", vuil);

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
      <div className="row-between">
        <h2 className="card__title">Naam</h2>
        {vuil && <span className="badge badge--accent">Nog niet opgeslagen</span>}
      </div>
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

  // Eén kaart droeg zowel de apparaat-schakelaar als de per-type voorkeuren,
  // en het verschil moest in twee alinea's uitgelegd worden (#921). Nu twee
  // kaarten: het verschil blijkt uit de structuur.
  return (
    <>
    <section className="card">
      <h2 className="card__title card__title--tight">Meldingen op dit apparaat</h2>
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
    </section>

    {/* Per-type voorkeuren (#57): server-side, dus voor ál je apparaten —
        daarom ook zichtbaar als push op dít apparaat niet kan of uit staat. */}
    <section className="card">
      <h2 className="card__title card__title--tight">
        Welke meldingen wil je?
      </h2>
      <p className="card__subtitle">Geldt voor al je apparaten.</p>
      {prefs.loading || !np ? (
        <Skeleton rows={4} />
      ) : (
        <div className="stack">
          {NOTIFY_OPTIES.map((o) => (
            <Toggle
              key={o.key}
              label={o.label}
              hint={o.hint}
              checked={np[o.key]}
              disabled={prefsBusy}
              onChange={(aan) => setPref({ [o.key]: aan })}
            />
          ))}
        </div>
      )}
    </section>
    </>
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
  piasPortret,
  onUpdated,
}: {
  userId: string;
  /** Huidige waarde uit het profiel (#542); default zichtbaar. */
  toonWaarnemend: boolean;
  /** AI dictator-portret opt-out (#554); default aan. */
  dictatorPortret: boolean;
  /** AI pias-portret opt-out (#682); default aan. */
  piasPortret: boolean;
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

  // AI pias-portret opt-out (#682): los van de dictator — als generalissimo op de
  // troon verschijnen betekent niet dat je ook als hofnar aan de schandpaal wil
  // hangen. Uitzetten nult ook het bewaarde portret (guard-trigger), dus je foto
  // verdwijnt echt i.p.v. onzichtbaar bewaard te blijven.
  async function togglePiasPortret(aan: boolean) {
    setBusy(true);
    try {
      await updateProfile(userId, { pias_portret: aan });
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
      <Toggle
        label="Waarnemend dictator 🫡"
        hint="Kylian Mbappé bezet de troon zolang niemand El Padelissimo haalt. Puur cosmetisch."
        checked={toonWaarnemend}
        disabled={busy}
        onChange={toggleMbappe}
      />
      <Toggle
        label="Dictator-portret"
        hint="Bij de troon maakt een AI (OpenAI) een dictator-portret van je foto. Uit = je gewone avatar."
        checked={dictatorPortret}
        disabled={busy}
        onChange={toggleDictatorPortret}
      />
      <Toggle
        label="Pias-portret"
        hint="Als pias maakt een AI (OpenAI) een hofnar-portret van je foto. Uit = je gewone avatar; met roast-schild gebeurt het sowieso niet."
        checked={piasPortret}
        disabled={busy}
        onChange={togglePiasPortret}
      />
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
          <Toggle
            label="Vindbaar in zoeken"
            hint="Uit = je verschijnt niet in zoekresultaten, vriendsuggesties of keuzelijsten waarin iemand je zou kunnen ontdekken. Je blijft zichtbaar waar je al meedoet — klassement, je matches en je groepen — en voor je vrienden en groepsgenoten."
            checked={p.discoverable}
            disabled={busy}
            onChange={(aan) => set({ discoverable: aan })}
          />
          <Toggle
            label="Vriendschapsverzoeken toestaan"
            hint="Zet uit om geen nieuwe verzoeken te ontvangen. Je verdwijnt dan ook uit “Misschien ken je” bij anderen, zodat niemand op een knop drukt die toch afketst."
            checked={p.allow_friend_requests}
            disabled={busy}
            onChange={(aan) => set({ allow_friend_requests: aan })}
          />
          <Toggle
            label="Roast-schild 🛡️"
            hint="Pias, clubblad en profiel tonen dan een neutrale variant zonder spot."
            checked={p.roast_schild}
            disabled={busy}
            onChange={(aan) => set({ roast_schild: aan })}
          />
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">Roast-intensiteit 🎙️</span>
              <span className="toggle-row__hint">
                Hoe hard Coach Rudy jóu in je eigen clubblad en dashboard toespreekt.
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
  const vuil = email.trim().length > 0;
  useVuileVorm("email", vuil);

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
  const vuil = !!(current || next || confirm);
  useVuileVorm("wachtwoord", vuil);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Eén verhaal over dezelfde regel (#921): het loginscherm gebruikte
    // PASSWORD_RULE/passwordError, deze kaart hardcodeerde "6 tekens".
    const fout = passwordError(next);
    if (fout) return toast.error(fout);
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
      <div className="row-between">
        <h2 className="card__title">Wachtwoord</h2>
        {vuil && <span className="badge badge--accent">Nog niet opgeslagen</span>}
      </div>
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
          {PASSWORD_RULE}
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

/* ---------- Gegevens exporteren (#921) ---------- */
function ExportButton({ userId }: { userId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = await exporteerMijnGegevens(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vamos-gegevens-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      // Zonder dit blijft de blob hangen tot de pagina herlaadt — dezelfde
      // fout die de avatar-preview maakte.
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn" disabled={busy} onClick={download}>
      {busy ? "Verzamelen…" : "Download mijn gegevens"}
    </button>
  );
}
