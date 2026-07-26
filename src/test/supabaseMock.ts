import { vi } from "vitest";

// Bouwt een chainable, thenable query-object dat een vast {data,error} teruggeeft,
// zodat we `supabase.from(...).select(...).order(...)` e.d. kunnen mocken.
export function makeQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  const chain = [
    "select",
    "order",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "is",
    "or",
    "ilike",
    "limit",
    "range",
    "insert",
    "update",
    "upsert",
    "delete",
    "match",
  ];
  for (const m of chain) q[m] = () => q;
  // single/maybeSingle geven één rij terug (de eerste bij een array).
  const one = () =>
    Promise.resolve({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    });
  q.single = one;
  q.maybeSingle = one;
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

// RPC-mock: ofwel één vaste waarde voor elke rpc-aanroep (achterwaarts
// compatibel, bv. rpc: "m-new"), ofwel een map fn-naam → data. Een map-waarde
// mag een functie (args) => data zijn, zodat een test op de argumenten kan
// reageren — nodig sinds de seizoensstand via een RPC met datumvenster loopt
// (#461): de mock filtert zelf niet, dus de test levert de venster-afhankelijke
// rijen.
type RpcMap = Record<string, unknown | ((args: unknown) => unknown)>;
type MockOptions = {
  session?: { user: { id: string; email?: string } } | null;
  tables?: Record<string, unknown[]>;
  rpc?: unknown;
};

function isRpcMap(rpc: unknown): rpc is RpcMap {
  return typeof rpc === "object" && rpc !== null && !Array.isArray(rpc);
}

/** Rij zoals `tables.rating_history` hem levert. */
type HistoryRow = {
  player_id: string;
  rating_after: number;
  played_at: string;
};

/**
 * RPC's die de mock zelf uit `tables.rating_history` afleidt (#731): de app
 * leest de rating-historie sinds #731 via `recent_rating_history` en
 * `ratings_as_of` in plaats van via een select op de tabel. Zonder dit zou elke
 * bestaande test die gewoon `tables.rating_history` vult stilletjes lege
 * sparklines krijgen — precies de klasse fout die #731 wilde uitroeien. Een
 * expliciete `rpc`-map in de test wint hier altijd van.
 */
function afgeleideRpc(
  name: string,
  args: unknown,
  tables: Record<string, unknown[]>,
): unknown | undefined {
  const rows = (tables.rating_history ?? []) as HistoryRow[];
  const p = (args ?? {}) as { p_limit?: number; p_date?: string };
  const perSpeler = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const lijst = perSpeler.get(r.player_id) ?? [];
    lijst.push(r);
    perSpeler.set(r.player_id, lijst);
  }
  for (const lijst of perSpeler.values())
    lijst.sort((a, b) => a.played_at.localeCompare(b.played_at));

  if (name === "recent_rating_history") {
    const limit = p.p_limit ?? 20;
    return [...perSpeler.values()].flatMap((lijst) => lijst.slice(-limit));
  }
  if (name === "ratings_as_of") {
    const dag = p.p_date ?? "";
    return [...perSpeler.entries()].flatMap(([player_id, lijst]) => {
      const laatste = [...lijst]
        .reverse()
        .find((r) => r.played_at.slice(0, 10) <= dag);
      return laatste
        ? [{ player_id, rating: laatste.rating_after, played_at: laatste.played_at }]
        : [];
    });
  }
  return undefined;
}

/** Maakt een nep-`supabase` client voor de tests. */
export function makeSupabaseMock(opts: MockOptions = {}) {
  const { session = null, tables = {}, rpc = [] } = opts;
  const rpcData = (name: string, args: unknown) => {
    const expliciet = isRpcMap(rpc) ? rpc[name] : undefined;
    if (expliciet === undefined) {
      const afgeleid = afgeleideRpc(name, args, tables);
      if (afgeleid !== undefined) return afgeleid;
    }
    if (!isRpcMap(rpc)) return rpc;
    return typeof expliciet === "function"
      ? (expliciet as (a: unknown) => unknown)(args)
      : (expliciet ?? []);
  };
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      // Default: e-mailbevestiging aan → wel een user, nog geen sessie.
      signUp: vi
        .fn()
        .mockResolvedValue({ data: { user: {}, session: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) =>
      makeQuery({ data: tables[table] ?? [], error: null }),
    ),
    // Chainable + thenable: `await rpc(...)` én `rpc(...).order(...)` werken.
    rpc: vi.fn((name: string, args?: unknown) =>
      makeQuery({ data: rpcData(name, args), error: null }),
    ),
    // Realtime: chainable stub (channel().on().subscribe()).
    channel: vi.fn(() => {
      const ch: Record<string, unknown> = {};
      ch.on = () => ch;
      ch.subscribe = () => ch;
      return ch;
    }),
    removeChannel: vi.fn(),
  };
}
