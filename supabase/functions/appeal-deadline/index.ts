// Edge Function: sluit verlopen VAR-zaken (#1025). Bedoeld om elk uur door
// pg_cron aangeroepen te worden (zie ../../snippets/appeal_deadline_cron.sql).
//
// Eén taak, en die zit al in de databank: expire_point_appeals() loopt de
// openstaande beroepen af waarvan het stemvenster verlopen is en laat
// resolve_point_appeal ze afhandelen. Zwijgen is geen instemming, dus zonder
// meerderheid wordt zo'n zaak afgewezen.
//
// Waarom hier een aparte function en niet een stukje SQL in de cron zelf: de
// RPC is bewust alleen voor service_role uitvoerbaar, en dit is dezelfde
// beveiligde route als poll-deadline en match-reminders al gebruiken. De
// pushmeldingen over de uitspraak lopen los, via de webhook op point_appeals
// naar send-push — of de zaak nu door een stem of door de klok beslist wordt.
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy appeal-deadline --no-verify-jwt
//   (CRON_SECRET is hetzelfde geheim als bij poll-deadline.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { cronGuard } from "../_shared/cronAuth.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;

  const { data, error } = await admin.rpc("expire_point_appeals");
  if (error) {
    console.error("[appeal-deadline] expire_point_appeals faalde", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const gesloten = typeof data === "number" ? data : 0;
  if (gesloten > 0) console.log(`[appeal-deadline] ${gesloten} zaak/zaken gesloten`);
  return new Response(JSON.stringify({ gesloten }), {
    headers: { "content-type": "application/json" },
  });
});
