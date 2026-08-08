import { useState } from "react";
import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorRetry } from "@/ui/ErrorRetry";
import { Skeleton } from "@/ui/Skeleton";
import { foutenLogboek } from "../api";
import type { FoutGroep } from "../types";

// Foutenlogboek (#1049).
//
// #733 bouwde de rapportage en gooide de rapporten weg: de Worker maakte er een
// console.error van en verder niets. Sinds deze PR landen ze in
// public.client_errors en staan ze hier.
//
// Gegroepeerd op boodschap + scope, niet als lijst losse rijen. Eén kapotte
// route levert er honderden op; als lijst verbergt dat de tweede, zeldzamere
// fout die er misschien echt toe doet.

const VENSTERS = [1, 7, 30] as const;

function moment(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FoutRij({ groep }: { groep: FoutGroep }) {
  const [open, setOpen] = useState(false);
  const stack = groep.voorbeeld_stack ?? groep.voorbeeld_component_stack;

  return (
    <li className="admin-lijst__rij admin-lijst__rij--stapel">
      <div className="admin-match__kop">
        <strong>{groep.boodschap}</strong>{" "}
        {groep.chunk && (
          <span className="badge" title="Verwacht na een deploy, geen bug">
            chunk
          </span>
        )}
      </div>

      <div className="admin-audit__meta">
        <span className="badge badge--accent">{groep.aantal}×</span>{" "}
        {groep.sessies} sessie{groep.sessies === 1 ? "" : "s"} · {groep.bron}
        {groep.scope && ` · ${groep.scope}`} · laatst {moment(groep.laatste)}
        {groep.paden && groep.paden.length > 0 && (
          <> · {groep.paden.join(", ")}</>
        )}
        {groep.releases && groep.releases.length > 0 && (
          <> · build {groep.releases.join(", ")}</>
        )}
      </div>

      {stack && (
        <>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Verberg stack" : "Toon stack"}
          </button>
          {open && (
            <pre className="admin-geheim__waarde">
              {groep.voorbeeld_stack}
              {groep.voorbeeld_component_stack}
            </pre>
          )}
        </>
      )}
    </li>
  );
}

export function FoutenTab() {
  const [dagen, setDagen] = useState<number>(7);
  const fouten = useAsync(() => foutenLogboek(dagen), [dagen]);

  // Zelfde chip-patroon als de gebruikersfilters (AdminFilters): schakelknoppen
  // met aria-pressed in een role="group".
  const venster = (
    <div className="tabs admin__filters" role="group" aria-label="Periode">
      {VENSTERS.map((d) => (
        <button
          key={d}
          type="button"
          className={`tab ${d === dagen ? "is-active" : ""}`}
          aria-pressed={d === dagen}
          onClick={() => setDagen(d)}
        >
          {d === 1 ? "24 uur" : `${d} dagen`}
        </button>
      ))}
    </div>
  );

  if (fouten.loading) {
    return (
      <>
        {venster}
        <Skeleton rows={4} />
      </>
    );
  }
  if (fouten.error) {
    return (
      <>
        {venster}
        <ErrorRetry melding={fouten.error} onRetry={fouten.reload} />
      </>
    );
  }
  if (!fouten.data || fouten.data.length === 0) {
    return (
      <>
        {venster}
        <EmptyState icon="✅" title="Geen crashes">
          Er is in dit venster geen enkele fout gemeld. Dat is goed nieuws —
          maar controleer bij twijfel op het tabblad Systeem of{" "}
          <code>client-error</code> zijn sleutel wel heeft.
        </EmptyState>
      </>
    );
  }

  const totaal = fouten.data.reduce((n, g) => n + g.aantal, 0);

  return (
    <>
      {venster}
      <p className="admin__telling" role="status">
        {fouten.data.length} soort{fouten.data.length === 1 ? "" : "en"} fout,{" "}
        {totaal} melding{totaal === 1 ? "" : "en"}
      </p>
      <ul className="admin-lijst">
        {fouten.data.map((g) => (
          <FoutRij key={`${g.boodschap}|${g.scope ?? ""}`} groep={g} />
        ))}
      </ul>
    </>
  );
}
