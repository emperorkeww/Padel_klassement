import { useState } from "react";
import { useConfirm } from "@/ui/ConfirmDialog";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import { displayName } from "@/features/profiles/api";
import {
  corrigeerEmail,
  herstelLink,
  herstelmailOpnieuw,
  tijdelijkWachtwoord,
  trekSessiesIn,
  verwijderAccount,
} from "../api";
import { GeheimBlok } from "./GeheimBlok";
import type { AdminDetail, AdminGebruiker } from "../types";

// De beheeracties op één gebruiker (#1036 deel 2).
//
// Twee smaken om iemand weer binnen te krijgen, en die lossen verschillende
// problemen op:
//   a. een herstel-link — geen mailbezorging nodig, dus precies voor "de mail
//      komt niet aan". Voorkeur.
//   b. een tijdelijk wachtwoord — voor wie een link in de chat niet vertrouwt of
//      gewoon aan de telefoon hangt.
// Allebei worden ze exact één keer getoond en nergens bewaard.

export function GebruikerActies({
  gebruiker,
  detail,
  onVerwijderd,
}: {
  gebruiker: AdminGebruiker;
  /** Voor de waarschuwing bij verwijderen; null zolang het detail nog laadt. */
  detail: AdminDetail | null;
  onVerwijderd: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [bezig, setBezig] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [wachtwoord, setWachtwoord] = useState<string | null>(null);

  const naam = displayName(gebruiker);
  const eigenGroepen = (detail?.groepen ?? []).filter((g) => g.is_eigenaar);

  async function doe(fn: () => Promise<void>) {
    setBezig(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <section className="admin-detail__blok">
      <h3 className="card__title">Acties</h3>

      <div className="admin-acties">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={bezig || !gebruiker.email}
          onClick={() =>
            doe(async () => {
              const { link: nieuw, vervalt_over_minuten } = await herstelLink(
                gebruiker.id,
              );
              setLink(nieuw);
              setWachtwoord(null);
              toast.success(`Herstel-link klaar — geldig ${vervalt_over_minuten} minuten.`);
            })
          }
        >
          Herstel-link maken
        </button>

        <button
          type="button"
          className="btn btn--sm"
          disabled={bezig}
          onClick={() =>
            doe(async () => {
              if (
                !(await confirm({
                  title: "Tijdelijk wachtwoord zetten?",
                  body: `Het huidige wachtwoord van ${naam} vervalt meteen. Hij moet bij de volgende login zelf een nieuw wachtwoord kiezen.`,
                  confirmLabel: "Zetten",
                  danger: true,
                }))
              ) {
                return;
              }
              const nieuw = await tijdelijkWachtwoord(gebruiker.id);
              setWachtwoord(nieuw);
              setLink(null);
            })
          }
        >
          Tijdelijk wachtwoord
        </button>

        <button
          type="button"
          className="btn btn--sm"
          disabled={bezig || !gebruiker.email}
          onClick={() =>
            doe(async () => {
              await herstelmailOpnieuw(gebruiker.id);
              toast.success("Herstelmail opnieuw verstuurd.");
            })
          }
        >
          Herstelmail opnieuw
        </button>

        <button
          type="button"
          className="btn btn--sm"
          disabled={bezig}
          onClick={() =>
            doe(async () => {
              const nieuw = window.prompt(
                `Nieuw e-mailadres voor ${naam}`,
                gebruiker.email ?? "",
              );
              if (!nieuw || nieuw === gebruiker.email) return;
              await corrigeerEmail(gebruiker.id, nieuw.trim());
              toast.success("E-mailadres gewijzigd en meteen bevestigd.");
            })
          }
        >
          E-mail corrigeren
        </button>

        <button
          type="button"
          className="btn btn--sm"
          disabled={bezig}
          onClick={() =>
            doe(async () => {
              const aantal = await trekSessiesIn(gebruiker.id);
              toast.success(
                aantal === 0
                  ? "Er stonden geen sessies open."
                  : `${aantal} sessie(s) ingetrokken. Een al lopende sessie blijft hooguit een uur geldig.`,
              );
            })
          }
        >
          Overal uitloggen
        </button>

        <button
          type="button"
          className="btn btn--danger btn--sm"
          disabled={bezig}
          onClick={() =>
            doe(async () => {
              if (
                !(await confirm({
                  title: "Account definitief verwijderen",
                  body: (
                    <>
                      <p>
                        Dit verwijdert {naam} met al zijn matches,
                        groepslidmaatschappen, vriendschappen en meldingen. Dit
                        kan niet ongedaan worden gemaakt.
                      </p>
                      {gebruiker.aantal_gasten > 0 && (
                        <p>
                          Zijn {gebruiker.aantal_gasten} gastspeler(s) verdwijnen
                          mee, inclusief hun historie.
                        </p>
                      )}
                      {eigenGroepen.length > 0 && (
                        // De helft van deze knop die je niet ziet aankomen:
                        // groups.created_by is `on delete set null`, en alle
                        // groepspolicies vergelijken daarmee. Zonder eigenaar is
                        // een groep niet meer te hernoemen, niet te verwijderen
                        // en zijn matches niet meer te corrigeren (#1049).
                        <p>
                          <strong>Let op:</strong> hij is eigenaar van{" "}
                          {eigenGroepen.map((g) => g.name).join(", ")}. Die
                          groep(en) blijven zonder eigenaar achter en zijn daarna
                          niet meer te beheren — ook hun uitslagen niet.
                        </p>
                      )}
                    </>
                  ),
                  bevestigWoord: gebruiker.username,
                  confirmLabel: "Definitief verwijderen",
                  danger: true,
                }))
              ) {
                return;
              }
              await verwijderAccount(gebruiker.id, gebruiker.username);
              toast.success(`${naam} is verwijderd.`);
              onVerwijderd();
            })
          }
        >
          Account verwijderen
        </button>
      </div>

      {link && (
        <GeheimBlok
          label="Herstel-link"
          waarde={link}
          waarschuwing="Eenmalig geldig en vervalt na een uur. Plak hem in een persoonlijk bericht; wie de link heeft, kan het wachtwoord zetten."
        />
      )}

      {wachtwoord && (
        <GeheimBlok
          label="Tijdelijk wachtwoord"
          waarde={wachtwoord}
          waarschuwing="Wordt maar één keer getoond en nergens bewaard. Dicteer je het door de telefoon, dan ligt het wachtwoord in dat kanaal — hij moet het bij de volgende login sowieso vervangen."
        />
      )}

      {confirmUi}
    </section>
  );
}
