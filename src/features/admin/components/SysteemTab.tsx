import { Fragment } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { systeemStatus } from "../api";
import { SchakelaarsBlok } from "./SchakelaarsBlok";
import { HerberekenBlok } from "./HerberekenBlok";
import type {
  SysteemCronJob,
  SysteemCronStatus,
  SysteemFunctie,
} from "../types";

// Systeemgezondheid (#1049).
//
// Eén scherm met één vraag: draait alles nog? Bewust alleen-lezen — hier valt
// niets te repareren, het doel is dat je zíét dat er iets stuk is voordat een
// speler het meldt.
//
// De aanleiding staat in het scherm zelf: `appeal-deadline` beveiligde zich met
// x-cron-secret maar stond niet in config.toml, ging dus live achter de
// platform-JWT-gate, en Rudy's VAR sloot maandenlang niets af zonder dat iets
// dat meldde.

const STATUS_TEKST: Record<SysteemCronStatus, string> = {
  ok: "draait",
  uit: "uitgezet",
  mislukt: "laatste run mislukte",
  laat: "te lang stil",
  nooit: "nooit gedraaid",
  onbekend: "schema onbekend",
};

/** Alleen "laat" en "mislukt" zijn storingen. "uit" is een keuze en hoort niet
 *  rood te zijn — een dashboard dat te vaak alarmeert, leer je negeren. */
const STATUS_BADGE: Record<SysteemCronStatus, string> = {
  ok: "badge badge--win",
  uit: "badge",
  mislukt: "badge badge--loss",
  laat: "badge badge--loss",
  nooit: "badge badge--loss",
  onbekend: "badge",
};

