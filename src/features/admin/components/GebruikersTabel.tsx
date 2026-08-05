import { Avatar } from "@/ui/Avatar";
import { displayName } from "@/features/profiles/api";
import type { AdminGebruiker } from "../types";

// De gebruikerslijst (#1036). Eén component voor beide breedtes: op desktop een
// tabel binnen .table-scroll, op telefoon (≤700px) vouwt dezelfde opmaak via
// AdminPaneel.css tot kaartjes met labels. Dat scheelt twee lijsten die uit
// elkaar groeien.

/** Datum mét jaartal. De gedeelde formatDate() laat het jaar weg, en juist bij
 *  "wanneer heeft die zich ooit aangemeld" is dat de helft van het antwoord. */
function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GebruikersTabel({
  gebruikers,
  onKies,
}: {
  gebruikers: AdminGebruiker[];
  onKies: (u: AdminGebruiker) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="table admin-tabel">
        <thead>
          <tr>
            <th scope="col">Speler</th>
            <th scope="col">E-mail</th>
            <th scope="col">Aangemeld</th>
            <th scope="col">Laatste login</th>
            <th scope="col" className="num">
              Groepen
            </th>
            <th scope="col" className="num">
              Matches
            </th>
          </tr>
        </thead>
        <tbody>
          {gebruikers.map((u) => (
            <tr key={u.id}>
              <td data-label="Speler">
                {/* De hele rij aanklikbaar maken zou de tabel voor
                    toetsenbord en screenreader onbruikbaar maken; de knop op de
                    naam is de ingang, precies zoals in de spelerslijsten. */}
                <button
                  type="button"
                  className="admin-tabel__naam"
                  onClick={() => onKies(u)}
                >
                  <Avatar profile={u} size={28} />
                  <span className="cell-player">
                    <span className="admin-tabel__volnaam">{displayName(u)}</span>
                    <span className="admin-tabel__username">@{u.username}</span>
                  </span>
                </button>
                {u.is_guest && <span className="badge">Gast</span>}
                {u.is_admin && <span className="badge badge--accent">Beheer</span>}
              </td>
              <td data-label="E-mail">
                {u.email ?? <span className="admin-tabel__leeg">geen account</span>}
                {u.email && !u.email_confirmed_at && (
                  <span className="badge badge--loss" title="E-mail niet bevestigd">
                    niet bevestigd
                  </span>
                )}
              </td>
              <td data-label="Aangemeld">{datum(u.created_at)}</td>
              <td data-label="Laatste login">
                {u.last_sign_in_at ? (
                  datum(u.last_sign_in_at)
                ) : (
                  <span className="admin-tabel__leeg">nooit</span>
                )}
              </td>
              <td data-label="Groepen" className="num">
                {u.aantal_groepen}
              </td>
              <td data-label="Matches" className="num">
                {u.aantal_matches}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
