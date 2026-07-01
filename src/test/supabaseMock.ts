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
    "ilike",
    "limit",
    "insert",
    "update",
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

type MockOptions = {
  session?: { user: { id: string; email?: string } } | null;
  tables?: Record<string, unknown[]>;
  rpc?: unknown;
};

/** Maakt een nep-`supabase` client voor de tests. */
export function makeSupabaseMock(opts: MockOptions = {}) {
  const { session = null, tables = {}, rpc = [] } = opts;
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) =>
      makeQuery({ data: tables[table] ?? [], error: null }),
    ),
    rpc: vi.fn().mockResolvedValue({ data: rpc, error: null }),
  };
}
