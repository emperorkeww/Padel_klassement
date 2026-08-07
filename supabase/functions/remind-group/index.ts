// Edge Function: "Herinner de groep". De ingelogde gebruiker (een groepslid)
// stuurt een push naar de groepsleden die nog op GEEN ENKELE optie van een
// speeldag-poll (play_polls) gestemd hebben.
//
// Aanroep vanaf de client via supabase.functions.invoke("remind-group", {...}),
// waarbij de Authorization-header van de gebruiker automatisch wordt meegestuurd.
// Deploy MET JWT-verificatie (de standaard): we hebben de gebruiker nodig om te
// controleren dat hij lid van de groep is.
//
// De melding loopt via de gedeelde bezorger (#1090,
// ../_shared/meldingenBezorger.ts): eerst de rij in public.notifications, dan
// pas de push. Wie geen abonnement heeft, ziet het porren dus toch in de app.
//
// Vereiste secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import { bezorg } from "../_shared/meldingenBezorger.ts";
import {
  GROEP_HERINNERING,
  kiesTitel,
  kiesUit,
  roastSeed,
  TITEL_GROEP_HERINNERING,
} from "../_shared/roast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role client: leest ledenlijst + push-abonnementen zonder RLS-hindernis.
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

  // De ingelogde gebruiker uit de meegestuurde Authorization-header halen.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return json({ error: "Niet ingelogd" }, 401);

  let body: { group_id?: string; poll_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geen geldige payload" }, 400);
  }
  const groupId = body.group_id;
  const pollId = body.poll_id;
  if (!groupId || !pollId) {
    return json({ error: "group_id en poll_id vereist" }, 400);
  }

  // De poll moet bij de groep horen en nog open staan.
  const { data: poll } = await admin
    .from("play_polls")
    .select("group_id, status")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll || poll.group_id !== groupId) {
    return json({ error: "Poll niet gevonden" }, 404);
  }
  if (poll.status !== "open") {
    return json({ error: "Poll is niet meer open" }, 400);
  }

  // Alle leden van de groep.
  const { data: members } = await admin
    .from("group_members")
    .select("player_id")
    .eq("group_id", groupId);
  const memberIds = (members ?? []).map((m) => m.player_id);

  // Aanroeper moet zelf lid zijn.
  if (!memberIds.includes(uid)) return json({ error: "Geen toegang" }, 403);

  // Leden die al op minstens één optie stemden.
  const { data: options } = await admin
    .from("play_poll_options")
    .select("id")
    .eq("poll_id", pollId);
  const optionIds = (options ?? []).map((o) => o.id);
  const responded = new Set<string>();
  if (optionIds.length > 0) {
    const { data: votes } = await admin
      .from("play_poll_votes")
      .select("player_id")
      .in("option_id", optionIds);
    for (const v of votes ?? []) responded.add(v.player_id);
  }

  // Herinner iedereen zonder enige stem — behalve de aanroeper zelf.
  const recipients = memberIds.filter((id) => id !== uid && !responded.has(id));

  // Tekst en titel uit een pool (#189). De seed draagt het aantal stemmers mee:
  // wie de groep een tweede keer aanstoot nadat er iemand gestemd heeft, stuurt
  // een andere regel de deur uit in plaats van exact dezelfde melding.
  const seed = roastSeed(pollId, uid, String(responded.size));
  const { sent } = await bezorg(admin, [{
    recipients,
    title: kiesTitel(TITEL_GROEP_HERINNERING, pollId, String(responded.size)),
    body: kiesUit(GROEP_HERINNERING, seed),
    url: `/speeldag/${pollId}`,
    soort: "poll",
    tag: `poll-${pollId}`,
  }]);

  return json({ reminded: recipients.length, sent });
});
