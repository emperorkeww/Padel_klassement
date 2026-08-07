import { useAsync } from "@/lib/hooks/useAsync";
import { Sheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { displayName } from "@/features/profiles/api";
import { auditVoor, gebruikerDetail } from "../api";
import { auditLabel } from "../auditLabels";
import { GebruikerActies } from "./GebruikerActies";
import type { AdminGebruiker } from "../types";

// Detail van één gebruiker (#1036). Eerst het beeld dat je nodig hebt vóór je
// iets doet — zit hij in een groep, speelt hij, beheert hij gasten, staat er een
// pushabonnement open — dan pas de acties, en onderaan wat er eerder met dit
// account gebeurd is. Die volgorde is opzet: je kijkt voordat je iets doet, en
// je ziet daarna dat het genoteerd staat.

function datumTijd(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GebruikerPaneel({
  gebruiker,
  onSluit,
  onGewijzigd,
}: {
  gebruiker: AdminGebruiker;
  onSluit: () => void;
  /** Na een muterende actie: de lijst erachter klopt dan niet meer. */
  onGewijzigd: () => void;
}) {
  const detail = useAsync(() => gebruikerDetail(gebruiker.id), [gebruiker.id]);
  const audit = useAsync(() => auditVoor(gebruiker.id), [gebruiker.id]);

  return (
    <Sheet open onClose={onSluit} title={displayName(gebruiker)}>
      <dl className="admin-detail__feiten">
        <dt>Gebruikersnaam</dt>
        <dd>@{gebruiker.username}</dd>
        <dt>E-mail</dt>
        <dd>
          {gebruiker.email ?? "geen account (gast)"}
          {gebruiker.email && !gebruiker.email_confirmed_at && " — niet bevestigd"}
        </dd>
        <dt>Aangemeld</dt>
        <dd>{datumTijd(gebruiker.created_at)}</dd>
        <dt>Laatste login</dt>
        <dd>{gebruiker.last_sign_in_at ? datumTijd(gebruiker.last_sign_in_at) : "nooit"}</dd>
      </dl>

      {detail.loading && <Skeleton rows={4} />}
      {detail.error && (
        <ErrorRetry melding={detail.error} onRetry={detail.reload} />
      )}

      {detail.data && (
        <>
          <section className="admin-detail__blok">
            <h3 className="card__title">Groepen ({detail.data.groepen.length})</h3>
            {detail.data.groepen.length === 0 ? (
              <p className="empty">In geen enkele groep.</p>
            ) : (
              <ul className="person-list">
                {detail.data.groepen.map((g) => (
                  <li key={g.id} className="person-row">
                    <span>{g.name}</span>
                    {g.is_eigenaar && <span className="badge badge--accent">eigenaar</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-detail__blok">
            <h3 className="card__title">Laatste matches</h3>
            {detail.data.matches.length === 0 ? (
              <p className="empty">Nog nooit gespeeld.</p>
            ) : (
              <ul className="person-list">
                {detail.data.matches.map((m) => (
                  <li key={m.id} className="person-row">
                    <span>{datumTijd(m.played_at)}</span>
                    <span>
                      {m.score_a === null || m.score_b === null
                        ? m.status
                        : `${m.score_a}–${m.score_b}`}
                      {m.groep ? ` · ${m.groep}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.data.gasten.length > 0 && (
            <section className="admin-detail__blok">
              <h3 className="card__title">
                Beheert {detail.data.gasten.length} gast
                {detail.data.gasten.length === 1 ? "" : "en"}
              </h3>
              {/* Relevant vóór een verwijdering: deze profielen cascaderen mee
                  via owner_id en verdwijnen dus samen met dit account. */}
              <ul className="person-list">
                {detail.data.gasten.map((g) => (
                  <li key={g.id} className="person-row">
                    <span>{displayName(g)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="field-hint">
            {detail.data.push_subscripties === 0
              ? "Geen pushmeldingen ingeschakeld."
              : `${detail.data.push_subscripties} apparaat/apparaten met pushmeldingen.`}
          </p>
        </>
      )}

      {/* Niet wachten op het detail: de acties werken los daarvan. Het detail
          voedt alleen de waarschuwing over verweesde groepen bij verwijderen. */}
      <GebruikerActies
        gebruiker={gebruiker}
        detail={detail.data}
        onVerwijderd={() => {
          onGewijzigd();
          onSluit();
        }}
      />

      <section className="admin-detail__blok">
        <h3 className="card__title">Historie</h3>
        {audit.loading && <Skeleton rows={2} />}
        {audit.data && audit.data.length === 0 && (
          <p className="empty">Nog niets met dit account gedaan.</p>
        )}
        {audit.data && audit.data.length > 0 && (
          <ul className="person-list">
            {audit.data.map((r) => (
              <li key={r.id} className="person-row">
                <span>{auditLabel(r.action)}</span>
                <span className="admin-audit__meta">
                  {datumTijd(r.created_at)}
                  {r.actor_username ? ` · ${r.actor_username}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Sheet>
  );
}
