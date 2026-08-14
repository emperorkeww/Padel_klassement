// Egress-hop voor het zoeken naar Playtomic-clubs (#391).
//
// Playtomic's CloudFront-WAF weert datacenter-IP's: playtomic.com/api geeft 403
// vanaf Cloudflare-egress (#385) en de clubpagina's geven 403 vanaf
// GitHub-runners (#392). Supabase-egress komt er wél door — dezelfde reden dat
// playtomic-availability en club-page bestaan. De zoekpagina loopt daarom langs
// dezelfde route: de Cloudflare Worker blijft de publieke voorkant (allowlist,
// per-IP rate-limit, edge-cache) en doet de upstream-fetch hier.
//
// Deze functie geeft niet de rauwe payload terug maar het geparste resultaat:
// ~80 kB RSC-flight wordt zo een paar honderd bytes JSON, en de Worker hoeft de
// Next-payload niet te kennen om hem te cachen.
//
// Deploy ZONDER JWT-verificatie en beveiligd met het gedeelde geheim:
//   supabase functions deploy club-search --no-verify-jwt
//   (CRON_SECRET is dezelfde secret als playtomic-availability e.a.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { cronGuard } from "../_shared/cronAuth.ts";
import { isAan } from "../_shared/instellingen.ts";
import {
  belgischeClubs,
  parseClubs,
  relevanteClubs,
  ZOEK_HEADERS,
  ZOEK_MAX_LENGTE,
  ZOEK_MIN_LENGTE,
  zoekUrl,
} from "../_shared/clubZoeken.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Hoogstens tien treffers: de kiezer toont een korte lijst, en wie zijn club
// niet ziet typt beter een woord meer dan dat hij door dertig namen scrolt.
const MAX_TREFFERS = 10;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// Alleen om app_settings te lezen. Lui aangemaakt, net als in
// playtomic-availability, zodat de functie zonder kill switch niets extra doet.
let db: ReturnType<typeof createClient> | null = null;
function admin() {
  return (db ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  ));
}

Deno.serve(async (req) => {
  // Fail-closed cron-guard (#460, #466): zonder het gedeelde geheim is dit een
  // open proxy die de rate-limit en edge-cache van de Worker omzeilt.
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Zelfde kill switch als de beschikbaarheid (#1049): blokkeert Playtomic ons
  // opnieuw, dan stopt dit het hameren zonder deploy. 503 en géén lege
  // trefferlijst — "niets gevonden" zou liegen over een storing.
  if (!(await isAan(admin(), "playtomic"))) {
    return new Response(JSON.stringify({ error: "uitgeschakeld" }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }

  const vraag = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (vraag.length < ZOEK_MIN_LENGTE || vraag.length > ZOEK_MAX_LENGTE) {
    return new Response(JSON.stringify({ error: "bad params" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  try {
    const upstream = await fetch(zoekUrl(vraag), { headers: ZOEK_HEADERS });
    if (!upstream.ok) {
      // Status doorgeven: de Worker cachet alleen 2xx en de client maakt er een
      // nette melding van.
      return new Response(JSON.stringify({ error: "upstream" }), {
        status: upstream.status,
        headers: JSON_HEADERS,
      });
    }
    const clubs = belgischeClubs(
      relevanteClubs(parseClubs(await upstream.text()), vraag),
      MAX_TREFFERS,
    );
    return new Response(JSON.stringify({ clubs }), { headers: JSON_HEADERS });
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
});
