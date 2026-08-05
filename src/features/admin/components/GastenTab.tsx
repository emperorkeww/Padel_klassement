import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { lijstGasten } from "../api";

// Gastspelers (#1036 deel 3). Alleen lezen.
//
// Gasten (`profiles.is_guest`) spelen volwaardig mee en bouwen historie op,
// maar hangen aan de speler die ze aanmaakte (`owner_id`). Twee dingen die je
// hier wilt zien: wie ze beheert — want bij het verwijderen van dat account
// verdwijnen ze mee — en welke koppelverzoeken (#681) nog open staan. Zo'n
// verzoek wacht op bevestiging door het échte account; blijft het hangen, dan
// staat iemands historie op het verkeerde profiel.

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GastenTab() {
  const gasten = useAsync(lijstGasten, []);

  if (gasten.loading) return <Skeleton rows={5} />;
  if (gasten.error) {
    return <ErrorRetry melding={gasten.error} onRetry={gasten.reload} />;
  }
  if (!gasten.data || gasten.data.length === 0) {
    return (
      <EmptyState icon="👥" title="Geen gastspelers">
        Niemand heeft een gast aangemaakt.
      </EmptyState>
    );
  }

  const open = gasten.data.filter((g) => g.open_claim);

  return (
    <>
      <p className="admin__telling" role="status">
        {gasten.data.length} gast{gasten.data.length === 1 ? "" : "en"}
        {open.length > 0 && `, ${open.length} met een openstaand koppelverzoek`}
      </p>

      <div className="table-scroll">
        <table className="table admin-tabel">
          <thead>
            <tr>
              <th scope="col">Gast</th>
              <th scope="col">Beheerd door</th>
              <th scope="col">Aangemaakt</th>
              <th scope="col" className="num">
                Matches
              </th>
              <th scope="col">Koppelverzoek</th>
            </tr>
          </thead>
          <tbody>
            {gasten.data.map((g) => (
              <tr key={g.id}>
                <td data-label="Gast">
                  <span className="admin-tabel__volnaam">
                    {g.full_name?.trim() || g.username}
                  </span>
                  <span className="admin-tabel__username">@{g.username}</span>
                </td>
                <td data-label="Beheerd door">
                  {g.owner_username ? (
                    `@${g.owner_username}`
                  ) : (
                    // Kan alleen als de eigenaar verdwenen is; owner_id
                    // cascadeert, dus in de praktijk verdwijnt de gast dan mee.
                    <span className="admin-tabel__leeg">geen eigenaar</span>
                  )}
                </td>
                <td data-label="Aangemaakt">{datum(g.created_at)}</td>
                <td data-label="Matches" className="num">
                  {g.aantal_matches}
                </td>
                <td data-label="Koppelverzoek">
                  {g.open_claim ? (
                    <span className="badge badge--accent">
                      wacht op @{g.open_claim.player_username}
                    </span>
                  ) : (
                    <span className="admin-tabel__leeg">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
