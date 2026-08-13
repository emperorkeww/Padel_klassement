// Offline write-queue ("outbox") voor het vastleggen van matches (#462). Zonder
// verbinding faalde het loggen/plannen gewoon; hier bewaren we de schrijfactie
// persistent in localStorage en spelen we hem opnieuw af zodra de verbinding
// terug is. De idempotentie-token (client_token) op de RPC's zorgt dat een
// replay nooit een duplicaat maakt (zie migratie 20260718110000).

import {
  createCompletedMatch,
  createPlannedMatch,
  setMatchResult,
  UitslagAlIngevuld,
  type CreateCompletedMatchParams,
  type CreatePlannedMatchParams,
  type SetScore,
} from "@/features/matches/api";

const KEY = "vamos:outbox";

/** Eén gequeuede schrijfactie. `token` is tevens de idempotentie-sleutel die met
 *  de params meegaat, zodat elke replay dezelfde match raakt. */
export type OutboxItem =
  | {
      token: string;
      kind: "completedMatch";
      params: CreateCompletedMatchParams;
      createdAt: string;
    }
  | {
      token: string;
      kind: "plannedMatch";
      params: CreatePlannedMatchParams;
      createdAt: string;
    }
  | {
      token: string;
      kind: "matchResult";
      params: MatchResultParams;
      createdAt: string;
    };

/**
 * De uitslag van een al geplande match (#1271).
 *
 * Dit ontbrak in de wachtrij, terwijl het precies de handeling is die je in een
 * kooi zonder bereik doet — de uitlegpagina beloofde het zelfs met zoveel
 * woorden. Loggen en plannen zaten er wél in; het invullen van een klaargezette
 * ronde liep langs een kale update en faalde gewoon.
 *
 * `playedAt` wordt vastgelegd op het moment van *invoeren*, niet van versturen:
 * anders krijgt een match die je om 21:00 invulde de tijd van de volgende
 * ochtend mee, met alle gevolgen voor zijn speeldag en de Elo-volgorde.
 */
export type MatchResultParams = {
  matchId: string;
  winnerTeamId: string | null;
  scoreA: number;
  scoreB: number;
  setScores?: SetScore[] | null;
  playedAt?: string | null;
};

export type SaveResult =
  | { status: "saved"; matchId: string }
  | { status: "queued"; token: string };

export type FlushResult = {
  sent: number;
  dropped: Array<{ item: OutboxItem; error: unknown }>;
};

// -- persistente opslag (faalt stil zonder storage, net als localFlag) --------

function read(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage niet beschikbaar — negeer
  }
}

function removeByToken(token: string): void {
  write(read().filter((i) => i.token !== token));
}

// -- observers (voor een "N wachten"-badge) -----------------------------------

const listeners = new Set<(count: number) => void>();

function notify(): void {
  const count = getCount();
  for (const l of listeners) l(count);
}

export function getCount(): number {
  return read().length;
}

export function subscribe(cb: (count: number) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// -- queue vullen -------------------------------------------------------------

export function enqueue(
  kind: "completedMatch",
  params: CreateCompletedMatchParams,
): string;
export function enqueue(
  kind: "plannedMatch",
  params: CreatePlannedMatchParams,
): string;
export function enqueue(kind: "matchResult", params: MatchResultParams): string;
export function enqueue(
  kind: OutboxItem["kind"],
  params:
    | CreateCompletedMatchParams
    | CreatePlannedMatchParams
    | MatchResultParams,
): string {
  // Een uitslag heeft geen client_token: hij muteert een bestaande rij in
  // plaats van er een aan te maken. De idempotentie komt daar van de
  // `.neq("status","completed")`-guard op de update zelf.
  const token =
    ("clientToken" in params ? params.clientToken : null) ??
    crypto.randomUUID();
  const item = {
    token,
    kind,
    params:
      kind === "matchResult" ? { ...params } : { ...params, clientToken: token },
    createdAt: new Date().toISOString(),
  } as OutboxItem;
  write([...read(), item]);
  notify();
  return token;
}

// -- queue legen --------------------------------------------------------------

/** Een fout die "later opnieuw proberen" verdient (verbinding weg, token nog
 *  niet vernieuwd) i.p.v. een blijvende afwijzing (speler verwijderd, geen
 *  groepstoegang). Bij twijfel op transient inzetten zou de queue laten hangen,
 *  dus we zijn expliciet: alleen duidelijke netwerksignalen tellen als transient. */
function isTransient(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg =
    (error as { message?: string } | null)?.message?.toLowerCase() ?? "";
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch")
  );
}

