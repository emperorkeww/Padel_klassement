// Leestoegang tot de baanbeschikbaarheids-snapshots in Postgres (#405).
//
// De cron-edgefunctie snapshot-availability (supabase/functions/) schrijft
// elke 15 min de beschikbaarheid van de thuisclub naar
// public.court_availability_snapshots; de client leest primair daaruit
// (zie getClubAvailability in api.ts) zodat bezoekers geen upstream-calls
// naar Playtomic veroorzaken. Deze module faalt bewust zacht: elke fout
// wordt null/leeg — de aanroeper valt dan gewoon terug op het live pad.

import { supabase } from "@/lib/supabase/client";
import { cached } from "@/lib/supabase/queryCache";
import { addDays } from "@/lib/utils/time";

/** Eén opgeslagen momentopname: de rauwe Playtomic-respons + wanneer. */
export type AvailabilitySnapshot = {
  /** Rauwe RawAvailability[] zoals de cron ze wegschreef (jsonb, dus unknown). */
  payload: unknown;
  /** ISO-tijdstip waarop de cron deze dag ophaalde. */
  fetchedAt: string;
};

// Korte TTL: de cron ververst elke 15 min, dus een focus-refetch mag snel
// een nieuwe rij zien; binnen één schermopbouw delen componenten de promise.
const TTL_MS = 60_000;

/** Snapshot van één dag, of null (niet aanwezig / DB-fout — nooit blokkerend). */
export function getSnapshot(
  tenantId: string,
  date: string,
): Promise<AvailabilitySnapshot | null> {
  return cached(
    `court-snapshots:${tenantId}:${date}`,
    async () => {
      try {
        const { data, error } = await supabase
          .from("court_availability_snapshots")
          .select("payload, fetched_at")
          .eq("tenant_id", tenantId)
          .eq("date", date)
          .maybeSingle();
        if (error || !data) return null;
        return { payload: data.payload, fetchedAt: data.fetched_at };
      } catch {
        return null;
      }
    },
    TTL_MS,
  );
}

/** Snapshots voor een reeks dagen, als map datum → snapshot (leeg bij fout). */
export function getSnapshots(
  tenantId: string,
  fromDate: string,
  days: number,
): Promise<Map<string, AvailabilitySnapshot>> {
  return cached(
    `court-snapshots:${tenantId}:${fromDate}:${days}`,
    async () => {
      try {
        const { data, error } = await supabase
          .from("court_availability_snapshots")
          .select("date, payload, fetched_at")
          .eq("tenant_id", tenantId)
          .gte("date", fromDate)
          .lte("date", addDays(fromDate, days - 1));
        if (error) return new Map<string, AvailabilitySnapshot>();
        return new Map(
          (data ?? []).map((row) => [
            row.date,
            { payload: row.payload, fetchedAt: row.fetched_at },
          ]),
        );
      } catch {
        return new Map<string, AvailabilitySnapshot>();
      }
    },
    TTL_MS,
  );
}
