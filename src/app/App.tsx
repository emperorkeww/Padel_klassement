import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { DashboardLayout } from "@/app/DashboardLayout";
import { ScrollRestore } from "@/app/ScrollRestore";
import { RedirectMetQuery } from "@/app/RedirectMetQuery";
import { ErrorBoundary } from "@/ui/ErrorBoundary";

// Routes lazy laden zodat elke pagina zijn eigen chunk krijgt.
const LoginScreen = lazy(() => import("@/features/auth/LoginScreen"));
const ResetPassword = lazy(() => import("@/features/auth/ResetPassword"));
const AuthBevestigen = lazy(() => import("@/features/auth/AuthBevestigen"));
const Dashboard = lazy(() => import("@/features/dashboard/Dashboard"));
const Feed = lazy(() => import("@/features/feed/Feed"));
const Leaderboard = lazy(() => import("@/features/standings/Leaderboard"));
const Matches = lazy(() => import("@/features/matches/Matches"));
const Groups = lazy(() => import("@/features/groups/Groups"));
const GroupDetail = lazy(() => import("@/features/groups/GroupDetail"));
const JoinGroup = lazy(() => import("@/features/groups/JoinGroup"));
const Friends = lazy(() => import("@/features/friends/Friends"));
const PlayerProfile = lazy(() => import("@/features/profiles/PlayerProfile"));
const MatchDetail = lazy(() => import("@/features/matches/MatchDetail"));
const ProfileSettings = lazy(() => import("@/features/account/ProfileSettings"));
const Availability = lazy(() => import("@/features/availability/Availability"));
const Agenda = lazy(() => import("@/features/agenda/Agenda"));
const SpeeldagPagina = lazy(() => import("@/features/groups/SpeeldagPagina"));
const Uitleg = lazy(() => import("@/features/uitleg/Uitleg"));
const Meldingen = lazy(() => import("@/features/meldingen/Meldingen"));
const AdminPaneel = lazy(() => import("@/features/admin/AdminPaneel"));
const NotFound = lazy(() => import("@/features/misc/NotFound"));

// Dev-showcase (#664): alle FUT-kaartvarianten naast elkaar. Alleen in
// development geregistreerd; de conditionele import houdt de chunk uit de
// productie-build.
const KaartShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/KaartShowcase"))
  : null;

// Dev-showcase (#771): alle varianten van de dashboard player card naast elkaar,
// om dezelfde reden en op dezelfde voorwaarden als de kaart-showcase hierboven.
const HeroShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/dashboard/components/HeroShowcase"))
  : null;

// Dev-showcase (#940): de kaartenrij onder de hero — volgende match, cijfer-blok
// en baanteaser — met synthetische props, om op 390px te kunnen beoordelen wat
// er in seed-data zelden allemaal tegelijk staat.
const OverzichtShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/dashboard/components/OverzichtShowcase"))
  : null;

// Dev-stage (#834): de In-Form stormkaart op vaste maat, als vast doelwit van
// scripts/storm-screenshot.sh en de ?debugStorm=1-weergave.
const StormShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/StormShowcase"))
  : null;

// Dev-stage voor de On Fire-breakout, met dezelfde vaste screenshotworkflow.
const OnfireShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/OnfireShowcase"))
  : null;

// Dev-stage voor de Dictator-kaart en haar referentiegestuurde breakout.
const DictatorShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/DictatorShowcase"))
  : null;

// Dev-stage voor de Big Daddy-kaart en haar referentiegestuurde breakout.
const BigDaddyShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/BigDaddyShowcase"))
  : null;

// Dev-stage voor de Zwarte Piet-kaart en haar referentiegestuurde breakout.
const PietShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/PietShowcase"))
  : null;

// Dev-stage voor de pias-kaart en haar referentiegestuurde breakout.
const PiasShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/PiasShowcase"))
  : null;

// Dev-stage voor de GOAT-tier en haar referentiegestuurde breakout.
const GoatShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/GoatShowcase"))
  : null;

// Dev-stage voor de Wannabe-divisie en haar referentiegestuurde breakout.
const WannabeShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/WannabeShowcase"))
  : null;

// Dev-stage voor de Glazenwasser-divisie en haar referentiegestuurde breakout.
const GlazenwasserShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/GlazenwasserShowcase"))
  : null;

// Dev-stage voor de Blaaskaak-divisie en haar referentiegestuurde artwork.
const BlaaskaakShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/BlaaskaakShowcase"))
  : null;

// Dev-stage voor de Ballenraper en zijn blauwdrukgestuurde artwork-register.
const BallenraperShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/BallenraperShowcase"))
  : null;

// Dev-stage voor de laagste divisie (slof) en haar referentiegestuurde layout.
const SlofShowcase = import.meta.env.DEV
  ? lazy(() => import("@/features/rating/components/SlofShowcase"))
  : null;

// Dev-stage voor het glasmateriaal (#1062): de vier varianten op zes
// achtergronden, want glas beoordeel je alleen aan wat eronder ligt.
const GlasShowcase = import.meta.env.DEV
  ? lazy(() => import("@/ui/GlasShowcase"))
  : null;

