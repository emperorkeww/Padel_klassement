// Haalt een leesbare melding uit een onbekende fout. Supabase/PostgREST-fouten
// zijn gewone objecten met een `message` (geen Error-instantie), waardoor
// String(err) "[object Object]" opleverde — daarom checken we ook op .message.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return String(err);
}