async function replay(item: OutboxItem): Promise<void> {
  if (item.kind === "completedMatch") {
    await createCompletedMatch(item.params);
  } else if (item.kind === "plannedMatch") {
    await createPlannedMatch(item.params);
  } else {
    try {
      await setMatchResult(item.params);
    } catch (err) {
      // "Al ingevuld" is voor de wachtrij geen fout maar het doel: de match ís
      // afgerond. Zonder deze uitzondering droppen we het item als poison en
      // melden we een fout die er geen is.
      if (!(err instanceof UitslagAlIngevuld)) throw err;
    }
  }
}

let flushing = false;

/**
 * Speelt de wachtrij sequentieel af (belangrijk voor de Elo-volgorde). Stopt bij
 * een transient fout en behoudt het item; een blijvende afwijzing wordt gedropt
 * en gerapporteerd, zodat één "poison item" de queue niet blokkeert. Een
 * duplicaat is geen fout: de idempotente RPC geeft de bestaande match terug.
 */
export async function flush(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, dropped: [] };
  if (flushing) return result;
  if (typeof navigator !== "undefined" && !navigator.onLine) return result;
  flushing = true;
  try {
    // Steeds het voorste item pakken en pas na succes verwijderen.
    while (true) {
      const queue = read();
      if (queue.length === 0) break;
      const item = queue[0];
      try {
        await replay(item);
        removeByToken(item.token);
        result.sent++;
      } catch (error) {
        if (isTransient(error)) break;
        removeByToken(item.token);
        result.dropped.push({ item, error });
      }
    }
  } finally {
    flushing = false;
  }
  if (result.sent > 0 || result.dropped.length > 0) notify();
  return result;
}

// -- orchestrators: live proberen, offline in de wachtrij ---------------------

/** Legt een afgeronde match vast: online direct via de RPC (met token, zodat een
 *  verloren antwoord veilig herhaald kan worden), offline in de wachtrij. */
export async function saveCompletedMatch(
  params: CreateCompletedMatchParams,
): Promise<SaveResult> {
  const clientToken = params.clientToken ?? crypto.randomUUID();
  const withToken = { ...params, clientToken };
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const matchId = await createCompletedMatch(withToken);
      return { status: "saved", matchId };
    } catch (err) {
      // Nog online? Dan is het een echte fout (validatie/rechten) → doorgeven.
      // Verbinding tijdens de call weggevallen → alsnog in de wachtrij.
      if (typeof navigator === "undefined" || navigator.onLine) throw err;
    }
  }
  const token = enqueue("completedMatch", withToken);
  return { status: "queued", token };
}

/** Plant een match: zelfde online/offline-afhandeling als saveCompletedMatch. */
export async function savePlannedMatch(
  params: CreatePlannedMatchParams,
): Promise<SaveResult> {
  const clientToken = params.clientToken ?? crypto.randomUUID();
  const withToken = { ...params, clientToken };
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const matchId = await createPlannedMatch(withToken);
      return { status: "saved", matchId };
    } catch (err) {
      if (typeof navigator === "undefined" || navigator.onLine) throw err;
    }
  }
  const token = enqueue("plannedMatch", withToken);
  return { status: "queued", token };
}

/**
 * Vult de uitslag van een geplande match in: online direct, offline in de
 * wachtrij (#1271).
 *
 * De speeltijd wordt hier vastgeklikt, niet bij het versturen — zie
 * {@link MatchResultParams}.
 */
export async function saveMatchResult(
  params: MatchResultParams,
): Promise<SaveResult> {
  const metTijd = {
    ...params,
    playedAt: params.playedAt ?? new Date().toISOString(),
  };
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      await setMatchResult(metTijd);
      return { status: "saved", matchId: params.matchId };
    } catch (err) {
      // Nog online? Dan is het een echte fout (al ingevuld, rechten) →
      // doorgeven, zodat de sheet openblijft met je invoer erin.
      if (typeof navigator === "undefined" || navigator.onLine) throw err;
    }
  }
  const token = enqueue("matchResult", metTijd);
  return { status: "queued", token };
}
