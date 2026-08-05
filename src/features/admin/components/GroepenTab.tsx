import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { lijstGroepen } from "../api";

// Groepen (#1036 deel 3). Bewust **alleen lezen**: groepsbeheer blijft bij de
// eigenaar (GroupLedenTab, #978). Dit paneel is voor het appniveau en hoort
// niet de plek te worden waar je even iemands groep hernoemt.
//
// De uitzondering die hier wél thuishoort is een groep zónder eigenaar.
// `groups.created_by` is `on delete set null`, en alle vier de groepspolicies
// vergelijken `auth.uid() = created_by`. Wordt die null, dan is de groep voor
// niemand meer te hernoemen, te verwijderen, en zijn uitslagen niet meer te
// corrigeren — permanent. Dat is niets wat een groepseigenaar zelf kan zien of
// oplossen, dus het hoort hier in beeld. Het overdragen van eigenaarschap komt
// in #1049.

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GroepenTab() {
  const groepen = useAsync(lijstGroepen, []);

  if (groepen.loading) return <Skeleton rows={5} />;
  if (groepen.error) {
    return <ErrorRetry melding={groepen.error} onRetry={groepen.reload} />;
  }
  if (!groepen.data || groepen.data.length === 0) {
    return (
      <EmptyState icon="🎾" title="Nog geen groepen">
        Er is nog geen enkele groep aangemaakt.
      </EmptyState>
    );
  }

  const stuurloos = groepen.data.filter((g) => g.created_by === null);

  return (
    <>
      <p className="admin__telling" role="status">
        {groepen.data.length} groep{groepen.data.length === 1 ? "" : "en"}
      </p>

      {stuurloos.length > 0 && (
        <p className="msg msg--error" role="alert">
          {stuurloos.length} groep{stuurloos.length === 1 ? "" : "en"} zonder
          eigenaar. Die {stuurloos.length === 1 ? "is" : "zijn"} niet meer te
          hernoemen of te verwijderen, en de uitslagen erin kunnen niet meer
          gecorrigeerd worden.
        </p>
      )}

      <div className="table-scroll">
        <table className="table admin-tabel">
          <thead>
            <tr>
              <th scope="col">Groep</th>
              <th scope="col">Eigenaar</th>
              <th scope="col" className="num">
                Leden
              </th>
              <th scope="col" className="num">
                Matches
              </th>
              <th scope="col">Laatste match</th>
            </tr>
          </thead>
          <tbody>
            {groepen.data.map((g) => (
              <tr key={g.id}>
                <td data-label="Groep">
                  <span className="admin-tabel__volnaam">{g.name}</span>
                </td>
                <td data-label="Eigenaar">
                  {g.eigenaar_username ? (
                    `@${g.eigenaar_username}`
                  ) : (
                    <span className="badge badge--loss">geen eigenaar</span>
                  )}
                </td>
                <td data-label="Leden" className="num">
                  {g.aantal_leden}
                </td>
                <td data-label="Matches" className="num">
                  {g.aantal_matches}
                </td>
                <td data-label="Laatste match">{datum(g.laatste_match)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