function moment(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stilte(minuten: number | null): string {
  if (minuten === null) return "";
  if (minuten < 60) return `${minuten} min geleden`;
  const uren = Math.floor(minuten / 60);
  if (uren < 24) return `${uren} uur geleden`;
  return `${Math.floor(uren / 24)} dag(en) geleden`;
}

function CronBlok({ jobs }: { jobs: SysteemCronJob[] | null }) {
  if (jobs === null) {
    return (
      <div className="admin-detail__blok">
        <h3>Cron-jobs</h3>
        <p className="admin-tabel__leeg">
          Geen <code>pg_cron</code> op deze databank. Dat is normaal buiten het
          gehoste project — de schedules staan alleen daar, aangemaakt met de
          snippets uit <code>supabase/snippets/</code>.
        </p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="admin-detail__blok">
        <h3>Cron-jobs</h3>
        <p className="msg msg--error" role="alert">
          <code>pg_cron</code> draait, maar er staat geen enkele job gepland. De
          herinneringen, het sluiten van speeldagen en Rudy&apos;s VAR gebeuren
          dan niet.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-detail__blok">
      <h3>Cron-jobs</h3>
      <div className="table-scroll">
        <table className="table admin-tabel">
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Schema</th>
              <th scope="col">Laatste run</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.jobname}>
                <td data-label="Job">
                  <span className="admin-tabel__volnaam">{j.jobname}</span>
                </td>
                <td data-label="Schema">
                  <code>{j.schedule}</code>
                </td>
                <td data-label="Laatste run">
                  {moment(j.laatste_start)}
                  {j.oordeel.stilMinuten !== null && (
                    <span className="admin-match__sub">
                      {" "}
                      {stilte(j.oordeel.stilMinuten)}
                    </span>
                  )}
                </td>
                <td data-label="Status">
                  <span className={STATUS_BADGE[j.oordeel.status]}>
                    {STATUS_TEKST[j.oordeel.status]}
                  </span>
                  {j.oordeel.status === "laat" && j.oordeel.drempel !== null && (
                    <span className="admin-match__sub">
                      {" "}
                      hoort elke {j.oordeel.drempel} min iets te doen
                    </span>
                  )}
                  {j.laatste_bericht && j.oordeel.status === "mislukt" && (
                    <span className="admin-match__sub"> {j.laatste_bericht}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FunctieBlok({
  functies,
  secrets,
}: {
  functies: SysteemFunctie[];
  secrets: Record<string, boolean>;
}) {
  const stuk = functies.filter((f) => f.ontbrekend.length > 0);
  const ontbrekend = Object.entries(secrets).filter(([, gezet]) => !gezet);

  return (
    <div className="admin-detail__blok">
      <h3>Edge functions</h3>

      {stuk.length > 0 && (
        <p className="msg msg--error" role="alert">
          {stuk.length} function{stuk.length === 1 ? "" : "s"} mist een vereiste
          sleutel en doet zijn werk niet.
        </p>
      )}

      <div className="table-scroll">
        <table className="table admin-tabel">
          <thead>
            <tr>
              <th scope="col">Function</th>
              <th scope="col">Waarvoor</th>
              <th scope="col">JWT-gate</th>
              <th scope="col">Sleutels</th>
            </tr>
          </thead>
          <tbody>
            {functies.map((f) => (
              <tr key={f.naam}>
                <td data-label="Function">
                  <span className="admin-tabel__volnaam">{f.naam}</span>
                </td>
                <td data-label="Waarvoor">
                  <span className="admin-match__sub">{f.rol}</span>
                </td>
                <td data-label="JWT-gate">
                  {f.verifyJwt ? (
                    <span className="badge">aan</span>
                  ) : (
                    <span className="badge badge--accent">
                      uit{f.cronGeheim ? " · eigen geheim" : ""}
                    </span>
                  )}
                </td>
                <td data-label="Sleutels">
                  {f.ontbrekend.length === 0 ? (
                    <span className="badge badge--win">compleet</span>
                  ) : (
                    <span className="badge badge--loss">
                      mist {f.ontbrekend.join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-match__sub">
        De <em>JWT-gate</em> is wat <code>supabase/config.toml</code>{" "}
        voorschrijft, niet wat er op dit moment draait — dat laatste zit alleen
        achter de Management API. Zolang de Deploy-workflow de enige route is,
        zijn ze gelijk; <code>edgeFuncties.test.ts</code> bewaakt dat elke
        function met een eigen cron-geheim de gate uit heeft staan.
      </p>

      {ontbrekend.length > 0 && (
        <p className="admin-match__sub">
          Niet gezet in dit project:{" "}
          {ontbrekend.map(([naam]) => naam).join(", ")}. Sommige daarvan zijn
          alleen voor een deel van de functies vereist.
        </p>
      )}
    </div>
  );
}

export function SysteemTab() {
  const status = useAsync(systeemStatus, []);

  if (status.loading) return <Skeleton rows={6} />;
  if (status.error) {
    return <ErrorRetry melding={status.error} onRetry={status.reload} />;
  }
  if (!status.data) return null;

  const { databank, functies, secrets } = status.data;

  return (
    <>
      <p className="admin__telling" role="status">
        Gemeten op {moment(databank.gemeten_op)}
      </p>

      <SchakelaarsBlok />

      <HerberekenBlok />

      <CronBlok jobs={databank.cron} />

      <FunctieBlok functies={functies} secrets={secrets} />

      <div className="admin-detail__blok">
        <h3>Push</h3>
        <dl className="admin-detail__feiten">
          <dt>Abonnementen</dt>
          <dd>{databank.push.abonnementen}</dd>
          <dt>Gebruikers</dt>
          <dd>{databank.push.gebruikers}</dd>
          <dt>Oudste</dt>
          <dd>{moment(databank.push.oudste)}</dd>
          <dt>Nieuwste</dt>
          <dd>{moment(databank.push.nieuwste)}</dd>
        </dl>
      </div>

      <div className="admin-detail__blok">
        <h3>Databank</h3>
        <dl className="admin-detail__feiten">
          <dt>Laatste migratie</dt>
          <dd>
            {databank.migratie
              ? `${databank.migratie.versie} ${databank.migratie.naam ?? ""}`.trim()
              : "onbekend"}
          </dd>
          {databank.tabellen.map((t) => (
            // Fragment en geen wrapper-div: admin-detail__feiten is een grid
            // over dt/dd, en een extra element eromheen breekt die kolommen.
            <Fragment key={t.tabel}>
              <dt>{t.tabel}</dt>
              <dd>{t.rijen.toLocaleString("nl-NL")}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </>
  );
}
