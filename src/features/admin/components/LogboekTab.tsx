import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { auditRecent } from "../api";
import { auditDetails, auditLabel } from "../auditLabels";

// Het volledige auditspoor (#1159).
//
// Het per-gebruiker-logboek in GebruikerPaneel beantwoordt "wat is er met deze
// persoon gebeurd". Sinds de beheerder ook aan matches, groepen en polls kan
// komen, is er een tweede vraag die geen gebruiker als onderwerp heeft: wat is
// er de laatste tijd gebeurd, door wie? Zonder dit tabblad zouden juist de
// ingrijpendste acties — een uitslag corrigeren in andermans groep — alleen in
// de databank terug te vinden zijn.

const LIMIET = 100;

function datumTijd(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DOEL_LABEL: Record<string, string> = {
  match: "match",
  group: "groep",
  poll: "speeldag",
};

export function LogboekTab() {
  const regels = useAsync(() => auditRecent(LIMIET), []);

  if (regels.loading) return <Skeleton rows={6} />;
  if (regels.error) {
    return <ErrorRetry melding={regels.error} onRetry={regels.reload} />;
  }
  if (!regels.data || regels.data.length === 0) {
    return (
      <EmptyState icon="📋" title="Nog niets gebeurd">
        Zodra er iets vanuit dit paneel gebeurt, staat het hier.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="admin__telling" role="status">
        {regels.data.length === LIMIET
          ? `De laatste ${LIMIET} handelingen`
          : `${regels.data.length} handeling${regels.data.length === 1 ? "" : "en"}`}
      </p>

      <ul className="admin-lijst">
        {regels.data.map((r) => {
          const details = auditDetails(r.details);
          return (
            <li key={r.id} className="admin-lijst__rij admin-lijst__rij--stapel">
              <span>
                <strong>{auditLabel(r.action)}</strong>
                {r.target_username && ` — @${r.target_username}`}
                {!r.target_username && r.target_type && (
                  <span className="admin-tabel__username">
                    {" "}
                    ({DOEL_LABEL[r.target_type] ?? r.target_type})
                  </span>
                )}
                {details && (
                  <span className="admin-tabel__username"> {details}</span>
                )}
              </span>
              <span className="admin-audit__meta">
                {datumTijd(r.created_at)}
                {r.actor_username ? ` · ${r.actor_username}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
