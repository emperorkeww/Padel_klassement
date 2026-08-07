import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { Sheet } from "@/ui/Sheet";
import { Skeleton } from "@/ui/Skeleton";
import { useConfirm } from "@/ui/ConfirmDialog";
import { useToast } from "@/ui/ToastProvider";
import { errorMessage } from "@/lib/utils/errors";
import {
  lijstGroepLeden,
  lijstPolls,
  verwijderGroep,
  verwijderGroepslid,
  verwijderPoll,
  wijsEigenaarAan,
  zetPollStatus,
} from "../api";
import type { AdminGroep } from "../types";

// Beheer van één groep vanuit het paneel (#1159).
//
// De belangrijkste knop is "eigenaar aanwijzen", en niet omdat hij het vaakst
// nodig is. `groups.created_by` is `on delete set null` en alle vier de
// groepspolicies vergelijken daarmee: verdwijnt de eigenaar, dan is de groep
// voor niemand meer te hernoemen, te verwijderen of te corrigeren — permanent.
// Het paneel telde die groepen al (#1036 deel 3) en kon er niets mee.
//
// Eigenaarschap staat op twee plekken (groups.created_by en group_members.role);
// de server zet ze in één transactie en eist dat de nieuwe eigenaar al lid is en
// geen gast — zie admin_set_group_owner.

