// Edge Function: "client-error" — crashmeldingen uit de browser wegschrijven (#1049).
//
// De browser praat hier NIET rechtstreeks mee. De keten is:
//
//   errorReport.ts --POST--> Worker /api/client-error --POST--> deze function
//
// De Worker houdt wat hij al deed (alleen POST, 8 kB-grens, eigen per-IP
// rate-limit, altijd 204) en stuurt de body door met x-cron-secret.
//
// WAAROM DEZE OMWEG, en niet de Worker rechtstreeks met de service-role laten
// schrijven zoals de issuetekst voorstelt: dan moet SUPABASE_SERVICE_ROLE_KEY —
// de sleutel die langs élke RLS gaat, op elke tabel — als Cloudflare-secret
// bestaan, voor één insert in één tabel. Lekt de Worker ooit zijn env, dan ligt
// de hele databank open in plaats van dit ene endpoint. Het gedeelde CRON_SECRET
// staat al op de Worker (voor de Playtomic-egress, #385) en geeft precies zoveel
// als hier nodig is.
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy client-error --no-verify-jwt
//   (CRON_SECRET is hetzelfde geheim als bij poll-deadline.)
// Staat vastgelegd in config.toml en bewaakt door edgeFuncties.test.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { cronGuard } from "../_shared/cronAuth.ts";
import { naarFoutRij } from "../_shared/foutmelding.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Geen 400: de aanroeper is de Worker en die kan er niets mee. Een kapotte
    // melding is geen reden om iets te laten opvallen dat niemand leest.
    return new Response(null, { status: 204 });
  }

  const rij = naarFoutRij(body);
  if (rij === null) return new Response(null, { status: 204 });

  // Twee namen wijken af van de payload: `bericht` heet in de tabel
  // `boodschap` (zoals de issuetekst hem doopte) en `build` heet `release`.
  const { error } = await admin.from("client_errors").insert({
    bron: rij.bron,
    boodschap: rij.bericht,
    stack: rij.stack,
    component_stack: rij.component_stack,
    scope: rij.scope,
    chunk: rij.chunk,
    pad: rij.pad,
    release: rij.build,
    sessie: rij.sessie,
    user_agent: rij.user_agent,
  });

  if (error) {
    // Wél luid: als het foutenlogboek zelf stuk is, wil je dat in de
    // function-logs zien. De aanroeper krijgt nog steeds 204 — de browser kan
    // er niets mee en mag hier nooit op wachten.
    console.error("[client-error] insert faalde", error.message);
  }

  return new Response(null, { status: 204 });
});
