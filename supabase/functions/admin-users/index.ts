// Edge Function: "admin-users" — de enige weg naar de beheeracties (#1036).
//
// Alle adminacties lopen hierlangs en nooit via de browser: de service-role key
// hoort niet in clientcode en niet in een VITE_-variabele. De client roept aan
// met supabase.functions.invoke("admin-users", { body: { action, ... } }),
// waarbij de Authorization-header van de gebruiker automatisch meegaat.
//
// Deploy MÉT JWT-verificatie (de platform-standaard, dus géén entry in
// config.toml) — net als remind-group. Dat is een extra laag bóvenop de
// is_app_admin-check hieronder; de issuetekst stelde verify_jwt = false voor,
// maar er is geen reden om de gratis gate weg te gooien voor een function die
// altijd namens een ingelogde gebruiker wordt aangeroepen.
//
// SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY worden door het
// platform meegegeven; er zijn geen eigen secrets nodig.

import { createClient } from "npm:@supabase/supabase-js@2";
import { bepaalToegang } from "../_shared/adminAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role client: draait de RPC's die auth.users lezen. Die zijn service-
// role-only (zie schemas/functions/37_app_admin.sql), dus dit is de enige
// client die ze überhaupt kan aanroepen.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { action?: unknown; user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geen geldige payload" }, 400);
  }

  // Wie belt er? De anon-client op de meegestuurde header valideert de JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData.user?.id ?? null;

  // Is die persoon beheerder? Met de service-role client, want is_app_admin is
  // voor authenticated niet uitvoerbaar. Faalt de RPC, dan geldt "geen
  // beheerder" — fail-closed, een storing mag geen deur openzetten.
  let isAdmin = false;
  if (uid) {
    const { data, error } = await admin.rpc("is_app_admin", { p_uid: uid });
    isAdmin = !error && data === true;
  }

  const toegang = bepaalToegang({ uid, isAdmin, actie: body.action });
  if (toegang.soort === "weiger") {
    return json({ error: toegang.fout }, toegang.status);
  }

  switch (toegang.actie) {
    case "whoami":
      return json({ admin: isAdmin });

    case "list_users": {
      const { data, error } = await admin.rpc("admin_users_overzicht");
      if (error) return json({ error: error.message }, 500);
      return json({ users: data ?? [] });
    }

    case "user_detail": {
      const targetId = body.user_id;
      if (typeof targetId !== "string" || targetId === "") {
        return json({ error: "user_id vereist" }, 400);
      }
      const { data, error } = await admin.rpc("admin_user_detail", {
        p_uid: targetId,
      });
      if (error) return json({ error: error.message }, 500);
      // De RPC geeft null terug als het profiel niet bestaat.
      if (data === null) return json({ error: "Gebruiker niet gevonden" }, 404);
      return json({ detail: data });
    }
  }
});
