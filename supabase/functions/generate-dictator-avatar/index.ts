// Edge Function: "Genereer dictator-portret" (#554).
//
// Maakt van de profielfoto een over-the-top militair dictator-portret via OpenAI
// gpt-image-1 (image *edit*), in de vaste stijl van de waarnemend-dictator-
// referentie (Kylian Mbappé, groen uniform). Het resultaat wordt in de publieke
// avatars-bucket bewaard (`{userId}/dictator.png`) en op De Troon (#528/#545)
// getoond i.p.v. de gewone avatar.
//
// Twee aanroeppaden:
//   1. Client (de eigenaar pre-warmt z'n eigen portret): supabase.functions
//      .invoke("generate-dictator-avatar") met de user-JWT. targetUserId = de
//      ingelogde gebruiker; body.userId wordt genegeerd.
//   2. Trusted server-trigger (vangnet zodra iemand zittend dictator wordt): de
//      dictator_termijnen-trigger roept via pg_net aan met de header
//      x-cron-secret + body.userId. Dan mag voor een willekeurige userId.
//
// Deploy ZONDER JWT-verificatie (`--no-verify-jwt`), net als send-push/club-page:
// de function doet z'n eigen auth. Pad 1 verifieert de meegestuurde user-JWT zelf
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const BUCKET = "avatars";
// Vaste stijlreferentie in de publieke avatars-bucket (eenmalig geseed via
// scripts/upload-dictator-referentie.mjs). Groen uniform, medailles, imperiale
// pose — geeft elk portret dezelfde look.
const REFERENTIE_URL =
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/_ref/dictator-stijl.png`;
// Sentinel-bron voor een gebruiker zonder profielfoto: zo regenereren we zodra
// hij later wél een avatar uploadt (bron != avatar_url).
const GEEN_AVATAR = "__geen_avatar__";

// Vaste prompts (Engels voor modelkwaliteit; altijd letterlijk hetzelfde).
const PROMPT_MET_AVATAR =
  "Transform the person in the FIRST image into an over-the-top military padel " +
  "dictator. Preserve their facial likeness, identity and skin tone from the " +
  "FIRST image. Apply ONLY the visual style, uniform and composition of the " +
  "SECOND (reference) image: deep-green generalissimo uniform with gold " +
  "epaulettes, rows of medals and a sash, imperial upright pose, dramatic studio " +
  "lighting, matching color palette and framing. Head-and-shoulders square " +
  "portrait, centered, plain dramatic backdrop. Do NOT copy the reference " +
  "person's face — only their outfit and styling.";
const PROMPT_ZONDER_AVATAR =
  "Create an over-the-top military padel dictator portrait in the exact visual " +
  "style of the reference image (deep-green generalissimo uniform, gold " +
  "epaulettes, medals, sash, imperial pose, dramatic lighting, matching palette " +
  "and framing), but with a COMPLETELY DIFFERENT, invented, anonymous face — " +
  "clearly NOT the person in the reference image and not a real public figure. " +
  "Generic, non-identifiable ruler; do not reproduce the reference person's " +
  "likeness. Head-and-shoulders square portrait.";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // Zonder key: niets versturen (graceful — de troon toont zolang de avatar).
  if (!OPENAI_API_KEY) return json({ skipped: "no-key" });

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // --- Auth: bepaal targetUserId via het juiste pad. ---
  let targetUserId: string | null = null;
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    // Pad 2: trusted server-trigger, mag voor een willekeurige userId.
    targetUserId = body.userId ?? null;
    if (!targetUserId) return json({ error: "userId vereist" }, 400);
  } else if (cronHeader) {
    // Verkeerd geheim → expliciet weigeren (geen stille val terug naar pad 1).
    return json({ error: "Geen toegang" }, 401);
  } else {
    // Pad 1: user-JWT. De gebruiker genereert alleen voor zichzelf.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    targetUserId = userData.user?.id ?? null;
    if (!targetUserId) return json({ error: "Niet ingelogd" }, 401);
  }

  // --- Profiel laden. ---
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "avatar_url, dictator_portret, dictator_avatar_url, dictator_avatar_bron, is_guest",
    )
    .eq("id", targetUserId)
    .maybeSingle();
  if (!profile) return json({ error: "Profiel niet gevonden" }, 404);

  // Opt-out of gast → niets naar OpenAI.
  if (profile.is_guest) return json({ skipped: "guest" });
  if (profile.dictator_portret === false) return json({ skipped: "opt-out" });

  const avatarUrl: string | null = profile.avatar_url ?? null;
  const bron = avatarUrl ?? GEEN_AVATAR;

  // Idempotent: portret hoort al bij de huidige (of ontbrekende) foto.
  if (
    profile.dictator_avatar_bron === bron &&
    profile.dictator_avatar_url
  ) {
    return json({ skipped: "cached", url: profile.dictator_avatar_url });
  }

  // --- Beelden ophalen. ---
  const referentie = await fetchBlob(REFERENTIE_URL);
  if (!referentie) return json({ error: "reference-missing" }, 503);

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("size", "1024x1024");
  if (avatarUrl) {
    const avatar = await fetchBlob(avatarUrl);
    if (!avatar) return json({ error: "avatar-unreachable" }, 502);
    // Volgorde telt: FIRST = gelijkenis, SECOND = stijl.
    form.append("image[]", avatar, "avatar.png");
    form.append("image[]", referentie, "referentie.png");
    form.append("prompt", PROMPT_MET_AVATAR);
  } else {
    form.append("image[]", referentie, "referentie.png");
    form.append("prompt", PROMPT_ZONDER_AVATAR);
  }

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
  const path = `${targetUserId}/dictator.png`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, b64ToBytes(b64), {
      upsert: true,
      contentType: "image/png",
      cacheControl: "31536000",
    });
  if (upErr) return json({ error: "upload-failed", detail: upErr.message }, 500);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // --- Wegschrijven (service-role → guard laat dit door). ---
  const { error: updErr } = await admin
    .from("profiles")
    .update({ dictator_avatar_url: publicUrl, dictator_avatar_bron: bron })
    .eq("id", targetUserId);
  if (updErr) return json({ error: "db-update-failed", detail: updErr.message }, 500);

  return json({ ok: true, url: publicUrl, bron });
});
