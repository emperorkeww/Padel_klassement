import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { maandVan, zelfdeMaand, type Maand } from "./agendaLogic";

/**
 * De URL-staat van de agenda (#1182): welke dag je bekijkt, welke maand het
 * raster toont, of het dag-sheet openstaat en welke weergave aan staat.
 *
 * Tot nu toe stond dat allemaal in component-state. Gevolg: je kon geen dag
 * delen of deeplinken, kwam na elk bezoek weer op vandaag uit, en de
 * terugknop verliet de pagina in plaats van het sheet te sluiten.
 *
 * Eén schrijver, één call per actie — zoals `speelParams.ts` (#1123). Twee
 * `setSearchParams` in dezelfde tick overschrijven elkaar: allebei lezen ze de
 * `URLSearchParams` van de render waarin ze werden aangemaakt, en de
 * functievorm helpt daar niet tegen. Een agenda-actie verzet vaak twee dingen
 * tegelijk (dag én maand, of weergave én dag), dus dat is hier de regel en niet
 * de uitzondering.
 */

export type Weergave = "maand" | "lijst";

/** Wat de agenda toont. `open` is de dag waarvan het sheet openstaat. */
export type AgendaStand = {
  maand: Maand;
  dag: string;
  open: string | null;
  weergave: Weergave;
  /**
   * Instapvlag: open het plan-sheet meteen voor de gekozen dag (#1213).
   *
   * Bewust een instap en geen toestand, zoals `?log=1` op het matchoverzicht:
   * de agenda leest hem één keer bij binnenkomst en wist hem daarna. Het
   * sheet zelf blijft lokale state — het geeft het stokje door aan de wizard,
   * en dat is geen keten die je halverwege wil kunnen delen.
   */
  plan: boolean;
};

/** Sleutelnamen zoals ze in de URL staan; gedeeld met de tests. */
export const SLEUTELS = {
  maand: "maand",
  dag: "dag",
  open: "open",
  weergave: "weergave",
  plan: "plan",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-08" — de maand zoals hij in de URL staat. */
export function maandParam(m: Maand): string {
  return `${m.jaar}-${pad(m.maand)}`;
}

/** Een `?maand=`-waarde, of null als er niets bruikbaars stond. */
export function leesMaand(waarde: string | null): Maand | null {
  if (waarde == null || !/^\d{4}-\d{2}$/.test(waarde)) return null;
  const maand = Number(waarde.slice(5, 7));
  if (maand < 1 || maand > 12) return null;
  return { jaar: Number(waarde.slice(0, 4)), maand };
}

/**
 * Een `?dag=`-waarde, of null als er niets bruikbaars stond.
 *
 * Alleen de vorm wordt gecontroleerd, niet of de dag bestaat: 31 februari
 * levert een raster van februari met een dag die nergens staat, en dat is
 * ongevaarlijk. Wat we níét doen is de URL rechtzetten — dat zou een tweede
 * schrijver zijn én een extra history-entry opleveren (dezelfde afweging als in
 * `Groups.tsx`).
 */
export function leesDag(waarde: string | null): string | null {
  return waarde != null && /^\d{4}-\d{2}-\d{2}$/.test(waarde) ? waarde : null;
}

/**
 * Past meerdere wijzigingen tegelijk toe op een kopie van `prev`. `null` wist
 * een sleutel: de standaardwaarde is de afwezigheid van de parameter, niet iets
 * dat je opschrijft.
 */
export function patchAgendaParams(
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

/**
 * De stand als querystring. Wat de standaard is, staat er niet in: vandaag,
 * de maand van de gekozen dag, geen sheet en het maandoverzicht.
 *
 * De maand is meestal die van de gekozen dag — behalve als je met PageUp of
 * PageDown het raster uit bladert; dan verschuift de maand zonder dat je iets
 * koos, en pas dan schrijven we hem op.
 */
export function standNaarParams(
  stand: AgendaStand,
  vandaag: string,
): Record<string, string | null> {
  return {
    [SLEUTELS.dag]: stand.dag === vandaag ? null : stand.dag,
    [SLEUTELS.maand]: zelfdeMaand(stand.maand, maandVan(stand.dag))
      ? null
      : maandParam(stand.maand),
    // Het sheet gaat altijd over de gekozen dag, dus de dag zelf staat er al.
    [SLEUTELS.open]: stand.open ? "1" : null,
    [SLEUTELS.weergave]: stand.weergave === "lijst" ? "lijst" : null,
    [SLEUTELS.plan]: stand.plan ? "1" : null,
  };
}

/** De stand die bij een querystring hoort; alles wat ontbreekt of niet klopt
 *  valt terug op de standaard. */
export function paramsNaarStand(
  params: URLSearchParams,
  vandaag: string,
): AgendaStand {
  const dag = leesDag(params.get(SLEUTELS.dag)) ?? vandaag;
  return {
    dag,
    maand: leesMaand(params.get(SLEUTELS.maand)) ?? maandVan(dag),
    open: params.get(SLEUTELS.open) ? dag : null,
    weergave: params.get(SLEUTELS.weergave) === "lijst" ? "lijst" : "maand",
    plan: params.get(SLEUTELS.plan) != null,
  };
}

export type AgendaUrl = {
  stand: AgendaStand;
  /**
   * Verzet de stand. `push` maakt een history-entry — alleen voor het openen
   * van het sheet, zodat de terugknop op Android dát sluit en niet de pagina
   * verlaat. Bladeren vervangt de entry: anders staan er na een minuut
   * rondkijken twintig stappen in je geschiedenis.
   */
  zet: (wijziging: Partial<AgendaStand>, opties?: { push?: boolean }) => void;
};

export function useAgendaUrl(vandaag: string): AgendaUrl {
  const [params, setParams] = useSearchParams();

  const stand = useMemo(() => paramsNaarStand(params, vandaag), [params, vandaag]);

  const zet = useCallback(
    (wijziging: Partial<AgendaStand>, opties: { push?: boolean } = {}) => {
      const volgende = { ...paramsNaarStand(params, vandaag), ...wijziging };
      setParams(patchAgendaParams(params, standNaarParams(volgende, vandaag)), {
        replace: !opties.push,
      });
    },
    [params, setParams, vandaag],
  );

  return { stand, zet };
}

export default useAgendaUrl;
