// Egress-hop voor de Playtomic-clubpagina (#392).
//
// De wekelijkse knownCourts-driftcheck (scripts/gen-known-courts.mjs via
// .github/workflows/known-courts.yml) krijgt vanaf GitHub-runners een 403 van
// Playtomic's CloudFront-WAF — dezelfde datacenter-blokkade als bij de
// Cloudflare Worker (#385). Supabase-egress komt er wél door, dus deze functie
// resolvet de club-slug en geeft de HTML van de clubpagina door.
//
// Bewust smal en afgeschermd: alleen clubpagina's op tenant-id (strikte
// UUID-validatie) en alleen met het gedeelde cron-geheim — géén open proxy.
//
// Deploy ZONDER JWT-verificatie en beveilig met het gedeelde geheim:
//   supabase functions deploy club-page --no-verify-jwt
//   (CRON_SECRET is dezelfde secret als snapshot-availability e.a.)

import { cronGuard } from "../_shared/cronAuth.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const PAGE_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.8",
};

// Zelfde slug-resolutie als de Worker (worker/index.js) en het gen-script:
// de 308 van playtomic.io wijst naar de canonieke slug-pagina.
async function resolveSlug(tenantId: string): Promise<string | null> {
  const res = await fetch(`https://playtomic.io/clubs/${tenantId}`, {
    redirect: "manual",
    headers: { "Accept-Language": PAGE_HEADERS["Accept-Language"] },
  });
  const location = res.headers.get("location");
  const slug = /\/clubs\/([^/?#]+)/.exec(location ?? "")?.[1];
  return slug && slug !== tenantId ? slug : null;
}

Deno.serve(async (req) => {
  // Fail-closed cron-guard (#460).
  const denied = cronGuard(req, CRON_SECRET);
  if (denied) return denied;
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const tenant = (
    new URL(req.url).searchParams.get("tenant_id") ?? ""
  ).toLowerCase();
  if (!UUID_RE.test(tenant)) {
    return new Response(JSON.stringify({ error: "bad params" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  try {
    const slug = await resolveSlug(tenant);
    if (!slug) {
      return new Response(JSON.stringify({ error: "no slug" }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }
    const upstream = await fetch(`https://playtomic.com/clubs/${slug}`, {
      headers: PAGE_HEADERS,
    });
    // Status ongewijzigd doorgeven; de aanroeper (het gen-script) vertaalt
    // fouten zelf naar een duidelijke melding.
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
});