function App() {
  const { pathname } = useLocation();
  return (
    // Boundary buiten Suspense (#733), zodat ook een afgewezen lazy-import
    // erin valt. De pathname als resetKey: wegnavigeren van een kapotte route
    // wist de fout. Dekt de routes buiten de shell (login, reset) en een crash
    // in ProtectedRoute/DashboardLayout zelf; binnen de shell vangt de
    // boundary in DashboardLayout de pagina op zónder de navigatie te lossen.
    <ErrorBoundary scope="route" resetKey={pathname}>
      {/* Buiten Suspense: de restauratie moet blijven draaien terwijl de
          nieuwe route nog aan het laden is (#910). */}
      <ScrollRestore />
      <Suspense fallback={<div className="route-loading">Laden…</div>}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/reset-wachtwoord" element={<ResetPassword />} />
          {/* Landingspagina van elke auth-mail (#1037). Buiten ProtectedRoute:
              er ís nog geen sessie — die ontstaat hier juist. */}
          <Route path="/auth/bevestigen" element={<AuthBevestigen />} />

          {/* Beschermde routes delen de dashboard-shell (topbar + navigatie). */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clubblad" element={<Feed />} />
              <Route path="/feed" element={<Navigate to="/clubblad" replace />} />
              <Route path="/klassement" element={<Leaderboard />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/banen" element={<Availability />} />
              {/* Agenda (#1091): de speeldagen van al je groepen in de tijd. */}
              <Route path="/agenda" element={<Agenda />} />
              {/* Eén speeldag (#1121): de plek waar je hem beheert, en de
                  bestemming van elke deel-link en elk pushbericht erover. De
                  groep hoeft niet in het pad — die staat in de poll. */}
              <Route path="/speeldag/:id" element={<SpeeldagPagina />} />
              {/* "Hoe werkt het?" (#989): de centrale uitleg, bereikbaar via
                  de ?-knop in de shell op elk scherm. */}
              <Route path="/uitleg" element={<Uitleg />} />
              {/* De volledige meldingenlijst (#1090). Het paneel in de shell
                  toont de laatste twintig; hier blader je door. */}
              <Route path="/meldingen" element={<Meldingen />} />
              <Route path="/matches/:id" element={<MatchDetail />} />
              {/* "Spelen" is de hub van de kernreis (#106); de oude
                  groepen-URL blijft werken via een redirect. Die ging tot #916
                  naar ?hub=1, omdat kaal /spelen je bij één groep meteen die
                  groep in stuurde — die uitzondering is er niet meer. */}
              <Route path="/spelen" element={<Groups />} />
              <Route path="/groepen" element={<RedirectMetQuery to="/spelen" />} />
              <Route path="/groepen/join/:token" element={<JoinGroup />} />
              <Route path="/groepen/:id" element={<GroupDetail />} />
              <Route path="/vrienden" element={<Friends />} />
              <Route path="/spelers/:id" element={<PlayerProfile />} />
              <Route path="/profiel" element={<ProfileSettings />} />
              {/* Beheer (#1036). Gewoon een route binnen de shell: het
                  verbergen van het menu-item is geen beveiliging, dus wie het
                  pad intikt zonder rechten krijgt "Geen toegang" te zien en
                  laadt geen enkele gebruiker — de edge function erachter
                  weigert hem sowieso. */}
              <Route path="/admin" element={<AdminPaneel />} />
              {/* Onbekend pad: een echte 404 binnen de shell (#910), zodat de
                  navigatie blijft staan en je ziet wát er misging. Staat
                  binnen ProtectedRoute, dus uitgelogd kom je nog steeds eerst
                  op /login met je bestemming in `state.from`. */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          {KaartShowcase && (
            <Route path="/dev/kaarten" element={<KaartShowcase />} />
          )}
          {HeroShowcase && <Route path="/dev/hero" element={<HeroShowcase />} />}
          {OverzichtShowcase && (
            <Route path="/dev/overzicht" element={<OverzichtShowcase />} />
          )}
          {StormShowcase && (
            <Route path="/dev/storm" element={<StormShowcase />} />
          )}
          {OnfireShowcase && (
            <Route path="/dev/onfire" element={<OnfireShowcase />} />
          )}
          {DictatorShowcase && (
            <Route path="/dev/dictator" element={<DictatorShowcase />} />
          )}
          {BigDaddyShowcase && (
            <Route path="/dev/bigdaddy" element={<BigDaddyShowcase />} />
          )}
          {PietShowcase && (
            <Route path="/dev/piet" element={<PietShowcase />} />
          )}
          {PiasShowcase && (
            <Route path="/dev/pias" element={<PiasShowcase />} />
          )}
          {GoatShowcase && (
            <Route path="/dev/goat" element={<GoatShowcase />} />
          )}
          {WannabeShowcase && (
            <Route path="/dev/wannabe" element={<WannabeShowcase />} />
          )}
          {GlazenwasserShowcase && (
            <Route
              path="/dev/glazenwasser"
              element={<GlazenwasserShowcase />}
            />
          )}
          {BlaaskaakShowcase && (
            <Route path="/dev/blaaskaak" element={<BlaaskaakShowcase />} />
          )}
          {BallenraperShowcase && (
            <Route path="/dev/ballenraper" element={<BallenraperShowcase />} />
          )}
          {SlofShowcase && (
            <Route path="/dev/slof" element={<SlofShowcase />} />
          )}
          {GlasShowcase && (
            <Route path="/dev/glas" element={<GlasShowcase />} />
          )}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
