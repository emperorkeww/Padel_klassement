import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Waarden komen uit .env (zie .env.example). Vite exposeert alleen VITE_-prefixed vars.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Faalt luid tijdens dev als de env ontbreekt, i.p.v. stille runtime-fouten later.
  console.warn(
    "Supabase env ontbreekt: zet VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in .env",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Sessie bewaren + token automatisch verversen (standaard, expliciet gemaakt).
    persistSession: true,
    autoRefreshToken: true,
    // PKCE is de veilige OAuth-flow voor SPA's; vangt ook de
    // redirect-tokens op na Google/Apple-login.
    flowType: "pkce",
    detectSessionInUrl: true,
  },
});