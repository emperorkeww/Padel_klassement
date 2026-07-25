import { Suspense, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
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
import { GithubRibbon } from "@/app/GithubRibbon";
import { OfflineBanner } from "@/ui/OfflineBanner";
import "@/ui/ui.css";
import "./DashboardLayout.css";

// `matchPaths`: extra padprefixen die dezelfde sectie zijn maar buiten `to`
// vallen. Nodig omdat groepdetail op /groepen/:id leeft terwijl de Spelen-hub
// /spelen is — zonder dit verliest "Spelen" zijn markering in een groep (#287).
type NavItem = { to: string; label: string; end?: boolean; icon: ReactNode; matchPaths?: string[] };

// Actief als NavLink het al vindt (exacte/prefix-match op `to`), óf als het
// pad binnen een van de opgegeven sectiepaden valt.
function isSectionActive(item: NavItem, isActive: boolean, pathname: string) {
  return (
    isActive ||
    (item.matchPaths?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false)
  );
}

// Taakgerichte navigatie (#106): vier taken i.p.v. zeven datatabellen.
// Matches is het primaire schrijf-scherm (plannen + loggen + "Te spelen"), dus
// het heet gewoon "Matches" — gelijk aan de pagina-H1 — en staat als vaste tab
// op mobiel (#274). Banen blijft bereikbaar bínnen de flow (Spelen-hub/zijbalk).
const OVERZICHT: NavItem = { to: "/", label: "Overzicht", end: true, icon: <BallIcon size={22} /> };
const SPELEN: NavItem = { to: "/spelen", label: "Spelen", icon: <IconRacket />, matchPaths: ["/groepen"] };
const FEED: NavItem = { to: "/feed", label: "Feed", icon: <IconFeed /> };
const KLASSEMENT: NavItem = { to: "/klassement", label: "Klassement", icon: <IconTrophy /> };
const IK: NavItem = { to: "/profiel", label: "Ik", icon: <IconUser /> };
const MATCHES: NavItem = { to: "/matches", label: "Matches", icon: <IconMatch /> };
const BANEN: NavItem = { to: "/banen", label: "Banen", icon: <IconCourt /> };
const VRIENDEN: NavItem = { to: "/vrienden", label: "Vrienden", icon: <IconUserPlus /> };
const KLIKKER: NavItem = { to: "/klikker", label: "Klikker", icon: <IconNotebook /> };

// Desktop: gegroepeerde zijbalk, met de secundaire routes erbij.
// De Klikker (#260) is een speeltje, geen taak — eigen "Coach"-groepje onder de
// competitie. Bewust niet in de mobiele TABBAR (vaste 5-tabs-symmetrie, #274);
// mobiel is hij vindbaar via de Coach Rudy-uitleg (CoachAbout).
const SIDEBAR_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Spelen", items: [OVERZICHT, FEED, SPELEN, MATCHES, BANEN] },
  { title: "Competitie", items: [KLASSEMENT] },
  { title: "Coach", items: [KLIKKER] },
  { title: "Ik", items: [VRIENDEN, IK] },
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
      {/* Mobiele topbalk: merk links, eigen avatar (naar profiel) rechts. */}
      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Naar overzicht">
          <BallIcon size={22} />
          <span>Vamos!</span>
        </Link>
        <Link to="/profiel" className="topbar__profile" aria-label="Naar profiel">
          <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={32} />
        </Link>
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
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.title} className="sidebar__group">
              <span className="sidebar__group-title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  viewTransition
                  className={({ isActive }) =>
                    `sidebar__link ${isSectionActive(item, isActive, pathname) ? "is-active" : ""}`
                  }
                >
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__foot">
          <Link to="/profiel" className="sidebar__user">
            <Avatar profile={me} name={me ? undefined : (user?.email ?? "?")} size={36} />
            <span className="sidebar__user-text">
              <span className="sidebar__user-name">
                {me ? displayName(me) : (user?.email ?? "")}
              </span>
              <span className="sidebar__user-mail" title={user?.email ?? ""}>
                {user?.email}
              </span>
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
              op mobiel niet weg. Een neutrale, tekstloze skeleton voorkomt de
              sprong van "Laden…" naar de pagina-eigen skeletons. */}
          <Suspense
            fallback={
              <div className="route-skeleton" aria-hidden="true">
                <div className="route-skeleton__bar route-skeleton__bar--title" />
                <div className="route-skeleton__bar route-skeleton__bar--sub" />
                <div className="route-skeleton__card" />
                <div className="route-skeleton__card" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
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
        {TABBAR.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            viewTransition
            aria-label={item.label}
            className={({ isActive }) =>
              `tabbar__link ${item.end ? "tabbar__link--home" : ""} ${isSectionActive(item, isActive, pathname) ? "is-active" : ""}`
            }
          >
            <span className="tabbar__icon">{item.icon}</span>
            <span className="tabbar__label">{item.label}</span>
          </NavLink>
        ))}
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

// Klikker: notitieboekje met pen — Rudi's tactische kladblok.
function IconNotebook() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 7h2M5 12h2M5 17h2" />
      <path d="m11 14 5.5-5.5 2 2L13 16l-2.6.6L11 14Z" />
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

export default DashboardLayout;
