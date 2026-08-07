import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { periodeFromParam, type Periode } from "./matchFilter";

/**
 * De URL-staat van het matchoverzicht: welke groep, welke periode, en of er
 * meteen gelogd moet worden (#1123).
 *
 * Eén schrijver, één call per actie. De groepskeuze en het periodefilter zijn
 * straks twee losse bedieningen op dezelfde pagina, en twee `setSearchParams`
 * in dezelfde tick overschrijven elkaar: allebei lezen ze de `URLSearchParams`
 * van de render waarin ze werden aangemaakt. De functievorm
 * (`setSearchParams(prev => …)`) helpt daar níet tegen — react-router voedt die
 * callback met exact dezelfde closure-waarde. Vandaar `patchSpeelParams`, dat
 * alle sleutels van één actie in één keer toepast.
 */

/** Sleutelnamen zoals ze in de URL staan; gedeeld met de tests. */
export const SLEUTELS = { groep: "groep", periode: "periode", log: "log" } as const;

/**
 * Past meerdere wijzigingen tegelijk toe op een kopie van `prev`. `null` wist
 * een sleutel, een lege string ook — "alle groepen" en "alle tijden" zijn de
 * afwezigheid van de parameter, niet een waarde die je opschrijft.
 */
export function patchSpeelParams(
  prev: URLSearchParams,
  wijzigingen: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const [sleutel, waarde] of Object.entries(wijzigingen)) {
    if (waarde) next.set(sleutel, waarde);
    else next.delete(sleutel);
  }
  return next;
}

export type SpeelParams = {
  /** Gekozen groep-id, "" = alle groepen. Ongeldige waarden filtert de pagina
   *  zelf af tegen haar groepenlijst; hier staat wat er in de URL stond. */
  groep: string;
  periode: Periode;
  /** Stond er `?log=1` in de URL toen deze pagina opende? */
  logDirect: boolean;
  zetGroep: (id: string) => void;
  zetPeriode: (p: Periode) => void;
  /** Wist groep én periode in één keer. */
  wisFilters: () => void;
  /** Haalt `?log=1` weg zodra de sheet geopend is, zodat een refresh hem niet
   *  opnieuw opent. */
  verbruikLog: () => void;
};

export function useSpeelParams(): SpeelParams {
  const [params, setParams] = useSearchParams();

  const patch = useCallback(
    (wijzigingen: Record<string, string | null>) => {
      setParams(patchSpeelParams(params, wijzigingen), { replace: true });
    },
    [params, setParams],
  );

  return useMemo(
    () => ({
      groep: params.get(SLEUTELS.groep) ?? "",
      periode: periodeFromParam(params.get(SLEUTELS.periode)),
      logDirect: params.has(SLEUTELS.log),
      zetGroep: (id: string) => patch({ [SLEUTELS.groep]: id }),
      zetPeriode: (p: Periode) => patch({ [SLEUTELS.periode]: p }),
      wisFilters: () => patch({ [SLEUTELS.groep]: null, [SLEUTELS.periode]: null }),
      verbruikLog: () => patch({ [SLEUTELS.log]: null }),
    }),
    [params, patch],
  );
}

export default useSpeelParams;
