import { Suspense, useMemo, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAsync } from "@/lib/hooks/useAsync";
import { getProfile, displayName } from "@/features/profiles/api";
import { useTierAnnouncement } from "@/features/standings/useTierAnnouncement";
import { useBadgeAnnouncement } from "@/features/standings/useBadgeAnnouncement";
import { PackOpening } from "@/features/standings/components/PackOpening";
import { featuredPlaystyles } from "@/features/profiles/badges";
import { useStreakAnnouncement } from "@/features/standings/useStreakAnnouncement";
import { useMissionCelebration } from "@/features/dashboard/useMissionCelebration";
import { useOutboxFlush } from "@/features/matches/useOutbox";
import { Avatar } from "@/ui/Avatar";
import { BallIcon } from "@/ui/BallIcon";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { RouteSkeleton } from "./RouteSkeleton";
import { GithubRibbon } from "@/app/GithubRibbon";
import { HelpKnop } from "@/features/uitleg/components/HelpKnop";
import { JokerKnop } from "@/features/matches/components/JokerKnop";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { OfflineBanner } from "@/ui/OfflineBanner";
import "@/ui/ui.css";
import "./DashboardLayout.css";

// `matchPaths`: extra padprefixen die dezelfde sectie zijn maar buiten `to`
// vallen. Nodig omdat groepdetail op /groepen/:id leeft terwijl de Spelen-hub
// /spelen is — zonder dit verliest "Spelen" zijn markering in een groep (#287).
type NavItem = { to: string; label: string; end?: boolean; icon: ReactNode; matchPaths?: string[] };

// Actief als het pad op `to` matcht (exact bij `end`, anders als prefix), óf
// als het binnen een van de opgegeven sectiepaden valt.
//
// Dit deed NavLink eerder half zelf via zijn `isActive`, maar `aria-current`
// accepteert geen render-prop: een groepsdetail kleurde "Spelen" wél actief en
// bleef voor een screenreader stil (#910). Eén berekening voedt nu zowel de
// class als `aria-current`.
function isSectionActive(item: NavItem, pathname: string) {
  const opZichzelf = item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
  return (
    opZichzelf ||
    (item.matchPaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false)
  );
}

// Taakgerichte navigatie (#106): vier taken i.p.v. zeven datatabellen.
// Matches is het primaire schrijf-scherm (plannen + loggen + "Te spelen"), dus
// het heet gewoon "Matches" — gelijk aan de pagina-H1 — en staat als vaste tab
// op mobiel (#274). Banen blijft bereikbaar bínnen de flow (Spelen-hub/zijbalk).
const OVERZICHT: NavItem = { to: "/", label: "Overzicht", end: true, icon: <BallIcon size={22} /> };
const SPELEN: NavItem = { to: "/spelen", label: "Spelen", icon: <IconRacket />, matchPaths: ["/groepen"] };
const FEED: NavItem = { to: "/clubblad", label: "Clubblad", icon: <IconFeed /> };
const KLASSEMENT: NavItem = { to: "/klassement", label: "Klassement", icon: <IconTrophy /> };
const IK: NavItem = { to: "/profiel", label: "Ik", icon: <IconUser /> };
const MATCHES: NavItem = { to: "/matches", label: "Matches", icon: <IconMatch /> };
const BANEN: NavItem = { to: "/banen", label: "Banen", icon: <IconCourt /> };
const VRIENDEN: NavItem = { to: "/vrienden", label: "Vrienden", icon: <IconUserPlus /> };
// De uitlegpagina (#989) hoort op desktop bij de vaste navigatie in plaats van
// als losse knop: de topbalk waarin de ?-knop op mobiel staat is hier verborgen.
const UITLEG: NavItem = { to: "/uitleg", label: "Hoe werkt het?", icon: <IconHelp /> };
// Beheer (#1036): alleen zichtbaar voor wie in app_admins staat. Enige plek in
// de navigatie met een voorwaarde; houd het bij deze ene vorm in plaats van er
// een generiek `zichtbaarAls`-mechanisme voor te bouwen. Verbergen is géén
// beveiliging — de route en de edge function weigeren zelfstandig.
const BEHEER: NavItem = { to: "/admin", label: "Beheer", icon: <IconShield /> };

// Desktop: gegroepeerde zijbalk, met de secundaire routes erbij.
const SIDEBAR_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Spelen", items: [OVERZICHT, FEED, SPELEN, MATCHES, BANEN] },
  { title: "Competitie", items: [KLASSEMENT] },
  { title: "Ik", items: [VRIENDEN, IK, UITLEG] },
];

