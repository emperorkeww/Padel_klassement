// Adminpaneel (#1036): één scherm om gebruikers op te volgen.
//
// PR 1 is bewust alleen-lezen. De acties (herstel-link, tijdelijk wachtwoord,
// e-mail corrigeren, uitloggen, verwijderen) en de tabbladen Gasten/Groepen
// volgen in PR 2 en 3; wat hier staat is het fundament waar die op landen.
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
import { lijstGebruikers } from "./api";
import { zoekGebruikers } from "./adminFilters";
import { useIsAdmin } from "./useIsAdmin";
import { GebruikersTabel } from "./components/GebruikersTabel";
import { GebruikerPaneel } from "./components/GebruikerPaneel";
import type { AdminGebruiker } from "./types";
import "./AdminPaneel.css";

export function AdminPaneel() {
  usePageTitle("Beheer");
  const isAdmin = useIsAdmin();
  const [zoek, setZoek] = useState("");
  const [gekozen, setGekozen] = useState<AdminGebruiker | null>(null);

  // `enabled` houdt de aanroep tegen zolang we geen beheerder zijn. Dat is de
  // acceptatie-eis "de route toont Geen toegang zónder data te laden": zonder
  // deze vlag zou useAsync bij mount al fetchen en pas daarna afgewezen worden.
  const gebruikers = useAsync(lijstGebruikers, [], { enabled: isAdmin === true });

  const zichtbaar = useMemo(
    () => zoekGebruikers(gebruikers.data ?? [], zoek),
    [gebruikers.data, zoek],
  );

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
      <p className="admin__intro">
        Alle accounts van de app: wie zich aanmeldde, wie er nooit in kwam en wie
        nog nergens meespeelt.
      </p>

      <label className="admin__zoek">
        <span className="sr-only">Zoek op naam, gebruikersnaam of e-mail</span>
        <input
          className="input"
          type="search"
          placeholder="Zoek op naam, gebruikersnaam of e-mail…"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
      </label>

      {gebruikers.loading && <Skeleton rows={6} />}

      {gebruikers.error && (
        <ErrorRetry melding={gebruikers.error} onRetry={gebruikers.reload} />
      )}

      {!gebruikers.loading && !gebruikers.error && (
        <>
          <p className="admin__telling" role="status">
            {zichtbaar.length} van {gebruikers.data?.length ?? 0} accounts
          </p>
          {zichtbaar.length === 0 ? (
            <EmptyState icon="🔍" title="Niemand gevonden">
              Geen account dat op “{zoek}” lijkt.
            </EmptyState>
          ) : (
            <GebruikersTabel gebruikers={zichtbaar} onKies={setGekozen} />
          )}
        </>
      )}

      {gekozen && (
        <GebruikerPaneel gebruiker={gekozen} onSluit={() => setGekozen(null)} />
      )}
    </main>
  );
}

export default AdminPaneel;
