import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/ui/ToastProvider";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { errorMessage } from "@/lib/utils/errors";
import { lijstInstellingen, zetInstelling } from "../api";
import type { AppInstelling } from "../types";

// Schakelaars zonder deploy (#1049).
//
// De enige vlag die de app tot nu toe had is VITE_DEFAULT_DICTATOR, en die zit
// in de build: omzetten is een deploy. Deze drie gaan direct om.
//
// Staat in het Systeem-tabblad en niet in een eigen tab: zeven tabbladen is al
// veel op telefoonbreedte, en "draait alles nog?" en "zet dit uit" zijn dezelfde
// vraag op twee momenten van hetzelfde gesprek.

function moment(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Schakelaar({
  instelling,
  onGewijzigd,
}: {
  instelling: AppInstelling;
  onGewijzigd: () => void;
}) {
  const toast = useToast();
  const [bezig, setBezig] = useState(false);
  const aan = instelling.waarde.aan !== false;
  const budget = instelling.waarde.dagbudget;
  const gebruikt = instelling.waarde.gebruikt ?? 0;

  async function wissel() {
    setBezig(true);
    try {
      await zetInstelling(instelling.sleutel, !aan);
      toast.success(
        aan
          ? `${instelling.sleutel} staat uit`
          : `${instelling.sleutel} staat weer aan`,
      );
      onGewijzigd();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <li className="admin-lijst__rij admin-lijst__rij--stapel">
      <div className="admin-match__kop">
        <strong>{instelling.sleutel}</strong>{" "}
        <span className={aan ? "badge badge--win" : "badge badge--loss"}>
          {aan ? "aan" : "uit"}
        </span>
      </div>

      <div className="admin-match__sub">{instelling.omschrijving}</div>

      {typeof budget === "number" && budget > 0 && (
        <div className="admin-audit__meta">
          Dagbudget {gebruikt}/{budget}
          {instelling.waarde.dag ? ` (${instelling.waarde.dag})` : ""}
        </div>
      )}

      <div className="admin-audit__meta">
        Laatst gewijzigd {moment(instelling.bijgewerkt_at)}
        {instelling.bijgewerkt_door_username &&
          ` door @${instelling.bijgewerkt_door_username}`}
        {instelling.publiek && " · leesbaar voor de app"}
      </div>

      <div className="admin-acties">
        <button
          type="button"
          className={`btn btn--sm${aan ? " btn--danger" : ""}`}
          onClick={wissel}
          disabled={bezig}
        >
          {bezig ? "Bezig…" : aan ? "Uitzetten" : "Aanzetten"}
        </button>
      </div>
    </li>
  );
}

export function SchakelaarsBlok() {
  const instellingen = useAsync(lijstInstellingen, []);

  return (
    <div className="admin-detail__blok">
      <h3>Schakelaars</h3>
      <p className="admin-match__sub">
        Deze werken meteen, zonder deploy. De edge functions lezen ze per
        aanroep, met een cache van een minuut — het kan dus even duren voor je
        het effect ziet.
      </p>

      {instellingen.loading && <Skeleton rows={3} />}
      {instellingen.error && (
        <ErrorRetry
          melding={instellingen.error}
          onRetry={instellingen.reload}
        />
      )}
      {instellingen.data && (
        <ul className="admin-lijst">
          {instellingen.data.map((i) => (
            <Schakelaar
              key={i.sleutel}
              instelling={i}
              onGewijzigd={instellingen.reload}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
