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
    "or",
    "ilike",
    "limit",
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

/** Maakt een nep-`supabase` client voor de tests. */
export function makeSupabaseMock(opts: MockOptions = {}) {
  const { session = null, tables = {}, rpc = [] } = opts;
  const rpcData = (name: string, args: unknown) => {
    if (!isRpcMap(rpc)) return rpc;
    const entry = rpc[name];
    return typeof entry === "function"
      ? (entry as (a: unknown) => unknown)(args)
      : (entry ?? []);
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
      signUp: vi.fn().mockResolvedValue({ error: null }),
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
