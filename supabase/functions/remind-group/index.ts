// Edge Function: "Herinner de groep". De ingelogde gebruiker (een groepslid)
// stuurt een push naar de groepsleden die nog NIET gereageerd hebben op een
// speelvoorstel (play_proposals).
//
// Aanroep vanaf de client via supabase.functions.invoke("remind-group", {...}),
// waarbij de Authorization-header van de gebruiker automatisch wordt meegestuurd.
// Deploy MET JWT-verificatie (de standaard): we hebben de gebruiker nodig om te
// controleren dat hij lid van de groep is.
//
// Vereiste secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role client: leest ledenlijst + push-abonnementen zonder RLS-hindernis.
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:beheer@vamos.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

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

async function pushTo(recipients: string[], payload: unknown): Promise<number> {
  if (recipients.length === 0) return 0;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipients);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return sent;
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

  let body: { group_id?: string; proposal_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geen geldige payload" }, 400);
  }
  const groupId = body.group_id;
  const proposalId = body.proposal_id;
  if (!groupId || !proposalId) {
    return json({ error: "group_id en proposal_id vereist" }, 400);
  }

  // Het voorstel zelf (voor de datum/tijd in de melding) — moet bij de groep horen.
  const { data: proposal } = await admin
    .from("play_proposals")
    .select("date, start_time, group_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal || proposal.group_id !== groupId) {
    return json({ error: "Voorstel niet gevonden" }, 404);
  }

  // Alle leden van de groep.
  const { data: members } = await admin
    .from("group_members")
    .select("player_id")
    .eq("group_id", groupId);
  const memberIds = (members ?? []).map((m) => m.player_id);

  // Aanroeper moet zelf lid zijn.
  if (!memberIds.includes(uid)) return json({ error: "Geen toegang" }, 403);

  // Leden die al op dit voorstel reageerden.
  const { data: reacted } = await admin
    .from("play_proposal_votes")
    .select("player_id")
    .eq("proposal_id", proposalId);
  const responded = new Set((reacted ?? []).map((r) => r.player_id));

  // Herinner iedereen zonder reactie — behalve de aanroeper zelf.
  const recipients = memberIds.filter((id) => id !== uid && !responded.has(id));

  const day = new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${proposal.date}T12:00:00`));

  const sent = await pushTo(recipients, {
    title: "Speel je mee? 🎾",
    body: `Er ligt een speelvoorstel voor ${day} om ${proposal.start_time} — laat weten of je kunt.`,
    url: `/groepen/${groupId}?tab=plannen`,
  });

  return json({ reminded: recipients.length, sent });
});
