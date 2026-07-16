// Egress-hop voor de Playtomic-baanbeschikbaarheid (#385).
//
// Playtomic's CloudFront-WAF blokkeert playtomic.com/api vanaf Cloudflare
// Worker-IP's (403), maar laat Supabase-egress wél door (live geverifieerd,
// 16-07-2026). De Cloudflare Worker blijft de publieke voorkant — met
// edge-cache, per-IP rate-limit en allowlist — en stuurt alleen de
// daadwerkelijke upstream-fetch via deze functie.
//
// Bewust smal gehouden: uitsluitend het availability-endpoint, met strikte
// parametervalidatie. De functie draait zonder JWT-verificatie (de Worker is
// een anonieme proxy), dus de validatie is de enige poort — géén generieke
// doorgeefluik van paden of hosts.

const UPSTREAM = "https://playtomic.com/api/clubs/availability";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
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
