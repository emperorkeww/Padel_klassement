// Kleine, zelfstandige supabase-mock voor de api-unittests.
//
// Gebruik in een testbestand:
//   vi.mock("@/lib/supabase/client", async () => {
//     const h = await import("../../test/apiHarness");
//     return { supabase: h.build() };
//   });
//   import { enqueue, reset, calls } from "../../test/apiHarness";
//
// enqueue({ data }) zet het resultaat klaar voor de VOLGENDE supabase-operatie
// (from().../rpc/storage/auth). Meerdere ops => in dezelfde volgorde enqueuen.
// `calls` legt elke aangeroepen methode + argumenten vast voor assertions.

export type Result = { data?: unknown; error?: unknown };
export type Call = {
  table?: string;
  bucket?: string;
  name?: string;
  method: string;
  args: unknown[];
};

export const calls: Call[] = [];
const queue: { data: unknown; error: unknown }[] = [];

export function reset(): void {
  calls.length = 0;
  queue.length = 0;
}

export function enqueue(...results: Result[]): void {
  for (const r of results) queue.push({ data: r.data ?? null, error: r.error ?? null });
}

function take(): { data: unknown; error: unknown } {
  return queue.length ? queue.shift()! : { data: [], error: null };
}

function makeQuery(table: string) {
  const r = take();
  const q: Record<string, unknown> = {};
  for (const m of [
    "select", "order", "eq", "neq", "ilike", "in", "limit", "range", "or", "match",
    "insert", "update", "upsert", "delete",
  ]) {
    q[m] = (...args: unknown[]) => {
      calls.push({ table, method: m, args });
      return q;
    };
  }
  q.single = () => Promise.resolve(r);
  q.maybeSingle = () => Promise.resolve(r);
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(r).then(res, rej);
  return q;
}

/** Bouwt het nep-`supabase`-object dat de api-modules importeren. */
export function build() {
  return {
    from: (table: string) => {
      calls.push({ table, method: "from", args: [] });
      return makeQuery(table);
    },
    rpc: (name: string, params: unknown) => {
      calls.push({ method: "rpc", name, args: [params] });
      return Promise.resolve(take());
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: unknown, opts: unknown) => {
          calls.push({ method: "upload", bucket, args: [path, file, opts] });
          return Promise.resolve(take());
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${path}` },
        }),
        list: (prefix: string) => {
          calls.push({ method: "list", bucket, args: [prefix] });
          return Promise.resolve(take());
        },
        remove: (paths: string[]) => {
          calls.push({ method: "remove", bucket, args: [paths] });
          return Promise.resolve(take());
        },
      }),
    },
    auth: {
      updateUser: (attrs: unknown) => {
        calls.push({ method: "updateUser", args: [attrs] });
        return Promise.resolve(take());
      },
      signInWithPassword: (creds: unknown) => {
        calls.push({ method: "signInWithPassword", args: [creds] });
        return Promise.resolve(take());
      },
    },
  };
}