// Mobiel: vijf tabs, symmetrisch rond de uitstekende padelbal in het midden
// (2 links · bal · 2 rechts). Links de speel-acties (Spelen · Matches), rechts
// competitie/sociaal (Klassement · Feed). Matches krijgt hier een vaste plek
// als primair schrijf-scherm (#274); Vrienden schuift naar de zijbalk en is nog
// één tik weg via de avatar/profiel en de "verzoeken"-chip op het overzicht.
const TABBAR: NavItem[] = [SPELEN, MATCHES, OVERZICHT, KLASSEMENT, FEED];

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const myId = user?.id ?? "";
  // Eigen profiel voor de avatar in topbalk en zijbalk-voet; de layout blijft
  // gemount tijdens navigatie, dus dit is één query per sessie.
  const profile = useAsync(
    () => (myId ? getProfile(myId) : Promise.resolve(null)),
    [myId],
  );
  const me = profile.data ?? null;
  // Beheer-ingang (#1036). Eén whoami per sessie (gecachet in ./admin/api),
  // niet-blokkerend: zolang het antwoord uitblijft is `isAdmin` null en staat
  // het item er gewoon niet. Deze layout mount één keer per sessie, dus dit is
  // de enige plek in de app die het vraagt.
  const isAdmin = useIsAdmin();
  const sidebarGroepen = useMemo(
    () =>
      isAdmin
        ? SIDEBAR_GROUPS.map((g) =>
            g.title === "Ik" ? { ...g, items: [...g.items, BEHEER] } : g,
          )
        : SIDEBAR_GROUPS,
    [isAdmin],
  );
  // Tier-promotie/degradatie (#127): één app-brede melding zodra een uitslag
  // je rating over een divisiegrens tilt. Een promotie komt sinds #500 als
  // pack-opening (overlay onderaan deze layout); degradatie blijft een toast.
  const { pack: tierPack, sluitPack } = useTierAnnouncement(
    myId,
    me?.roast_schild ?? false,
  );
  // Zeldzame badge (#615): paars pack zodra een curated badge behaald raakt.
  // Bij een botsing met een promotie uit dezelfde uitslag wint het gouden pack;
  // de badge-hook houdt zijn pack vast, dus na "Verder" volgt het paarse.
  const { pack: badgePack, sluitPack: sluitBadgePack } = useBadgeAnnouncement(
    myId,
    me?.roast_schild ?? false,
  );
  const pack = tierPack ?? badgePack;
  // Streak-mijlpaal (#300): één app-brede Rudy-toast zodra een winst-/verlies-
  // reeks precies 3, 5 of 10 raakt — jubel bij winst, sneer bij verlies.
  useStreakAnnouncement(myId, me?.roast_schild ?? false);
  // Weekmissie-confetti (#414): één app-brede viering op het moment dat een
  // missie behaald raakt — niet bij een latere, aanleidingsloze dashboardview.
  useMissionCelebration(myId);
  // Offline-wachtrij legen (#462): één keer bij opstarten en bij elke
  // herverbinding worden gequeuede matches alsnog verstuurd.
  useOutboxFlush();

  return (
    <div className="shell">
      {/* Eerste tab-stop: sla de navigatie over, spring naar de inhoud. */}
      <a href="#content" className="skip-link">
        Naar inhoud
      </a>
      {/* Open source-signaal: schuine GitHub-ribbon in de rechterbovenhoek
          (#252). Enkel op desktop; op mobiel staat daar de avatar. */}
      <GithubRibbon />
      {/* Mobiele topbalk: merk links, de ?-knop en de eigen avatar rechts.
          De ?-knop is de vaste ingang naar "Hoe werkt het?" (#989) en springt
          waar mogelijk naar de sectie van het scherm waar je nú staat. Op
          desktop staat diezelfde ingang in de zijbalk hieronder. */}
      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Naar overzicht">
          <BallIcon size={22} />
          <span>Vamos!</span>
        </Link>
        <div className="topbar__acties">
          {/* Jokerstatus (#1003): ligt je kaart van deze maand er nog? Vast in
              de shell, want daarop plan je je speeldag — niet iets waarvoor je
              eerst een wedstrijdkaart moet openen. */}
          <JokerKnop myId={myId || null} />
          <HelpKnop />
          <Link to="/profiel" className="topbar__profile" aria-label="Naar profiel">
            <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={32} />
          </Link>
        </div>
      </header>

      {/* Zichtbare offline-status op elke beschermde route (#462). */}
      <OfflineBanner />

      {/* Desktop-zijbalk met gegroepeerde navigatie. */}
      <aside className="sidebar">
        <Link to="/" className="sidebar__brand" aria-label="Naar overzicht">
          <BallIcon size={26} />
          <span>Vamos!</span>
        </Link>

        <nav className="sidebar__nav" aria-label="Hoofdnavigatie">
          {sidebarGroepen.map((group) => (
            <div key={group.title} className="sidebar__group">
              <span className="sidebar__group-title">{group.title}</span>
              {group.items.map((item) => {
                const actief = isSectionActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    viewTransition
                    aria-current={actief ? "page" : undefined}
                    className={`sidebar__link ${actief ? "is-active" : ""}`}
                  >
                    <span className="sidebar__icon">{item.icon}</span>
                    <span className="sidebar__label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          {/* Dezelfde status op desktop, zodat de voorraad geen mobiel-only
              kennis wordt — net als de ?-knop, die hierboven in de navigatie
              staat. */}
          <JokerKnop myId={myId || null} className="sidebar__joker" />
          <Link to="/profiel" className="sidebar__user">
            <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={36} />
            {/* Zolang het profiel nog laadt is de naam het e-mailadres, en
                dan stond datzelfde adres er twee keer (#949). De tweede regel
                verschijnt pas als hij iets toevoegt. */}
            <span className="sidebar__user-text">
              <span className="sidebar__user-name">
                {me ? displayName(me) : (user?.email ?? "")}
              </span>
              {me && (
                <span className="sidebar__user-mail" title={user?.email ?? ""}>
                  {user?.email}
                </span>
              )}
            </span>
          </Link>
          <button className="sidebar__signout" onClick={() => signOut()}>
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="content" id="content" tabIndex={-1}>
        <div className="content__inner">
          {/* Suspense hier (i.p.v. rond alle routes) houdt de balken gemount
              tijdens het lazy-laden van een pagina — zo springt de navigatie
              op mobiel niet weg. De skeleton is tekstloos en volgt sinds #949
              de vorm van de route die geladen wordt, zodat de echte layout er
              niet overheen ploft.
              Om dezelfde reden staat hier óók een foutgrens (#733): crasht een
              pagina, dan blijft de shell eromheen staan en is de gebruiker één
              tik van een werkende pagina verwijderd. De pathname als resetKey
              wist de fout zodra je wegnavigeert. */}
          <ErrorBoundary scope="pagina" resetKey={pathname}>
            <Suspense fallback={<RouteSkeleton pathname={pathname} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Pack-opening bij hoofdtier-promotie (#500) of zeldzame badge (#615). */}
      <PackOpening
        pack={pack}
        naam={me ? displayName(me) : ""}
        avatar={
          <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={76} />
        }
        playstyles={featuredPlaystyles(me?.featured_badges)}
        onClose={tierPack ? sluitPack : sluitBadgePack}
      />

      {/* Mobiele onderbalk: vijf tabs met labels, bal in het midden. */}
      <nav className="tabbar" aria-label="Hoofdnavigatie">
        {TABBAR.map((item) => {
          const actief = isSectionActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              viewTransition
              aria-label={item.label}
              aria-current={actief ? "page" : undefined}
              className={`tabbar__link ${item.end ? "tabbar__link--home" : ""} ${actief ? "is-active" : ""}`}
            >
              <span className="tabbar__icon">{item.icon}</span>
              <span className="tabbar__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ---- Iconen (line-stijl, currentColor) ---- */
function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3v1a3 3 0 0 0 3 3M18 6h3v1a3 3 0 0 1-3 3" />
      <path d="M9 20h6M12 14v6" />
    </svg>
  );
}
function IconRacket() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6" />
      <path d="M5.3 13.7 3 21M9.5 5.5v8M5.5 9.5h8" />
    </svg>
  );
}
function IconCourt() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14M3 12h18M7 9.5v5M17 9.5v5" />
    </svg>
  );
}
// Matches: twee gekruiste rackets — "een duel/wedstrijd", duidelijk anders dan
// de enkele racket (Spelen) en de mens-iconen (Vrienden).
function IconMatch() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="3.4" ry="4" transform="rotate(-30 8 8)" />
      <path d="m9.7 11 4.3 8" />
      <ellipse cx="16" cy="8" rx="3.4" ry="4" transform="rotate(30 16 8)" />
      <path d="m14.3 11-4.3 8" />
    </svg>
  );
}
function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 11 0" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}
function IconFeed() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

// Uitleg: het universele vraagteken-in-een-cirkel, zodat de zijbalk-ingang op
// desktop hetzelfde signaal geeft als de ?-knop in de mobiele topbalk (#989).
function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2 19 6v5.4c0 4.2-2.8 7.5-7 9.4-4.2-1.9-7-5.2-7-9.4V6z" />
      <path d="M9.4 12.2l1.9 1.9 3.5-3.7" />
    </svg>
  );
}

export default DashboardLayout;
