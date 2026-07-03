// Edge Function: verstuurt web-push-meldingen op basis van database-webhooks.
//
// Events (zie ../../snippets/push_webhooks.sql voor de triggers):
//  - INSERT op matches met status != completed  → "Nieuwe ronde" naar de 4 spelers
//  - UPDATE op matches naar status = completed  → "Uitslag ingevoerd" naar de 4 spelers
//  - INSERT op friendships (pending)            → "Vriendschapsverzoek" naar de ontvanger
//
// Vereiste secrets (supabase secrets set):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
// SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch meegegeven.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:beheer@vamos.example",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

type MatchRecord = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  status: string;
  score_a: number | null;
  score_b: number | null;
  group_id: string | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
};

type Message = {
  recipients: string[];
  title: string;
  body: string;
  url: string;
};

async function playersOf(match: MatchRecord): Promise<string[]> {
  const { data } = await supabase
    .from("teams")
    .select("player1_id, player2_id")
    .in("id", [match.team_a_id, match.team_b_id]);
  return (data ?? []).flatMap((t) => [t.player1_id, t.player2_id]);
}

async function nameOf(playerId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("username, full_name")
    .eq("id", playerId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.username || "Een speler";
}

async function messageFor(payload: WebhookPayload): Promise<Message | null> {
  if (payload.table === "friendships" && payload.type === "INSERT") {
    const rec = payload.record as {
      requester_id: string;
      addressee_id: string;
      status: string;
    };
    if (rec.status !== "pending") return null;
    return {
      recipients: [rec.addressee_id],
      title: "Nieuw vriendschapsverzoek 🎾",
      body: `${await nameOf(rec.requester_id)} wil met je padellen.`,
      url: "/vrienden",
    };
  }

  if (payload.table === "matches" && payload.type === "INSERT") {
    const rec = payload.record as unknown as MatchRecord;
    // Alleen geplande (gegenereerde) matches; direct gelogde uitslagen niet.
    if (rec.status === "completed") return null;
    return {
      recipients: await playersOf(rec),
      title: "Nieuwe ronde gegenereerd 🎾",
      body: "Jouw match staat klaar — bekijk tegen wie je speelt.",
      url: rec.group_id ? `/groepen/${rec.group_id}` : "/matches",
    };
  }

  if (payload.table === "matches" && payload.type === "UPDATE") {
    const rec = payload.record as unknown as MatchRecord;
    const old = payload.old_record as unknown as MatchRecord | null;
    if (rec.status !== "completed" || old?.status === "completed") return null;
    const score =
      rec.score_a != null && rec.score_b != null
        ? ` ${rec.score_a}–${rec.score_b}`
        : "";
    return {
      recipients: await playersOf(rec),
      title: "Uitslag ingevoerd",
      body: `Jouw match is afgerond:${score}. Bekijk het nieuwe klassement.`,
      url: `/matches/${rec.id}`,
    };
  }

  return null;
}

Deno.serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Geen geldige payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const message = await messageFor(payload);
  if (!message || message.recipients.length === 0) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", message.recipients);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: message.title,
            body: message.body,
            url: message.url,
          }),
        );
        sent += 1;
      } catch (err) {
        // Verlopen/ingetrokken abonnementen opruimen.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );

  return new Response(JSON.stringify({ sent, recipients: message.recipients.length }), {
    headers: { "content-type": "application/json" },
  });
});
