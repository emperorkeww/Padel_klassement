// Egress-hop voor de Playtomic-baanbeschikbaarheid (#385).
//
// Playtomic's CloudFront-WAF blokkeert playtomic.com/api vanaf Cloudflare
// Worker-IP's (403), maar laat Supabase-egress wél door (live geverifieerd,
// 16-07-2026). De Cloudflare Worker blijft de publieke voorkant — met
// edge-cache, per-IP rate-limit en allowlist — en stuurt alleen de
// daadwerkelijke upstream-fetch via deze functie.
//
// Bewust smal gehouden: uitsluitend het availability-endpoint, met strikte
// parametervalidatie. De functie draait zonder JWT-verificatie (--no-verify-jwt),
// maar is geen open proxy: de Worker stuurt het gedeelde CRON_SECRET mee als
// 'x-cron-secret'. Zonder dat geheim geen toegang (#466) — anders omzeilt een
// directe hit op deze URL de per-IP ratelimit + edge-cache van de Worker (#385).
//
// De check is fail-closed (#460): ontbreekt de secret in de omgeving, dan
// weigeren we álles i.p.v. de poort open te zetten. CRON_SECRET is hetzelfde
// geheim als de andere edge-functies (match-reminders, snapshot-availability e.a.).

import { createClient } from "npm:@supabase/supabase-js@2";
import { isAan } from "../_shared/instellingen.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Alleen om app_settings te lezen (#1049). Lui aangemaakt zodat de function
// zonder de kill switch precies zo smal blijft als hij was.
let db: ReturnType<typeof createClient> | null = null;
function admin() {
  return (db ??= createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  ));
}

const UPSTREAM = "https://playtomic.com/api/clubs/availability";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (req) => {
  // Fail-closed (#460, #466): ontbreekt het geheim of matcht de header niet,
  // dan weigeren. Zo is de Worker de enige poort naar deze egress-hop.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Geen toegang" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Kill switch (#1049): als Playtomic ons weer blokkeert, stopt dit het
  // hameren zonder deploy. 503 en geen lege uitslag — de Worker cachet
  // niet-ok-antwoorden niet, en de app degradeert precies zoals bij een echte
  // Playtomic-storing. Een verzonnen "geen banen vrij" zou de gebruiker
  // voorliegen over iets wat hij gaat boeken.
  if (!(await isAan(admin(), "playtomic"))) {
    return new Response(
      JSON.stringify({ error: "uitgeschakeld" }),
      { status: 503, headers: JSON_HEADERS },
    );
  }

  const params = new URL(req.url).searchParams;
  const tenant = (params.get("tenant_id") ?? "").toLowerCase();
  const date = params.get("date") ?? "";
  const sport = params.get("sport_id") ?? "";
  if (!UUID_RE.test(tenant) || !DATE_RE.test(date) || sport !== "PADEL") {
    return new Response(JSON.stringify({ error: "bad params" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  try {
    const upstream = await fetch(
      `${UPSTREAM}?tenant_id=${tenant}&date=${date}&sport_id=PADEL`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
        },
      },
    );
    // Status ongewijzigd doorgeven: de Worker cachet alleen 2xx en de client
    // vertaalt fouten naar een nette melding (getJson in api.ts).
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: JSON_HEADERS,
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
});
