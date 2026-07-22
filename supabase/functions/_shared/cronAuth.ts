// Fail-closed cron-authenticatie (#460).
//
// De oude guard `SECRET && header !== SECRET` viel *open* zodra het geheim
// ontbrak: de linkerkant werd falsy, de check oversprongen, de function
// volledig publiek. Een beveiligingscheck hoort fail-closed te zijn — geen
// geconfigureerd geheim betekent "weiger", niet "laat iedereen door".
//
// Gebruikt enkel web-standaard `Request`/`Headers`/`Response` (geen Deno-
// globals), zodat de logica ook los te unit-testen is (zie cronAuth.test.ts).

/**
 * True alleen als er een geheim geconfigureerd is én de meegestuurde header
 * er exact mee overeenkomt. Ontbrekend geheim → altijd false.
 */
export function isCronAuthorized(
  secret: string | undefined,
  header: string | null,
): boolean {
  return !!secret && header === secret;
}

/**
 * Guard voor edge functions. Geeft een 401-Response terug als de aanroep niet
 * geautoriseerd is, anders `null`. Bedoeld als eerste regel in `Deno.serve`:
 *
 *   const denied = cronGuard(req, CRON_SECRET);
 *   if (denied) return denied;
 */
export function cronGuard(
  req: Request,
  secret: string | undefined,
): Response | null {
  if (isCronAuthorized(secret, req.headers.get("x-cron-secret"))) return null;
  return new Response(JSON.stringify({ error: "Geen toegang" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
