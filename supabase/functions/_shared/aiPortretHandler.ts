// Het recept achter de AI-portretten (#682, uit generate-dictator-avatar #554
// getrokken): één request-handler die van de profielfoto een portret maakt via
// OpenAI gpt-image-1 (image *edit*), in de vaste stijl van een referentiebeeld in
// de publieke avatars-bucket, en het resultaat in de bucket + op het profiel
// wegschrijft. Welke stijl, welke prompt en welke kolommen: dat komt uit de
// meegegeven PortretStijl (aiPortret.ts).
//
// Twee aanroeppaden (bepaalAanroeppad):
//   1. Client (de eigenaar pre-warmt z'n eigen portret): supabase.functions
//      .invoke("generate-…-avatar") met de user-JWT. targetUserId = de ingelogde
//      gebruiker; body.userId wordt genegeerd.
//   2. Trusted server-trigger: aanroep met de header x-cron-secret + body.userId.
//      Dan mag het voor een willekeurige userId.
//
// Deploy ZONDER JWT-verificatie (`--no-verify-jwt`), net als send-push/club-page:
// de functions doen hun eigen auth. Pad 1 verifieert de meegestuurde user-JWT zelf
// via auth.getUser(); pad 2 gaat op het gedeelde x-cron-secret. Fail-closed —
// zonder geldige user of (juist) cron-secret volgt 401. Dit vermijdt ook de
// platform-JWT-gate, die met de nieuwe sb_publishable_/sb_secret_-keys (geen JWT)
// geen bruikbare Authorization-header voor pg_net oplevert.
//
// Vereiste secrets: OPENAI_API_KEY (zonder key doet de function niets), CRON_SECRET
// (voor pad 2). SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY worden
// automatisch geïnjecteerd.
//
// Stateless & geïsoleerd: per request gaan uitsluitend de avatar van díé gebruiker
// + de vaste stijlreferentie + de vaste prompt mee. Geen thread/gespreks-API, geen
// context van andere gebruikers of eerdere requests.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  BUCKET,
  bepaalAanroeppad,
  bronVoor,
  overslaanReden,
  promptVoor,
  type PortretProfiel,
  type PortretStijl,
} from "./aiPortret.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// Service-role-client, één keer per isolate (zoals vóór #682, toen de client op
// module-niveau stond) — niet per request, dat zou elke invocatie een nieuwe
// client-opbouw kosten. De env is pas in de handler beschikbaar, dus lazy.
let adminClient: ReturnType<typeof createClient> | null = null;
function admin(url: string, serviceKey: string) {
  return (adminClient ??= createClient(url, serviceKey));
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Handelt één portret-request af voor de meegegeven stijl. Bedoeld als enige
 *  regel in de index.ts van een portret-function:
 *
 *    Deno.serve((req) => portretHandler(req, STIJLEN.pias));
 */
export async function portretHandler(
  req: Request,
  stijl: PortretStijl,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  // Zonder key: niets versturen (graceful — de kaart toont zolang de avatar).
  if (!OPENAI_API_KEY) return json({ skipped: "no-key" });

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // --- Auth: bepaal targetUserId via het juiste pad. ---
  const route = bepaalAanroeppad(
    req.headers.get("x-cron-secret"),
    CRON_SECRET,
    body.userId,
  );
  if (route.pad === "weiger") return json({ error: route.error }, route.status);

  let targetUserId: string;
  if (route.pad === "cron") {
    targetUserId = route.userId;
  } else {
    // Pad 1: user-JWT. De gebruiker genereert alleen voor zichzelf.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const id = userData.user?.id;
    if (!id) return json({ error: "Niet ingelogd" }, 401);
    targetUserId = id;
  }

  // --- Profiel laden. Welke kolommen dat zijn, hangt van de stijl af; die
  // string is dus niet statisch, en supabase-js kan er geen rijtype uit
  // afleiden (het parseert de select-literal op typeniveau). Vandaar het
  // expliciete `string`-type en de cast naar PortretProfiel. ---
  const kolommen: string =
    `avatar_url, is_guest, ${stijl.optOutKolom}, ${stijl.urlKolom}, ${stijl.bronKolom}`;
  const db = admin(SUPABASE_URL, SERVICE_KEY);
  const { data } = await db
    .from("profiles")
    .select(kolommen)
    .eq("id", targetUserId)
    .maybeSingle();
  const profile = data as unknown as PortretProfiel | null;
  if (!profile) return json({ error: "Profiel niet gevonden" }, 404);

  const avatarUrl = profile.avatar_url ?? null;
  const bron = bronVoor(avatarUrl);

  // Gast, opt-out of al up-to-date → niets naar OpenAI.
  const overslaan = overslaanReden(profile, stijl, bron);
  if (overslaan) {
    return json(
      overslaan.reden === "cached"
        ? { skipped: "cached", url: overslaan.url }
        : { skipped: overslaan.reden },
    );
  }

  // --- Kill switch en dagbudget (#1049). ---
  //
  // Pas hier, ná alle gratis afslagen hierboven: een cache-hit, een gast of een
  // opt-out kost geen OpenAI-aanroep en hoort dus ook geen budget te kosten.
  // Vanaf dit punt gaat er wél geld heen.
  //
  // Eén RPC doet aan/uit én de teller in dezelfde transactie; zie
  // verbruik_dagbudget() voor waarom dat `for update` nodig heeft.
  const { data: budget, error: budgetFout } = await db.rpc(
    "verbruik_dagbudget",
    { p_sleutel: "ai_portretten" },
  );
  if (budgetFout) {
    // Fail-open, net als instellingen.ts: een storing in de tabel mag geen
    // functie stilleggen die het gisteren nog deed.
    console.error("[portret] budget lezen faalde", budgetFout.message);
  } else if (budget && (budget as { toegestaan?: boolean }).toegestaan === false) {
    const reden = (budget as { reden?: string }).reden ?? "uit";
    return json({ skipped: reden });
  }

  // --- Beelden ophalen. ---
  const referentieUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${stijl.referentiePad}`;
  const referentie = await fetchBlob(referentieUrl);
  if (!referentie) return json({ error: "reference-missing" }, 503);

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("size", "1024x1024");
  if (avatarUrl) {
    const avatar = await fetchBlob(avatarUrl);
    if (!avatar) return json({ error: "avatar-unreachable" }, 502);
    // Volgorde telt: FIRST = gelijkenis, SECOND = stijl.
    form.append("image[]", avatar, "avatar.png");
    form.append("image[]", referentie, "referentie_in_form.png");
  } else {
    form.append("image[]", referentie, "referentie_in_form.png");
  }
  form.append("prompt", promptVoor(stijl, avatarUrl != null));

  // --- OpenAI aanroepen (los images/edits-endpoint, geen state). ---
  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
  } catch {
    return json({ error: "openai-unreachable" }, 502);
  }
  if (!openaiRes.ok) {
    const detail = await openaiRes.text().catch(() => "");
    return json({ error: "openai-error", status: openaiRes.status, detail }, 502);
  }
  const payload = (await openaiRes.json()) as {
    data?: { b64_json?: string }[];
  };
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) return json({ error: "openai-empty" }, 502);

  // --- Uploaden (service-role, overschrijft altijd hetzelfde pad). ---
  const path = `${targetUserId}/${stijl.bestand}`;
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, b64ToBytes(b64), {
      upsert: true,
      contentType: "image/png",
      cacheControl: "31536000",
    });
  if (upErr) return json({ error: "upload-failed", detail: upErr.message }, 500);

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // --- Wegschrijven (service-role → de guard laat dit door). ---
  const patch: Record<string, string> = {
    [stijl.urlKolom]: publicUrl,
    [stijl.bronKolom]: bron,
  };
  const { error: updErr } = await db
    .from("profiles")
    // De kolomnamen komen uit de stijl, dus dit is een dynamische patch. Een
    // untyped client (geen Database-generic in edge functions) laat zulke keys
    // niet toe op typeniveau; vandaar de cast.
    .update(patch as never)
    .eq("id", targetUserId);
  if (updErr) return json({ error: "db-update-failed", detail: updErr.message }, 500);

  return json({ ok: true, soort: stijl.soort, url: publicUrl, bron });
}
