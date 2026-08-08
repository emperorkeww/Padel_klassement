// Adminpaneel (#1036): één scherm om gebruikers op te volgen.
//
// Zes tabbladen: gebruikers, gasten en groepen (accounts, #1036), matches en
// het logboek (inhoud, #1159), en de systeemgezondheid (#1049). Gebruikers,
// gasten, groepen en systeem praten met de edge function `admin-users`, matches
// en logboek met `admin-content`; zie ./api.
//
// Twee dingen om in het oog te houden bij het uitbreiden:
//  1. Geen enkele query loopt buiten ./api om. app_admins en admin_audit_log
//     hebben geen client-grant en de overzichts-RPC's zijn service-role-only —
//     een `supabase.from(...)` hier levert een 42501 op.
//  2. Het toegangsscherm is ergonomie, geen beveiliging. De edge function
//     weigert een niet-beheerder sowieso; dit voorkomt enkel dat iemand naar
//     een leeg scherm staart.

import { useMemo, useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { usePageTitle } from "@/lib/hooks/usePageTitle";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { PageTabs, TabPanel } from "@/ui/PageTabs";
import { lijstGebruikers } from "./api";
import { pasFiltersToe, zoekGebruikers, type AdminFilterId } from "./adminFilters";
import { useIsAdmin } from "./useIsAdmin";
import { GebruikersTabel } from "./components/GebruikersTabel";
import { GebruikerPaneel } from "./components/GebruikerPaneel";
import { AdminFilters } from "./components/AdminFilters";
import { GastenTab } from "./components/GastenTab";
import { GroepenTab } from "./components/GroepenTab";
import { MatchesTab } from "./components/MatchesTab";
import { SysteemTab } from "./components/SysteemTab";
import { LogboekTab } from "./components/LogboekTab";
import type { AdminGebruiker } from "./types";
import "./AdminPaneel.css";

type Tab =
  | "gebruikers"
  | "gasten"
  | "groepen"
  | "matches"
  | "systeem"
  | "logboek";

export function AdminPaneel() {
  usePageTitle("Beheer");
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("gebruikers");
  const [zoek, setZoek] = useState("");
  const [filters, setFilters] = useState<AdminFilterId[]>([]);
  const [gekozen, setGekozen] = useState<AdminGebruiker | null>(null);

  // `enabled` houdt de aanroep tegen zolang we geen beheerder zijn. Dat is de
  // acceptatie-eis "de route toont Geen toegang zónder data te laden": zonder
  // deze vlag zou useAsync bij mount al fetchen en pas daarna afgewezen worden.
  const gebruikers = useAsync(lijstGebruikers, [], { enabled: isAdmin === true });

  const alle = useMemo(() => gebruikers.data ?? [], [gebruikers.data]);

  const zichtbaar = useMemo(
    // Het ijkmoment komt hier vandaan en niet uit een gedeelde state: het enige
    // datumfilter is "laatste 7 dagen", en of die grens een paar milliseconden
    // verschilt tussen de lijst en een chipteller maakt niets uit.
    () => pasFiltersToe(zoekGebruikers(alle, zoek), filters, Date.now()),
    [alle, zoek, filters],
  );

  // De teller op een chip toont wat dát filter alléén zou overhouden, los van
  // de andere chips — anders lees je op een aangevinkte chip een 0 zodra een
  // ander filter de lijst al leeggetrokken heeft, en lijkt hij kapot.
  const telFilter = (id: AdminFilterId) =>
    pasFiltersToe(alle, [id], Date.now()).length;

  const wisselFilter = (id: AdminFilterId) =>
    setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  if (isAdmin === null) {
    return (
      <main className="admin">
        <h1 className="admin__titel">Beheer</h1>
        <Skeleton rows={4} />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin">
        <h1 className="admin__titel">Beheer</h1>
        <EmptyState icon="🔒" title="Geen toegang">
          Deze pagina is alleen voor beheerders van de app.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="admin">
      <h1 className="admin__titel">Beheer</h1>
      <PageTabs
        tabs={[
          { id: "gebruikers", label: "Gebruikers", count: alle.length },
          { id: "gasten", label: "Gasten" },
          { id: "groepen", label: "Groepen" },
          { id: "matches", label: "Matches" },
          { id: "systeem", label: "Systeem" },
          { id: "logboek", label: "Logboek" },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Beheeronderdelen"
        idPrefix="admin"
      />

      <TabPanel id={tab} idPrefix="admin">
        {tab === "gebruikers" && (
          <>
            <label className="admin__zoek">
              <span className="sr-only">
                Zoek op naam, gebruikersnaam of e-mail
              </span>
              <input
                className="input"
                type="search"
                placeholder="Zoek op naam, gebruikersnaam of e-mail…"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
              />
            </label>

            <AdminFilters
              actief={filters}
              onWissel={wisselFilter}
              telFilter={telFilter}
            />

            {gebruikers.loading && <Skeleton rows={6} />}

            {gebruikers.error && (
              <ErrorRetry melding={gebruikers.error} onRetry={gebruikers.reload} />
            )}

            {!gebruikers.loading && !gebruikers.error && (
              <>
                <p className="admin__telling" role="status">
                  {zichtbaar.length} van {alle.length} accounts
                </p>
                {zichtbaar.length === 0 ? (
                  <EmptyState icon="🔍" title="Niemand gevonden">
                    Geen account dat aan deze zoekterm en filters voldoet.
                  </EmptyState>
                ) : (
                  <GebruikersTabel gebruikers={zichtbaar} onKies={setGekozen} />
                )}
              </>
            )}
          </>
        )}

        {/* De tabbladen laden hun eigen data, en pas als je ze opent: op een
            telefoon is dit paneel geen plek waar je drie lijsten tegelijk
            binnenhaalt. */}
        {tab === "gasten" && <GastenTab />}
        {tab === "groepen" && <GroepenTab />}
        {tab === "matches" && <MatchesTab />}
        {tab === "systeem" && <SysteemTab />}
        {tab === "logboek" && <LogboekTab />}
      </TabPanel>

      {gekozen && (
        <GebruikerPaneel
          gebruiker={gekozen}
          onSluit={() => setGekozen(null)}
          onGewijzigd={gebruikers.reload}
        />
      )}
    </main>
  );
}

export default AdminPaneel;