export function GroepActies({
  groep,
  onSluit,
  onGewijzigd,
}: {
  groep: AdminGroep;
  onSluit: () => void;
  onGewijzigd: () => void;
}) {
  const toast = useToast();
  const [confirm, confirmUi] = useConfirm();
  const [bezig, setBezig] = useState(false);
  const [nieuweEigenaar, setNieuweEigenaar] = useState("");

  const leden = useAsync(() => lijstGroepLeden(groep.id), [groep.id]);
  const polls = useAsync(() => lijstPolls(groep.id), [groep.id]);

  // Gasten hebben geen account en zouden de groep opnieuw stuurloos maken; de
  // server weigert ze ook, maar ze in de keuzelijst tonen is misleidend.
  const kandidaten = (leden.data ?? []).filter(
    (l) => !l.is_guest && !l.is_eigenaar,
  );

  async function doe(fn: () => Promise<void>) {
    setBezig(true);
    try {
      await fn();
      leden.reload();
      polls.reload();
      onGewijzigd();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBezig(false);
    }
  }

  return (
    <Sheet open onClose={onSluit} title={groep.name}>
      <p className="msg msg--info" role="note">
        Je beheert deze groep als beheerder van de app, niet als eigenaar. Elke
        wijziging wordt gelogd.
      </p>

      <section className="admin-detail__blok">
        <h3 className="card__title">Eigenaar</h3>
        <p className="admin__telling">
          {groep.eigenaar_username
            ? `Nu: @${groep.eigenaar_username}`
            : "Deze groep heeft geen eigenaar en is daardoor onbeheerbaar."}
        </p>

        {leden.loading ? (
          <Skeleton rows={2} />
        ) : kandidaten.length === 0 ? (
          <p className="admin-tabel__leeg">
            Geen ander lid met een account om het aan over te dragen.
          </p>
        ) : (
          <div className="admin-acties">
            <label>
              <span className="sr-only">Nieuwe eigenaar</span>
              <select
                className="input"
                value={nieuweEigenaar}
                onChange={(e) => setNieuweEigenaar(e.target.value)}
              >
                <option value="">Kies een lid…</option>
                {kandidaten.map((l) => (
                  <option key={l.player_id} value={l.player_id}>
                    {l.full_name ? `${l.full_name} (@${l.username})` : `@${l.username}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={bezig || nieuweEigenaar === ""}
              onClick={() =>
                doe(async () => {
                  await wijsEigenaarAan(groep.id, nieuweEigenaar);
                  setNieuweEigenaar("");
                  toast.success("Eigenaar overgedragen.");
                })
              }
            >
              Eigenaar maken
            </button>
          </div>
        )}
      </section>

      <section className="admin-detail__blok">
        <h3 className="card__title">Leden</h3>
        {leden.loading ? (
          <Skeleton rows={3} />
        ) : (
          <ul className="admin-lijst">
            {(leden.data ?? []).map((l) => (
              <li key={l.player_id} className="admin-lijst__rij">
                <span>
                  {l.full_name ? `${l.full_name} ` : ""}
                  <span className="admin-tabel__username">@{l.username}</span>
                  {l.is_eigenaar && <span className="badge">eigenaar</span>}
                  {l.is_guest && <span className="badge">gast</span>}
                </span>
                {!l.is_eigenaar && (
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={bezig}
                    onClick={() =>
                      doe(async () => {
                        if (
                          !(await confirm({
                            title: "Lid verwijderen",
                            body: `@${l.username} verlaat ${groep.name}. Zijn gespeelde matches blijven staan.`,
                            confirmLabel: "Verwijderen",
                            danger: true,
                          }))
                        ) {
                          return;
                        }
                        await verwijderGroepslid(groep.id, l.player_id);
                        toast.success(`@${l.username} is uit de groep gehaald.`);
                      })
                    }
                  >
                    Eruit
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-detail__blok">
        <h3 className="card__title">Speeldagen</h3>
        {polls.loading ? (
          <Skeleton rows={2} />
        ) : (polls.data ?? []).length === 0 ? (
          <p className="admin-tabel__leeg">Geen speeldag-polls in deze groep.</p>
        ) : (
          <ul className="admin-lijst">
            {(polls.data ?? []).map((p) => (
              <li key={p.id} className="admin-lijst__rij">
                <span>
                  {p.vastgelegd_op ?? `${p.aantal_opties} moment(en)`}
                  <span className="admin-tabel__username">
                    {" "}
                    {p.status} · {p.aantal_stemmen} stem(men)
                  </span>
                </span>
                <span className="admin-acties">
                  {p.status === "cancelled" || p.status === "booked" ? (
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={bezig}
                      onClick={() =>
                        doe(async () => {
                          // Heropenen wist de boeking: een clubcode of
                          // baannummer van een vervallen reservering hoort niet
                          // op een poll die weer openstaat.
                          if (
                            !(await confirm({
                              title: "Speeldag heropenen?",
                              body: "Het vastgelegde moment, de baan en de toegangscode vervallen. De stemmen blijven staan.",
                              confirmLabel: "Heropenen",
                            }))
                          ) {
                            return;
                          }
                          await zetPollStatus(p.id, "open");
                          toast.success("Speeldag staat weer open.");
                        })
                      }
                    >
                      Heropenen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm"
                      disabled={bezig}
                      onClick={() =>
                        doe(async () => {
                          await zetPollStatus(p.id, "cancelled");
                          toast.success("Speeldag geannuleerd.");
                        })
                      }
                    >
                      Annuleren
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    disabled={bezig}
                    onClick={() =>
                      doe(async () => {
                        if (
                          !(await confirm({
                            title: "Speeldag verwijderen",
                            body: `De poll en alle ${p.aantal_stemmen} stem(men) verdwijnen definitief.`,
                            confirmLabel: "Verwijderen",
                            danger: true,
                          }))
                        ) {
                          return;
                        }
                        await verwijderPoll(p.id);
                        toast.success("Speeldag verwijderd.");
                      })
                    }
                  >
                    Verwijderen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-detail__blok">
        <h3 className="card__title">Groep verwijderen</h3>
        <div className="admin-acties">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={bezig}
            onClick={() =>
              doe(async () => {
                if (
                  !(await confirm({
                    title: "Groep definitief verwijderen",
                    body: (
                      <>
                        <p>
                          {groep.name} verdwijnt met zijn {groep.aantal_leden}{" "}
                          lidmaatschappen, speeldagen en uitnodigingslinks.
                        </p>
                        <p>
                          De {groep.aantal_matches} gespeelde match(es) blijven
                          bestaan en tellen mee in het klassement; ze raken
                          alleen hun groep kwijt.
                        </p>
                      </>
                    ),
                    bevestigWoord: groep.name,
                    confirmLabel: "Definitief verwijderen",
                    danger: true,
                  }))
                ) {
                  return;
                }
                const { matches_losgekoppeld } = await verwijderGroep(
                  groep.id,
                  groep.name,
                );
                toast.success(
                  matches_losgekoppeld === 0
                    ? "Groep verwijderd."
                    : `Groep verwijderd. ${matches_losgekoppeld} match(es) staan nu zonder groep.`,
                );
                onSluit();
              })
            }
          >
            Groep verwijderen
          </button>
        </div>
      </section>

      {confirmUi}
    </Sheet>
  );
}
